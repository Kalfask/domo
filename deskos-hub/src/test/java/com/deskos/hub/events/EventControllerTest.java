package com.deskos.hub.events;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Uses the "test" Spring profile which points at an in-memory H2 database,
 * so this test runs without a running Postgres container.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EventControllerTest {

    @Autowired
    MockMvc mvc;

    @Test
    void postArrivedReturnsAccepted() throws Exception {
        mvc.perform(post("/events/vision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"eventType":"arrived","personName":"kostas","confidence":0.72}
                                """))
                .andExpect(status().isAccepted());
    }

    @Test
    void postLeftReturnsAccepted() throws Exception {
        mvc.perform(post("/events/vision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"eventType":"left"}
                                """))
                .andExpect(status().isAccepted());
    }

    @Test
    void postEmptyEventTypeIsRejected() throws Exception {
        mvc.perform(post("/events/vision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"eventType":""}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postConfidenceOutOfRangeIsRejected() throws Exception {
        mvc.perform(post("/events/vision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"eventType":"arrived","confidence":1.5}
                                """))
                .andExpect(status().isBadRequest());
    }

    @Test
    void listReturnsSavedEvents() throws Exception {
        mvc.perform(post("/events/vision")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"eventType":"arrived","personName":"kostas","confidence":0.9}
                                """))
                .andExpect(status().isAccepted());

        mvc.perform(get("/events/vision"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventType").exists());
    }
}
