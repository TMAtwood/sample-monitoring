package com.example.monitoring.controller;

import java.util.List;
import java.util.Map;

import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import com.example.monitoring.model.Item;

@RestController
@RequestMapping("/api/items")
public class ItemsController {

    private final MeterRegistry registry;
    private final JdbcClient jdbc;
    private final RestClient restClient;

    public ItemsController(MeterRegistry registry, JdbcClient jdbc) {
        this.registry = registry;
        this.jdbc = jdbc;
        this.restClient = RestClient.create();
    }

    @GetMapping
    public List<Item> getItems() {
        registry.counter("items_processed_total", "operation", "list").increment();
        return jdbc.sql("SELECT id, name, category FROM items ORDER BY id")
                .query((rs, rowNum) -> new Item(
                        rs.getInt("id"),
                        rs.getString("name"),
                        rs.getString("category")))
                .list();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Item> getItem(@PathVariable int id) {
        registry.counter("items_processed_total", "operation", "get").increment();
        return jdbc.sql("SELECT id, name, category FROM items WHERE id = :id")
                .param("id", id)
                .query((rs, rowNum) -> new Item(
                        rs.getInt("id"),
                        rs.getString("name"),
                        rs.getString("category")))
                .optional()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Cross-service call: fetches items from Postgres, then calls FastAPI for tasks.
     * Creates a multi-hop trace: client → spring-boot-app → postgres + fastapi-app → postgres.
     */
    @GetMapping("/with-tasks")
    public Map<String, Object> getItemsWithTasks() {
        registry.counter("items_processed_total", "operation", "cross-service").increment();

        var items = jdbc.sql("SELECT id, name, category FROM items ORDER BY id")
                .query((rs, rowNum) -> new Item(
                        rs.getInt("id"),
                        rs.getString("name"),
                        rs.getString("category")))
                .list();

        // Cross-service call to FastAPI
        var tasks = restClient.get()
                .uri("http://fastapi-app:8000/api/tasks")
                .retrieve()
                .body(Object.class);

        return Map.of("items", items, "tasks", tasks);
    }
}
