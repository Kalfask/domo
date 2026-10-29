package com.deskos.hub.scenes;

import com.deskos.hub.events.VisionEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class SceneService {

    private final List<SceneStrategy> strategies;

    public void handle(VisionEvent event) {
        var now = LocalDateTime.now();
        var match = strategies.stream()
                .filter(s -> s.matches(event, now))
                .findFirst();

        if (match.isPresent()) {
            var scene = match.get();
            log.info("Scene matched: {}", scene.getClass().getSimpleName());
            scene.execute(event);
        } else {
            log.debug("No scene matched event type={} at {}",
                    event.getEventType(), now);
        }
    }
}
