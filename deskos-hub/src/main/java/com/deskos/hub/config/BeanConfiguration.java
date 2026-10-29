package com.deskos.hub.config;

import com.deskos.hub.propertiesclass.ShellyProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class BeanConfiguration {

    @Bean
    public RestClient lightRestClient(ShellyProperties shellyProperties) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(shellyProperties.getTimeoutSec()));
        factory.setReadTimeout(Duration.ofSeconds(shellyProperties.getTimeoutSec()));

        return RestClient.builder()
                .requestFactory(factory)
                .build();
    }

}
