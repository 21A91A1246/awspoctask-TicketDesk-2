package com.ticketdesk.commentservice.controller;

import com.ticketdesk.commentservice.client.TicketClient;
import com.ticketdesk.commentservice.client.UserClient;
import com.ticketdesk.commentservice.dto.CommentResponseDTO;
import com.ticketdesk.commentservice.dto.UserDTO;
import com.ticketdesk.commentservice.entity.Comment;
import com.ticketdesk.commentservice.repository.CommentRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/comments")
public class CommentController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(CommentController.class);

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private UserClient userClient;

    @Autowired
    private TicketClient ticketClient;

    @PostMapping
    public ResponseEntity<?> addComment(@RequestBody Comment comment) {
        // Validate ticket existence via Feign client
        try {
            ticketClient.getTicketById(comment.getTicketId());
        } catch (Exception e) {
            log.error("Failed to verify ticket existence in ticket-service", e);
            return ResponseEntity.badRequest().body("Associated ticket does not exist or ticket-service is unreachable: " + e.getMessage());
        }

        // Validate user existence via Feign client
        try {
            UserDTO user = userClient.getUserById(comment.getUserId());
            if (user == null) {
                return ResponseEntity.badRequest().body("User does not exist");
            }
        } catch (Exception e) {
            log.error("Failed to verify commenter existence in user-service", e);
            return ResponseEntity.badRequest().body("Could not verify commenter user: " + e.getMessage());
        }

        Comment saved = commentRepository.save(comment);
        return ResponseEntity.ok(convertToResponseDTO(saved));
    }

    @GetMapping("/ticket/{ticketId}")
    public ResponseEntity<List<CommentResponseDTO>> getCommentsByTicket(@PathVariable Long ticketId) {
        List<Comment> comments = commentRepository.findByTicketIdOrderByCreatedAtAsc(ticketId);
        List<CommentResponseDTO> responseDTOs = comments.stream()
                .map(this::convertToResponseDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responseDTOs);
    }

    private CommentResponseDTO convertToResponseDTO(Comment comment) {
        CommentResponseDTO dto = new CommentResponseDTO();
        dto.setId(comment.getId());
        dto.setTicketId(comment.getTicketId());
        dto.setCommentText(comment.getCommentText());
        dto.setCreatedAt(comment.getCreatedAt());

        // Resolve user details
        if (comment.getUserId() != null) {
            try {
                UserDTO user = userClient.getUserById(comment.getUserId());
                dto.setUser(user);
            } catch (Exception e) {
                log.warn("Could not fetch user details for comment author ID " + comment.getUserId(), e);
                dto.setUser(new UserDTO(comment.getUserId(), "User_" + comment.getUserId(), "N/A", "CUSTOMER"));
            }
        }

        return dto;
    }
}
