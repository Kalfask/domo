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
@Order(20)
@RequiredArgsConstructor
@Slf4j
public class EveningArrivalScene implements SceneStrategy {

    private final List<Actuator> actuators;

    @Override
    public boolean matches(VisionEvent event, LocalDateTime now) {
        if (!"arrived".equals(event.getEventType())) {
            return false;
        }
        int hour = now.getHour();
        return hour >= 18 && hour < 23;
    }

    @Override
    public void execute(VisionEvent event) {
        log.info("Executing EveningArrivalScene for {}", event.getPersonName());
        for (Actuator a : actuators) {
            a.turnOn("desk-light");
        }
    }
}
