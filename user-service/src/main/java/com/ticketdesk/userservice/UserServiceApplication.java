package com.ticketdesk.userservice;

import com.ticketdesk.userservice.entity.User;
import com.ticketdesk.userservice.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class UserServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(UserServiceApplication.class, args);
    }

    // Auto-seed database on startup if no users exist
    @Bean
    public CommandLineRunner seedDatabase(UserRepository userRepository) {
        return args -> {
            if (userRepository.count() == 0) {
                userRepository.save(new User(null, "john_doe", "john.doe@company.com", "password", User.Role.CUSTOMER));
                userRepository.save(new User(null, "alice_smith", "alice.smith@company.com", "password", User.Role.CUSTOMER));
                userRepository.save(new User(null, "agent_smith", "agent.smith@support.com", "password", User.Role.AGENT));
                userRepository.save(new User(null, "agent_carter", "agent.carter@support.com", "password", User.Role.AGENT));
                System.out.println("✦ User database seeded successfully with 4 test users on startup!");
            }
        };
    }
}
