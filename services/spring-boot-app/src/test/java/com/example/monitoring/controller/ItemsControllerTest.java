package com.example.monitoring.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ItemsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void getItems_returnsOk() throws Exception {
        mockMvc.perform(get("/api/items"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(6));
    }

    @Test
    void getItem_returnsOk() throws Exception {
        mockMvc.perform(get("/api/items/1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Prometheus Server"));
    }

    @Test
    void getItem_notFound() throws Exception {
        mockMvc.perform(get("/api/items/999"))
            .andExpect(status().isNotFound());
    }

    @Test
    void healthEndpoint_returnsOk() throws Exception {
        mockMvc.perform(get("/actuator/health"))
            .andExpect(status().isOk());
    }

    @Test
    void prometheusEndpoint_returnsMetrics() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
            .andExpect(status().isOk())
            .andExpect(content().string(org.hamcrest.Matchers.containsString("jvm_")));
    }
}
