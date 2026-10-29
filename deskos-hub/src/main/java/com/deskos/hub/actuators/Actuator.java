package com.deskos.hub.actuators;

/**
 * A thing that can affect the physical world — a smart plug, a GPIO relay,
 * a Wake-on-LAN sender, etc. Implementations are discovered automatically
 * by Spring and injected as {@code List<Actuator>} into scene strategies.
 */
public interface Actuator {

    void turnOn(String deviceName);

    void turnOff(String deviceName);

    void wakeOnLan(String deviceName);
}
