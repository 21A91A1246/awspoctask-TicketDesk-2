package com.ticketdesk.commentservice.dto;

import java.time.LocalDateTime;

public class CommentResponseDTO {
    private Long id;
    private Long ticketId;
    private UserDTO user;
    private String commentText;
    private LocalDateTime createdAt;

    // Explicit constructors
    public CommentResponseDTO() {}

    public CommentResponseDTO(Long id, Long ticketId, UserDTO user, String commentText, LocalDateTime createdAt) {
        this.id = id;
        this.ticketId = ticketId;
        this.user = user;
        this.commentText = commentText;
        this.createdAt = createdAt;
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

    public UserDTO getUser() {
        return user;
    }

    public void setUser(UserDTO user) {
        this.user = user;
    }

    public String getCommentText() {
        return commentText;
    }

    public void setCommentText(String commentText) {
        this.commentText = commentText;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
