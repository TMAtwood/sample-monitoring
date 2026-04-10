# Monitoring Stack Reference Architecture — Design Document

**Date:** 2026-02-25
**Purpose:** Reference architecture demonstrating a production-grade Prometheus monitoring stack with multiple application services, Thanos HA, and full alerting pipeline.
**Approach:** Single flat `compose.yaml` orchestrating all services via Podman Compose.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Audience | Reference architecture | Production-oriented configs, not a tutorial |
| Object storage | MinIO (default), pluggable to cloud | Self-contained, documented swap to Azure Blob/S3/GCS |
| Prometheus HA | 2 replicas + Thanos Sidecar | Standard Thanos HA with query-time deduplication |
| Naming convention | Region-based (`use1`) | Mimics single Azure region deployment |
| Alerting | Alertmanager + Grafana + Mailhog | Full pipeline with email notification |
| Azure Function runtime | Local container, latest official Python image | Cloud deployment documented separately |
| Spring Boot metrics | OpenTelemetry SDK → Prometheus exporter | Industry direction, vendor-neutral |
| .NET app style | ASP.NET Core Web API with controllers | Enterprise-representative |
| Compose approach | Single flat `compose.yaml` | Simplest to reason about and run |

## Application Services

### Spring Boot 4 — `spring-boot-app`

- Java 24, Spring Boot 4
- OpenTelemetry SDK with `opentelemetry-exporter-prometheus`
- Auto-instruments HTTP server metrics, JVM memory, GC, thread counts
- Endpoints: `/actuator/health`, `/actuator/prometheus`, `/api/items`, `/api/items/{id}`
- Custom OTel counter for "items processed"

### .NET 10 — `dotnet-app`

- ASP.NET Core Web API with controllers
- `prometheus-net.AspNetCore` for metrics
- Endpoints: `/health`, `/metrics`, `/api/orders`, `/api/orders/{id}`
- Simulated latency for histogram data
- Health check includes simulated dependency check (degraded states)

### FastAPI — `fastapi-app`

- Python 3.14, FastAPI
- `prometheus-fastapi-instrumentator` for automatic HTTP metrics
- Endpoints: `/health`, `/metrics`, `/api/tasks`, `/api/tasks/{id}`
- Simulated ~5% error rate to trigger alert rules
- Custom gauge for "active background jobs"

### Azure Function — `azure-func`

- Python (latest supported by Azure Functions runtime v4), Azure Functions Core Tools
- `prometheus_client` in push mode → Pushgateway
- Timer-triggered function pushes metrics every 30s (invocation count, duration histogram, error count)
- HTTP-triggered function at `/api/process`
- No `/metrics` endpoint — demonstrates Pushgateway pattern for ephemeral workloads
- Upgrade path to Python 3.14 documented when official base image is available

## Monitoring Infrastructure

### Prometheus HA

- `prometheus-use1-1` and `prometheus-use1-2` — identical config, both scrape all targets
- `external_labels`: `region: use1`, `replica: use1-1` / `replica: use1-2`
- Thanos Sidecar on each replica uploads TSDB blocks to MinIO and serves Store API
- 15s scrape interval, 2h local retention (Thanos handles long-term)

### Thanos Components

| Component | Role |
|---|---|
| Thanos Sidecar (x2) | Uploads blocks to MinIO, serves Store API for real-time data |
| Thanos Query | Fanout across sidecars + Store Gateway, deduplicates by `replica` label |
| Thanos Store Gateway | Reads historical blocks from MinIO |
| Thanos Compactor | Compacts and downsamples blocks in MinIO (singleton) |

### MinIO

- Single instance, bucket `thanos-data` auto-created on startup
- `objstore.yml` with S3-compatible config
- Comments documenting swap to Azure Blob / S3 / GCS

### Pushgateway

- Receives metrics from Azure Function
- Scraped by both Prometheus replicas
- `honor_labels: true` to preserve job/instance labels

### Blackbox Exporter

- HTTP probes against all four application health endpoints
- TCP probes against Prometheus and Grafana
- Configurable timeout and interval

### Alertmanager

- Single instance
- Routes: critical (1m group wait) and warning (5m group wait) → Mailhog email
- Inhibition: critical silences related warnings
- Custom email templates

### Mailhog

- SMTP on port 1025, web UI on port 8025

### Grafana

- Provisioned datasources: Thanos Query (primary), both Prometheus replicas, Alertmanager
- Pre-built dashboards: Overview, per-service (x4), Infrastructure, Blackbox, Alerts

## Alert Rules

### `service-alerts.yml`

| Alert | Condition | Severity |
|---|---|---|
| ServiceDown | `up == 0` for 1m | critical |
| HighErrorRate | >5% HTTP 5xx over 5m | warning |
| HighLatencyP99 | p99 > 1s over 5m | warning |
| HighLatencyP99Critical | p99 > 5s over 5m | critical |
| TooManyInFlightRequests | in-flight > threshold for 2m | warning |

### `infrastructure-alerts.yml`

| Alert | Condition | Severity |
|---|---|---|
| ContainerRestarting | restart count > 3 in 10m | warning |
| HighMemoryUsage | memory > 80% limit for 5m | warning |
| HighCpuUsage | CPU > 80% for 5m | warning |
| PushgatewayStaleMetrics | last push > 2m ago | warning |

### `blackbox-alerts.yml`

| Alert | Condition | Severity |
|---|---|---|
| EndpointDown | probe_success == 0 for 1m | critical |
| SlowEndpoint | probe_duration > 2s for 5m | warning |
| SSLCertExpiringSoon | cert expiry < 30 days | warning |
| DNSResolutionFailure | DNS lookup fails | critical |

### `meta-alerts.yml`

| Alert | Condition | Severity |
|---|---|---|
| PrometheusTargetDown | `up == 0` for any target, 2m | critical |
| PrometheusScrapeErrors | scrape error rate > 10% over 5m | warning |
| ThanosCompactHalted | compactor not running for 10m | critical |
| ThanosQueryGrpcErrors | gRPC error rate > 5% over 5m | warning |
| AlertmanagerDown | unreachable for 1m | critical |

## Networking & Port Mapping

All services on bridge network `monitoring-net`.

| Service | Container Port | Host Port |
|---|---|---|
| spring-boot-app | 8080 | 8081 |
| dotnet-app | 8080 | 8082 |
| fastapi-app | 8000 | 8083 |
| azure-func | 80 | 8084 |
| prometheus-use1-1 | 9090 | 9081 |
| prometheus-use1-2 | 9090 | 9082 |
| thanos-query | 9090 | 9090 |
| thanos-sidecar-use1-1 | 10901 | internal |
| thanos-sidecar-use1-2 | 10901 | internal |
| thanos-store-gateway | 10901 | internal |
| thanos-compactor | 10902 | internal |
| pushgateway | 9091 | 9091 |
| alertmanager | 9093 | 9093 |
| blackbox-exporter | 9115 | 9115 |
| grafana | 3000 | 3000 |
| minio | 9000/9001 | 9000/9001 |
| mailhog | 1025/8025 | 1025/8025 |

## Directory Structure

```
sample-monitoring/
├── compose.yaml
├── .env
├── services/
│   ├── spring-boot-app/
│   │   ├── Dockerfile
│   │   ├── pom.xml
│   │   └── src/
│   ├── dotnet-app/
│   │   ├── Dockerfile
│   │   ├── DotnetApp.csproj
│   │   └── ...
│   ├── fastapi-app/
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── app/
│   └── azure-func/
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── host.json
│       └── function_app.py
├── prometheus/
│   ├── prometheus.yml
│   └── rules/
│       ├── service-alerts.yml
│       ├── infrastructure-alerts.yml
│       ├── blackbox-alerts.yml
│       └── meta-alerts.yml
├── thanos/
│   ├── objstore.yml
│   └── query.yml
├── alertmanager/
│   ├── alertmanager.yml
│   └── templates/
│       └── email.tmpl
├── blackbox/
│   └── blackbox.yml
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── datasources.yml
│   │   └── dashboards/
│   │       └── dashboards.yml
│   └── dashboards/
│       ├── overview.json
│       ├── spring-boot.json
│       ├── dotnet.json
│       ├── fastapi.json
│       ├── azure-func.json
│       ├── infrastructure.json
│       ├── blackbox.json
│       └── alerts.json
├── minio/
│   └── init.sh
└── docs/
    └── plans/
```
