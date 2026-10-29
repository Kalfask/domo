package com.deskos.hub.events;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;

/**
 * Incoming payload for POST /events/vision.
 * <p>
 * Kept separate from the {@link VisionEvent} entity so the external HTTP contract
 * can evolve independently from the persisted schema.
 */
public record VisionEventDto(
        @NotBlank String eventType,
        String personName,
        @DecimalMin("0.0") @DecimalMax("1.0") Double confidence
) {
}
