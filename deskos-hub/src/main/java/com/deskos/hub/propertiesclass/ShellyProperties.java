package com.deskos.hub.propertiesclass;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Map;

@ConfigurationProperties(prefix = "shelly")
@Data
public class ShellyProperties {
    Map<String,String> devices;
    int timeoutSec;
}
