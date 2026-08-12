package com.ticketdesk.ticketservice.controller;

import com.ticketdesk.ticketservice.client.UserClient;
import com.ticketdesk.ticketservice.dto.TicketResponseDTO;
import com.ticketdesk.ticketservice.dto.UserDTO;
import com.ticketdesk.ticketservice.entity.Ticket;
import com.ticketdesk.ticketservice.repository.TicketRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(TicketController.class);

    @Autowired
    private TicketRepository ticketRepository;

    @Autowired
    private UserClient userClient;

    @PostMapping
    public ResponseEntity<?> createTicket(@RequestBody Ticket ticket) {
        try {
            // Validate that the creator exists in user-service
            UserDTO creator = userClient.getUserById(ticket.getCreatedById());
            if (creator == null) {
                return ResponseEntity.badRequest().body("Creator user does not exist");
            }
        } catch (Exception e) {
            log.error("Failed to verify user existence via Feign client", e);
            return ResponseEntity.badRequest().body("Could not verify user existence: " + e.getMessage());
        }

        ticket.setStatus(Ticket.Status.OPEN);
        Ticket savedTicket = ticketRepository.save(ticket);
        return ResponseEntity.ok(convertToResponseDTO(savedTicket));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TicketResponseDTO> getTicketById(@PathVariable Long id) {
        return ticketRepository.findById(id)
                .map(ticket -> ResponseEntity.ok(convertToResponseDTO(ticket)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<TicketResponseDTO>> getAllTickets(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Ticket.Status status,
            @RequestParam(required = false) Ticket.Priority priority,
            @RequestParam(required = false) String category) {
        
        Long filterCreatedById = null;
        if (userId != null) {
            try {
                UserDTO user = userClient.getUserById(userId);
                if (user != null && "CUSTOMER".equalsIgnoreCase(user.getRole())) {
                    filterCreatedById = userId;
                }
            } catch (Exception e) {
                log.error("Failed to fetch user details to verify role", e);
            }
        }

        List<Ticket> tickets = ticketRepository.filterTickets(filterCreatedById, status, priority, category);
        List<TicketResponseDTO> responseDTOs = tickets.stream()
                .map(this::convertToResponseDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(responseDTOs);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable Long id, @RequestParam Ticket.Status newStatus) {
        Optional<Ticket> optionalTicket = ticketRepository.findById(id);
        if (optionalTicket.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Ticket ticket = optionalTicket.get();
        Ticket.Status currentStatus = ticket.getStatus();

        // Enforce transition rules: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED
        boolean valid = false;
        if (currentStatus == Ticket.Status.OPEN && newStatus == Ticket.Status.IN_PROGRESS) {
            valid = true;
        } else if (currentStatus == Ticket.Status.IN_PROGRESS && newStatus == Ticket.Status.RESOLVED) {
            valid = true;
        } else if (currentStatus == Ticket.Status.RESOLVED && newStatus == Ticket.Status.CLOSED) {
            valid = true;
        } else if (currentStatus == newStatus) {
            valid = true; // allow idempotent setting to current status
        }

        if (!valid) {
            return ResponseEntity.badRequest().body("Invalid status transition from " + currentStatus + " to " + newStatus + ". Valid flows are OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED.");
        }

        ticket.setStatus(newStatus);
        Ticket updated = ticketRepository.save(ticket);
        return ResponseEntity.ok(convertToResponseDTO(updated));
    }

    @PutMapping("/{id}/assign")
    public ResponseEntity<?> assignTicket(@PathVariable Long id, @RequestParam Long agentId) {
        Optional<Ticket> optionalTicket = ticketRepository.findById(id);
        if (optionalTicket.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Ticket ticket = optionalTicket.get();

        try {
            // Verify agent exists and has correct role in user-service
            UserDTO agent = userClient.getUserById(agentId);
            if (agent == null) {
                return ResponseEntity.badRequest().body("Agent does not exist");
            }
            if (!"AGENT".equalsIgnoreCase(agent.getRole())) {
                return ResponseEntity.badRequest().body("User assigned is not an IT Support Agent");
            }
        } catch (Exception e) {
            log.error("Failed to verify agent existence via Feign client", e);
            return ResponseEntity.badRequest().body("Could not verify agent: " + e.getMessage());
        }

        ticket.setAssignedToId(agentId);
        Ticket updated = ticketRepository.save(ticket);
        return ResponseEntity.ok(convertToResponseDTO(updated));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<Map<String, Map<String, Long>>> getDashboardMetrics(@RequestParam(required = false) Long userId) {
        Long filterCreatedById = null;
        if (userId != null) {
            try {
                UserDTO user = userClient.getUserById(userId);
                if (user != null && "CUSTOMER".equalsIgnoreCase(user.getRole())) {
                    filterCreatedById = userId;
                }
            } catch (Exception e) {
                log.error("Failed to fetch user details for dashboard metrics", e);
            }
        }

        Map<String, Long> statusCounts = new HashMap<>();
        for (Ticket.Status status : Ticket.Status.values()) {
            long count = (filterCreatedById != null) 
                    ? ticketRepository.countByStatusAndCreatedById(status, filterCreatedById)
                    : ticketRepository.countByStatus(status);
            statusCounts.put(status.name(), count);
        }

        Map<String, Long> priorityCounts = new HashMap<>();
        for (Ticket.Priority priority : Ticket.Priority.values()) {
            long count = (filterCreatedById != null) 
                    ? ticketRepository.countByPriorityAndCreatedById(priority, filterCreatedById)
                    : ticketRepository.countByPriority(priority);
            priorityCounts.put(priority.name(), count);
        }

        Map<String, Map<String, Long>> metrics = new HashMap<>();
        metrics.put("statusCounts", statusCounts);
        metrics.put("priorityCounts", priorityCounts);

        return ResponseEntity.ok(metrics);
    }

    private TicketResponseDTO convertToResponseDTO(Ticket ticket) {
        TicketResponseDTO dto = new TicketResponseDTO();
        dto.setId(ticket.getId());
        dto.setTitle(ticket.getTitle());
        dto.setDescription(ticket.getDescription());
        dto.setCategory(ticket.getCategory());
        dto.setPriority(ticket.getPriority());
        dto.setStatus(ticket.getStatus());
        dto.setCreatedAt(ticket.getCreatedAt());
        dto.setUpdatedAt(ticket.getUpdatedAt());

        // Resolve creator details
        if (ticket.getCreatedById() != null) {
            try {
                UserDTO creator = userClient.getUserById(ticket.getCreatedById());
                dto.setCreatedBy(creator);
            } catch (Exception e) {
                log.warn("Could not fetch creator details for ID " + ticket.getCreatedById(), e);
                // Create skeleton DTO
                dto.setCreatedBy(new UserDTO(ticket.getCreatedById(), "User_" + ticket.getCreatedById(), "N/A", "CUSTOMER"));
            }
        }

        // Resolve assignee details
        if (ticket.getAssignedToId() != null) {
            try {
                UserDTO assignee = userClient.getUserById(ticket.getAssignedToId());
                dto.setAssignedTo(assignee);
            } catch (Exception e) {
                log.warn("Could not fetch assignee details for ID " + ticket.getAssignedToId(), e);
                // Create skeleton DTO
                dto.setAssignedTo(new UserDTO(ticket.getAssignedToId(), "Agent_" + ticket.getAssignedToId(), "N/A", "AGENT"));
            }
        }

        return dto;
    }
}
