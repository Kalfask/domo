package com.deskos.hub.controllers;

import com.deskos.hub.services.LightService;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/lights")
public class Lights {

    private final LightService lightService;

    public Lights(LightService lightService) {
        this.lightService = lightService;
    }

    @PostMapping("/{deviceName}/toggle")
    public void toggle(@PathVariable String deviceName) {
        lightService.toggleLight(deviceName);
    }
}
