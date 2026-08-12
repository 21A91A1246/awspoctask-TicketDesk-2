package com.ticketdesk.attachmentservice.repository;

import com.ticketdesk.attachmentservice.entity.Attachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {
    List<Attachment> findByTicketId(Long ticketId);
    Optional<Attachment> findByTicketIdAndFileName(Long ticketId, String fileName);
    Optional<Attachment> findByFileUrlEndingWith(String suffix);
}
