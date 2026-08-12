package com.ticketdesk.attachmentservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class AttachmentServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(AttachmentServiceApplication.class, args);
    }
}
