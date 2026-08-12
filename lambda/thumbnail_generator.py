import os
import urllib.parse
import urllib.request
import urllib.error
import boto3
import io
from PIL import Image

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    # Get the object from the event
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = urllib.parse.unquote_plus(event['Records'][0]['s3']['object']['key'], encoding='utf-8')
    
    print(f"Triggered by S3 event for bucket: {bucket}, key: {key}")
    
    # We only process files uploaded to the 'uploads/' folder
    if not key.startswith('uploads/'):
        print(f"Skipping key {key} because it is not in the uploads/ prefix.")
        return {
            'statusCode': 200,
            'body': 'Skipped non-upload key'
        }
    
    unique_file_name = key.replace('uploads/', '')
    
    # Only generate thumbnails for image files
    lower_key = key.lower()
    is_image = any(lower_key.endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'])
    
    if is_image:
        try:
            # Download the file from S3
            response = s3_client.get_object(Bucket=bucket, Key=key)
            image_data = response['Body'].read()
            
            # Open and resize the image
            image = Image.open(io.BytesIO(image_data))
            image.thumbnail((120, 120))  # Max dimensions for thumbnail
            
            # Save the thumbnail to a byte buffer
            buffer = io.BytesIO()
            img_format = image.format if image.format else 'PNG'
            image.save(buffer, format=img_format)
            buffer.seek(0)
            
            # Determine content type
            content_type = response.get('ContentType', 'image/png')
            
            # Define thumbnail key (different prefix to avoid infinite loop)
            thumbnail_key = f"thumbnails/{unique_file_name}"
            
            # Upload the thumbnail back to S3
            s3_client.put_object(
                Bucket=bucket,
                Key=thumbnail_key,
                Body=buffer,
                ContentType=content_type
            )
            print(f"Successfully generated and uploaded thumbnail to {thumbnail_key}")
            
        except Exception as e:
            print(f"Error generating thumbnail for image {key}: {str(e)}")
            # Do not fail completely so the file upload status can still be updated
    else:
        print(f"Skipping thumbnail generation for non-image file: {key}")
        
    # Notify attachment-service to mark the database record as ACTIVE
    api_gateway_url = os.environ.get('API_GATEWAY_URL', 'https://db5uk2a23n4w0.cloudfront.net')
    # Remove trailing slash if present
    if api_gateway_url.endswith('/'):
        api_gateway_url = api_gateway_url[:-1]
        
    active_url = f"{api_gateway_url}/api/attachments/active/{unique_file_name}"
    
    print(f"Notifying attachment-service at: {active_url}")
    try:
        req = urllib.request.Request(url=active_url, method='PUT')
        # Add a simple user-agent to bypass basic filters if any
        req.add_header('User-Agent', 'AWS-Lambda-Thumbnail-Generator')
        
        with urllib.request.urlopen(req, timeout=10) as res:
            status = res.getcode()
            body = res.read().decode('utf-8')
            print(f"Successfully marked attachment ACTIVE on backend. Status: {status}, Response: {body}")
    except urllib.error.HTTPError as e:
        print(f"HTTP Error notifying backend: {e.code} - {e.reason}")
        raise e
    except urllib.error.URLError as e:
        print(f"Network error notifying backend: {e.reason}")
        raise e
        
    return {
        'statusCode': 200,
        'body': f'Successfully processed {key}'
    }
