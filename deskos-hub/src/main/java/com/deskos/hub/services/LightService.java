package com.deskos.hub.services;

import com.deskos.hub.propertiesclass.ShellyProperties;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class LightService {

    private final RestClient restClient;
    private final ShellyProperties shellyProperties;

    public LightService(RestClient restClient, ShellyProperties shellyProperties) {
        this.restClient = restClient;
        this.shellyProperties = shellyProperties;
    }

    public void toggleLight(String deviceName) {
        String host = shellyProperties.getDevices().get(deviceName);

        restClient.get()
                .uri("http://" + host + "/rpc/Switch.Toggle?id=0")
                .retrieve()
                .toBodilessEntity();
    }
}
