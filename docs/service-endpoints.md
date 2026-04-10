# Service Endpoints Reference

All services are accessible from your browser at `localhost` on the host ports listed below. These ports are configured in `.env` and mapped to internal container ports via `compose.yaml`.

> **Note:** Container hostnames like `fastapi-app:8000` only work inside the Docker network (`monitoring-net`). From your browser, always use `localhost` with the host port.

---

## Application Services

| Service | URL | Description |
|---|---|---|
| React Dashboard | [http://localhost:8086](http://localhost:8086) | ShadCN/UI + TanStack investment dashboard. Login: `thomas.atwood@geodecapital.com` / `demo12345` |
| React Admin | [http://localhost:8085](http://localhost:8085) | React Admin portfolio manager with full CRUD. Same login credentials. |
| Spring Boot | [http://localhost:8081](http://localhost:8081) | Java 24 / Spring Boot 4 items API |
| .NET | [http://localhost:8082](http://localhost:8082) | .NET 10 orders API |
| FastAPI | [http://localhost:8083](http://localhost:8083) | Python 3.14 tasks API |
| Azure Function | [http://localhost:8084](http://localhost:8084) | Python Azure Function (push-based metrics) |

### Application Health & Metrics Endpoints

Every application service exposes monitoring endpoints. The table below shows the full set for each:

| Endpoint | Spring Boot | .NET | FastAPI | React Admin | React Dashboard |
|---|---|---|---|---|---|
| **Metrics** | `/actuator/prometheus` | `/metrics` | `/metrics` | `/metrics` | `/metrics` |
| **Health (all)** | `/actuator/health` | `/health` | `/health` | `/healthz` | `/healthz` |
| **Liveness** | — | `/health/live` | `/health/live` | `/live` | `/live` |
| **Readiness** | — | `/health/ready` | `/health/ready` | `/ready` | `/ready` |
| **API docs** | — | — | `/docs` (Swagger UI) | — | — |

#### Quick-test commands

```bash
# FastAPI — Swagger UI (open in browser)
open http://localhost:8083/docs

# FastAPI — structured health checks
curl -s http://localhost:8083/health/live | jq .
curl -s http://localhost:8083/health/ready | jq .

# .NET — structured health checks
curl -s http://localhost:8082/health/live | jq .
curl -s http://localhost:8082/health/ready | jq .

# React Dashboard — readiness with real Postgres check
curl -s http://localhost:8086/ready | jq .

# React Admin — readiness with real Postgres check
curl -s http://localhost:8085/ready | jq .

# Spring Boot — actuator health
curl -s http://localhost:8081/actuator/health | jq .

# Any service — raw Prometheus metrics
curl -s http://localhost:8083/metrics | head -30
```

#### Cross-service trace endpoints

These endpoints trigger multi-hop requests across services, generating distributed traces visible in Grafana/Tempo:

```bash
# .NET → Spring Boot (dotnet queries Postgres, then calls spring-boot, which queries Postgres)
curl -s http://localhost:8082/api/orders/with-items | jq .

# Spring Boot → FastAPI (spring-boot queries Postgres, then calls fastapi, which queries Postgres)
curl -s http://localhost:8081/api/items/with-tasks | jq .

# FastAPI → .NET (fastapi queries Postgres, then calls dotnet, which queries Postgres)
curl -s http://localhost:8083/api/tasks/with-orders | jq .
```

---

## Visualization & Querying

| Service | URL | Login | Description |
|---|---|---|---|
| Grafana | [http://localhost:3000](http://localhost:3000) | `admin` / `admin` | Dashboards, Explore (metrics, logs, traces), alerting, service graph |
| Thanos Query | [http://localhost:9090](http://localhost:9090) | None | PromQL query UI with deduplicated view across both Prometheus replicas |

### Grafana Datasources (pre-configured)

| Datasource | Type | What it queries |
|---|---|---|
| Thanos | Prometheus | Deduplicated metrics from both Prometheus replicas via Thanos Query |
| Prometheus-use1-1 | Prometheus | Direct access to replica 1 |
| Prometheus-use1-2 | Prometheus | Direct access to replica 2 |
| Loki | Loki | Container logs collected by Promtail |
| Tempo | Tempo | Distributed traces from all OTel-instrumented services |
| Alertmanager | Alertmanager | Active alerts and silences |

---

## Prometheus & Alerting

| Service | URL | Description |
|---|---|---|
| Prometheus Replica 1 | [http://localhost:9081](http://localhost:9081) | PromQL UI, targets status, rule evaluation, service discovery |
| Prometheus Replica 2 | [http://localhost:9082](http://localhost:9082) | Independent second replica — same config, same targets |
| Alertmanager | [http://localhost:9093](http://localhost:9093) | Active/resolved alerts, silence management, routing tree visualization |
| MailHog | [http://localhost:8025](http://localhost:8025) | Email inbox catching all alert notifications — verify the alert pipeline end to end |

### Useful Prometheus pages

| Page | URL |
|---|---|
| Targets (scrape status) | [http://localhost:9081/targets](http://localhost:9081/targets) |
| Rules (alert rule evaluation) | [http://localhost:9081/rules](http://localhost:9081/rules) |
| Alerts (firing alerts) | [http://localhost:9081/alerts](http://localhost:9081/alerts) |
| Config | [http://localhost:9081/config](http://localhost:9081/config) |
| Service Discovery | [http://localhost:9081/service-discovery](http://localhost:9081/service-discovery) |

---

## Infrastructure Exporters & Probes

| Service | URL | Description |
|---|---|---|
| Blackbox Exporter | [http://localhost:9115](http://localhost:9115) | Homepage shows recent probe results. Probes HTTP and TCP endpoints for availability. |
| Postgres Exporter | [http://localhost:9187/metrics](http://localhost:9187/metrics) | Raw Postgres metrics (connections, row counts, locks, replication) in Prometheus format |
| Pushgateway | [http://localhost:9091](http://localhost:9091) | Shows metrics pushed by the Azure Function. Web UI lists all pushed metric groups. |

### Blackbox Exporter — manual probe test

You can manually trigger a probe from your browser:

```
http://localhost:9115/probe?target=http://fastapi-app:8000/health&module=http_2xx
```

---

## Logging & Tracing Infrastructure

| Service | URL | Description |
|---|---|---|
| Loki | [http://localhost:3100/ready](http://localhost:3100/ready) | Log aggregation backend — no web UI, but `/ready`, `/metrics`, and `/config` endpoints work |
| Promtail | [http://localhost:9080/targets](http://localhost:9080/targets) | Shows which containers Promtail has auto-discovered and is actively tailing |
| Tempo | [http://localhost:3200/status](http://localhost:3200/status) | Trace storage backend — status page, plus `/api/search` for programmatic trace queries |
| OTel Collector | [http://localhost:4318](http://localhost:4318) | OTLP HTTP receiver (services send traces here). Health check at internal port 13133. |

### Useful Promtail & Tempo pages

| Page | URL |
|---|---|
| Promtail targets | [http://localhost:9080/targets](http://localhost:9080/targets) |
| Promtail metrics | [http://localhost:9080/metrics](http://localhost:9080/metrics) |
| Tempo status | [http://localhost:3200/status](http://localhost:3200/status) |
| Tempo search API | `curl -s "http://localhost:3200/api/search?limit=10" \| jq .` |

---

## Object Storage

| Service | URL | Login | Description |
|---|---|---|---|
| MinIO Console | [http://localhost:9001](http://localhost:9001) | `thanos` / `changeme` | S3-compatible object storage browser. Browse the buckets to see Thanos metric blocks, Tempo trace data, and Loki chunks stored as objects. |
| MinIO API | [http://localhost:9000](http://localhost:9000) | — | S3 API endpoint (used by Thanos, Tempo, Loki internally) |

### MinIO Buckets

| Bucket | Used by | Contents |
|---|---|---|
| `thanos-data` | Thanos Sidecars, Store Gateway, Compactor | Prometheus TSDB blocks for long-term metric retention |
| `tempo-data` | Tempo | Trace data blocks |
| `loki-data` | Loki | Log chunk data and indexes |

---

## Database

| Service | URL | Description |
|---|---|---|
| PostgreSQL | `localhost:5432` | Not a web UI — connect with `psql` or any SQL client. Database: `orders_db`, User: `orders_app`, Password: `changeme` |

```bash
# Connect via psql
psql -h localhost -p 5432 -U orders_app -d orders_db

# Quick table check
psql -h localhost -p 5432 -U orders_app -d orders_db -c "\dt"
```

---

## Port Map Summary

| Port | Service |
|---|---|
| 3000 | Grafana |
| 3100 | Loki |
| 3200 | Tempo |
| 4317 | OTel Collector (gRPC) |
| 4318 | OTel Collector (HTTP) |
| 5432 | PostgreSQL |
| 8025 | MailHog (email UI) |
| 8081 | Spring Boot app |
| 8082 | .NET app |
| 8083 | FastAPI app |
| 8084 | Azure Function |
| 8085 | React Admin app |
| 8086 | React Dashboard app |
| 9000 | MinIO API |
| 9001 | MinIO Console |
| 9080 | Promtail |
| 9081 | Prometheus Replica 1 |
| 9082 | Prometheus Replica 2 |
| 9090 | Thanos Query |
| 9091 | Pushgateway |
| 9093 | Alertmanager |
| 9115 | Blackbox Exporter |
| 9187 | Postgres Exporter |
| 1025 | MailHog (SMTP — not a web UI) |
