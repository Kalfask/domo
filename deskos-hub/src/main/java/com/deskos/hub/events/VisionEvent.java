package com.deskos.hub.events;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * A single vision event emitted by a (future) Python vision worker.
 * <p>
 * {@code eventType} is one of {@code "arrived"} or {@code "left"}.
 * {@code personName} is null for {@code "left"} events.
 */
@Entity
@Table(name = "vision_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VisionEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String eventType;

    private String personName;

    private Double confidence;

    @Column(nullable = false)
    private Instant timestamp;
}
