package com.deskos.hub.events;

import com.deskos.hub.scenes.SceneService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/events")
@RequiredArgsConstructor
@Slf4j
public class EventController {

    private final VisionEventRepository repo;
    private final SceneService scenes;

    @PostMapping("/vision")
    public ResponseEntity<Void> ingest(@RequestBody @Valid VisionEventDto dto) {
        var event = new VisionEvent(
                null,
                dto.eventType(),
                dto.personName(),
                dto.confidence(),
                Instant.now()
        );
        var saved = repo.save(event);
        log.info("Ingested event id={} type={} person={} confidence={}",
                saved.getId(), saved.getEventType(),
                saved.getPersonName(), saved.getConfidence());
        scenes.handle(saved);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/vision")
    public List<VisionEvent> list() {
        return repo.findAll();
    }

}
