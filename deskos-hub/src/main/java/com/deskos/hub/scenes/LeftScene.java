package com.deskos.hub.scenes;

import com.deskos.hub.actuators.Actuator;
import com.deskos.hub.events.VisionEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@Order(100)
@RequiredArgsConstructor
@Slf4j
public class LeftScene implements SceneStrategy {

    private final List<Actuator> actuators;

    @Override
    public boolean matches(VisionEvent event, LocalDateTime now) {
        return "left".equals(event.getEventType());
    }

    @Override
    public void execute(VisionEvent event) {
        log.info("Executing LeftScene");
        for (Actuator a : actuators) {
            a.turnOff("room-lights");
            a.turnOff("desk-light");
        }
    }
}
