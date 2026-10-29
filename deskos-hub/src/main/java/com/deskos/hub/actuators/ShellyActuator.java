package com.deskos.hub.actuators;


import com.deskos.hub.propertiesclass.ShellyProperties;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@AllArgsConstructor
@Component
@Profile("!test")
@Slf4j
public class ShellyActuator implements Actuator {

    private final RestClient restClient;
    private final ShellyProperties shellyProperties;

    @Override
    public void turnOn(String deviceName) {
        String host = shellyProperties.getDevices().get(deviceName);
        restClient.get()
                .uri("http://" + host + "/rpc/Switch.Set?id=0&on=true")
                .retrieve()
                .toBodilessEntity();
    }

    @Override
    public void turnOff(String deviceName) {
        String host = shellyProperties.getDevices().get(deviceName);
        restClient.get()
                .uri("http://" + host + "/rpc/Switch.Set?id=0&on=false")
                .retrieve()
                .toBodilessEntity();
    }

    @Override
    public void wakeOnLan(String deviceName) {
        log.info("Waking on Lan not supported yet");
    }
}
