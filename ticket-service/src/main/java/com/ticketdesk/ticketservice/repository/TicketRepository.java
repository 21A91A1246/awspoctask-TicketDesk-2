package com.ticketdesk.ticketservice.repository;

import com.ticketdesk.ticketservice.entity.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {

    @Query("SELECT t FROM Ticket t WHERE " +
           "(:createdById IS NULL OR t.createdById = :createdById) AND " +
           "(:status IS NULL OR t.status = :status) AND " +
           "(:priority IS NULL OR t.priority = :priority) AND " +
           "(:category IS NULL OR LOWER(t.category) LIKE LOWER(CONCAT('%', :category, '%')))")
    List<Ticket> filterTickets(
            @Param("createdById") Long createdById,
            @Param("status") Ticket.Status status,
            @Param("priority") Ticket.Priority priority,
            @Param("category") String category
    );

    long countByStatus(Ticket.Status status);

    long countByPriority(Ticket.Priority priority);

    long countByStatusAndCreatedById(Ticket.Status status, Long createdById);

    long countByPriorityAndCreatedById(Ticket.Priority priority, Long createdById);
}
