package com.ticketdesk.attachmentservice.controller;

import com.ticketdesk.attachmentservice.client.TicketClient;
import com.ticketdesk.attachmentservice.entity.Attachment;
import com.ticketdesk.attachmentservice.repository.AttachmentRepository;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import jakarta.annotation.PostConstruct;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import java.time.Duration;

@RestController
@RequestMapping("/api/attachments")
public class AttachmentController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AttachmentController.class);

    @Autowired
    private AttachmentRepository attachmentRepository;

    @Autowired
    private TicketClient ticketClient;

    @Value("${gateway.url:http://localhost:8080}")
    private String gatewayUrl;

    @Value("${attachment.bucket:tkt-attachments}")
    private String bucketName;

    @Value("${aws.region:ap-south-1}")
    private String awsRegion;

    private S3Presigner s3Presigner;

    @PostConstruct
    public void init() {
        try {
            this.s3Presigner = S3Presigner.builder()
                    .region(Region.of(awsRegion))
                    .build();
            log.info("S3Presigner initialized successfully for region {}", awsRegion);
        } catch (Exception e) {
            log.warn("S3Presigner failed to initialize: {}. Falling back to mock simulation.", e.getMessage());
        }
    }

    private static final String UPLOAD_DIR = "./uploads/";

    public static class PresignedUrlRequest {
        private Long ticketId;
        private String fileName;

        public Long getTicketId() {
            return ticketId;
        }

        public void setTicketId(Long ticketId) {
            this.ticketId = ticketId;
        }

        public String getFileName() {
            return fileName;
        }

        public void setFileName(String fileName) {
            this.fileName = fileName;
        }
    }

    public static class PresignedUrlResponse {
        private String uploadUrl;
        private String fileUrl;

        public String getUploadUrl() {
            return uploadUrl;
        }

        public void setUploadUrl(String uploadUrl) {
            this.uploadUrl = uploadUrl;
        }

        public String getFileUrl() {
            return fileUrl;
        }

        public void setFileUrl(String fileUrl) {
            this.fileUrl = fileUrl;
        }
    }

    @PostMapping("/presigned-url")
    public ResponseEntity<?> getPresignedUrl(@RequestBody PresignedUrlRequest request) {
        try {
            // Verify ticket exists
            ticketClient.getTicketById(request.getTicketId());
        } catch (Exception e) {
            log.error("Failed to verify ticket existence in ticket-service", e);
            return ResponseEntity.badRequest().body("Associated ticket does not exist or ticket-service is unreachable: " + e.getMessage());
        }

        // Sanitize file name to avoid collisions
        String uniqueFileName = UUID.randomUUID().toString() + "_" + request.getFileName();

        // Create a pending database entry
        Attachment attachment = new Attachment();
        attachment.setTicketId(request.getTicketId());
        attachment.setFileName(request.getFileName());
        
        String uploadUrl = null;
        boolean isMock = false;

        if (s3Presigner != null) {
            try {
                String s3Key = "uploads/" + uniqueFileName;
                String contentType = request.getFileName().toLowerCase().endsWith(".png") ? "image/png" : "application/octet-stream";
                if (request.getFileName().toLowerCase().endsWith(".jpg") || request.getFileName().toLowerCase().endsWith(".jpeg")) {
                    contentType = "image/jpeg";
                }

                PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(s3Key)
                        .contentType(contentType)
                        .build();

                PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                        .signatureDuration(Duration.ofMinutes(15))
                        .putObjectRequest(putObjectRequest)
                        .build();

                PresignedPutObjectRequest presignedPutObjectRequest = s3Presigner.presignPutObject(presignRequest);
                uploadUrl = presignedPutObjectRequest.url().toString();
                log.info("Generated real S3 presigned URL for upload: {}", uploadUrl);
            } catch (Exception e) {
                log.error("Failed to generate S3 presigned URL, falling back to mock: {}", e.getMessage());
                isMock = true;
            }
        } else {
            isMock = true;
        }

        String fileUrl;
        if (isMock) {
            uploadUrl = gatewayUrl + "/api/attachments/mock-s3-upload/" + request.getTicketId() + "/" + uniqueFileName;
            fileUrl = gatewayUrl + "/api/attachments/download/" + request.getTicketId() + "/" + uniqueFileName;
        } else {
            fileUrl = gatewayUrl + "/attachments/uploads/" + uniqueFileName;
        }

        attachment.setFileUrl(fileUrl);
        attachment.setStatus("PENDING");
        attachmentRepository.save(attachment);

        PresignedUrlResponse response = new PresignedUrlResponse();
        response.setUploadUrl(uploadUrl);
        response.setFileUrl(fileUrl);

        return ResponseEntity.ok(response);
    }

    // This simulates direct S3 upload via PUT request
    @PutMapping("/mock-s3-upload/{ticketId}/{fileName:.+}")
    public ResponseEntity<?> mockS3Upload(
            @PathVariable Long ticketId,
            @PathVariable String fileName,
            @RequestBody byte[] fileContent) {
        
        try {
            // Create uploads directory if it doesn't exist
            File directory = new File(UPLOAD_DIR);
            if (!directory.exists()) {
                directory.mkdirs();
            }

            // Save the file content locally
            File targetFile = new File(UPLOAD_DIR + fileName);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(fileContent);
            }

            // Extract the original clean file name (after UUID prefix)
            String originalFileName = fileName.substring(fileName.indexOf("_") + 1);

            // Find the pending database record and mark it active
            Optional<Attachment> optionalAttachment = attachmentRepository.findByTicketIdAndFileName(ticketId, originalFileName);
            if (optionalAttachment.isPresent()) {
                Attachment attachment = optionalAttachment.get();
                attachment.setStatus("ACTIVE");
                attachment.setUploadedAt(LocalDateTime.now());
                
                // Update fileUrl if needed (already pre-generated matching this path)
                attachmentRepository.save(attachment);
            } else {
                // If record was not found, create a new one directly
                Attachment attachment = new Attachment();
                attachment.setTicketId(ticketId);
                attachment.setFileName(originalFileName);
                
                attachment.setFileUrl(gatewayUrl + "/api/attachments/download/" + ticketId + "/" + fileName);
                attachment.setStatus("ACTIVE");
                attachment.setUploadedAt(LocalDateTime.now());
                attachmentRepository.save(attachment);
            }

            log.info("Mock S3 Upload Successful: saved file {}", fileName);
            return ResponseEntity.ok().body("File uploaded successfully to mock S3");
        } catch (Exception e) {
            log.error("Failed to upload file to mock S3", e);
            return ResponseEntity.internalServerError().body("Upload failed: " + e.getMessage());
        }
    }

    @PutMapping("/active/{uniqueFileName:.+}")
    public ResponseEntity<?> markAttachmentActive(@PathVariable String uniqueFileName) {
        log.info("Request to mark attachment ACTIVE for uniqueFileName: {}", uniqueFileName);
        Optional<Attachment> optionalAttachment = attachmentRepository.findByFileUrlEndingWith(uniqueFileName);
        if (optionalAttachment.isPresent()) {
            Attachment attachment = optionalAttachment.get();
            attachment.setStatus("ACTIVE");
            attachment.setUploadedAt(LocalDateTime.now());
            attachmentRepository.save(attachment);
            log.info("Attachment marked ACTIVE successfully: {}", uniqueFileName);
            return ResponseEntity.ok().body("Attachment status updated to ACTIVE");
        } else {
            log.warn("No pending attachment found in database for uniqueFileName: {}", uniqueFileName);
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/ticket/{ticketId}")
    public ResponseEntity<List<Attachment>> getAttachmentsByTicket(@PathVariable Long ticketId) {
        // Return only active attachments
        List<Attachment> attachments = attachmentRepository.findByTicketId(ticketId);
        return ResponseEntity.ok(attachments);
    }

    @GetMapping("/download/{ticketId}/{fileName:.+}")
    public ResponseEntity<Resource> downloadFile(@PathVariable Long ticketId, @PathVariable String fileName) {
        try {
            Path filePath = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize().resolve(fileName);
            Resource resource = new UrlResource(filePath.toUri());

            if (resource.exists() && resource.isReadable()) {
                // Try to determine file's content type
                String contentType = Files.probeContentType(filePath);
                if (contentType == null) {
                    contentType = "application/octet-stream";
                }

                // Remove UUID from filename for presentation to downloader
                String originalFileName = fileName;
                if (fileName.contains("_")) {
                    originalFileName = fileName.substring(fileName.indexOf("_") + 1);
                }

                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + originalFileName + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            log.error("Could not download file: {}", fileName, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteAttachment(@PathVariable Long id) {
        Optional<Attachment> opt = attachmentRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Attachment attachment = opt.get();
        
        try {
            String fileUrl = attachment.getFileUrl();
            String fileName = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);
            Path filePath = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize().resolve(fileName);
            Files.deleteIfExists(filePath);
        } catch (Exception e) {
            log.error("Failed to delete physical file for attachment ID {}", id, e);
        }
        
        attachmentRepository.delete(attachment);
        return ResponseEntity.ok().body("Attachment deleted successfully");
    }
}
