package com.deskos.hub.actuators;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Default actuator used in dev and testing — logs intended actions
 * instead of performing them. Replace or augment with a real actuator
 * (ShellyActuator, GpioActuator, WolActuator) in later phases.
 */
@Component
@Slf4j
public class MockActuator implements Actuator {

    @Override
    public void turnOn(String deviceName) {
        log.info("[MOCK] would turn ON '{}'", deviceName);
    }

    @Override
    public void turnOff(String deviceName) {
        log.info("[MOCK] would turn OFF '{}'", deviceName);
    }

    @Override
    public void wakeOnLan(String deviceName) {
        log.info("[MOCK] would send WoL to '{}'", deviceName);
    }
}
