package com.ticketdesk.attachmentservice.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "attachments")
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long ticketId;

    @Column(nullable = false)
    private String fileName;

    @Column(length = 500)
    private String fileUrl;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, ACTIVE

    private LocalDateTime uploadedAt;

    // Explicit constructors
    public Attachment() {}

    public Attachment(Long id, Long ticketId, String fileName, String fileUrl, String status, LocalDateTime uploadedAt) {
        this.id = id;
        this.ticketId = ticketId;
        this.fileName = fileName;
        this.fileUrl = fileUrl;
        this.status = status;
        this.uploadedAt = uploadedAt;
    }

    // Explicit Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public String getFileUrl() {
        return fileUrl;
    }

    public void setFileUrl(String fileUrl) {
        this.fileUrl = fileUrl;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getUploadedAt() {
        return uploadedAt;
    }

    public void setUploadedAt(LocalDateTime uploadedAt) {
        this.uploadedAt = uploadedAt;
    }

    @PrePersist
    protected void onCreate() {
        if (status == null) {
            status = "PENDING";
        }
        uploadedAt = LocalDateTime.now();
    }
}
