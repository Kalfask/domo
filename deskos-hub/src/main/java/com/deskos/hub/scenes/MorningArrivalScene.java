package com.deskos.hub.scenes;

import com.deskos.hub.actuators.Actuator;
import com.deskos.hub.events.VisionEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDateTime;
import java.util.List;

@Component
@Order(10)
@RequiredArgsConstructor
@Slf4j
public class MorningArrivalScene implements SceneStrategy {

    private final List<Actuator> actuators;

    @Override
    public boolean matches(VisionEvent event, LocalDateTime now) {
        if (!"arrived".equals(event.getEventType())) {
            return false;
        }
        var dow = now.getDayOfWeek();
        boolean weekday = dow.getValue() >= DayOfWeek.MONDAY.getValue()
                && dow.getValue() <= DayOfWeek.FRIDAY.getValue();
        int hour = now.getHour();
        return weekday && hour >= 7 && hour < 12;
    }

    @Override
    public void execute(VisionEvent event) {
        log.info("Executing MorningArrivalScene for {}", event.getPersonName());
        for (Actuator a : actuators) {
            a.turnOn("room-lights");
            a.wakeOnLan("workstation");
        }
    }
}
