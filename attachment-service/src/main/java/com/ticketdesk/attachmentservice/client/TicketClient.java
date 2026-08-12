package com.ticketdesk.attachmentservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "ticket-service", url = "${ticket-service.url}")
public interface TicketClient {

    @GetMapping("/api/tickets/{id}")
    Object getTicketById(@PathVariable("id") Long id);
}
