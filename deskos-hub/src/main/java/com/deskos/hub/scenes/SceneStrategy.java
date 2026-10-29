package com.deskos.hub.scenes;

import com.deskos.hub.events.VisionEvent;

import java.time.LocalDateTime;

/**
 * A rule that decides whether an incoming event should trigger a particular
 * sequence of actuator commands. Scenes are evaluated by {@link SceneService}
 * in Spring bean order; the first match wins.
 */
public interface SceneStrategy {

    boolean matches(VisionEvent event, LocalDateTime now);

    void execute(VisionEvent event);
}
