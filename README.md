# Prometheus Monitoring Stack Reference Architecture

A production-grade reference architecture demonstrating a complete Prometheus monitoring stack with four application services, Thanos HA, and a full alerting pipeline — all orchestrated via a single `compose.yaml`.

## Quick Start

```bash
# 1. Create your .env from the template
cp .env.example .env
# Edit .env to change default credentials if desired

# 2. Start the entire stack
podman compose up -d

# 3. Open Grafana
open http://localhost:3000   # admin / changeme (or your .env values)
```

To tear everything down:

```bash
podman compose down -v   # -v removes named volumes
```

> Works with Docker Compose as well — replace `podman` with `docker`.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Application Services                          │
│  ┌──────────────┐ ┌──────────┐ ┌────────────┐ ┌────────────────────┐ │
│  │ Spring Boot 4│ │ .NET 10  │ │  FastAPI   │ │  Azure Function    │ │
│  │  :8081       │ │  :8082   │ │  :8083     │ │  :8084             │ │
│  │  /actuator/  │ │ /metrics │ │ /metrics   │ │  push → Pushgateway│ │
│  │  prometheus  │ │          │ │            │ │                    │ │
│  └──────┬───────┘ └────┬─────┘ └─────┬──────┘ └────────┬───────────┘ │
│         │              │             │                 │             │
│         └──────────────┼─────────────┘                 │             │
│                   scrape (pull)                    push (POST)       │
└────────────────────────┼───────────────────────────────┼─────────────┘
                         │                               │
┌────────────────────────▼───────────────────────────────▼─────────────┐
│                     Monitoring Infrastructure                        │
│                                                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────┐     │
│  │ Prometheus      │  │ Prometheus      │  │   Pushgateway     │     │
│  │ use1-1  :9081   │  │ use1-2  :9082   │  │     :9091         │     │
│  │ + Thanos Sidecar│  │ + Thanos Sidecar│  └───────────────────┘     │
│  └────────┬────────┘  └────────┬────────┘                            │
│           │                    │                                     │
│           ▼                    ▼                                     │
│  ┌─────────────────────────────────────────┐                         │
│  │           Thanos Query  :9090           │  ← Grafana queries      │
│  │   (deduplicates by replica label)       │     this endpoint       │
│  └──────────────────┬──────────────────────┘                         │
│                     │                                                │
│  ┌──────────────────▼──────────────────────┐                         │
│  │        Thanos Store Gateway             │                         │
│  │        (reads from MinIO)               │                         │
│  └──────────────────┬──────────────────────┘                         │
│                     │                                                │
│  ┌──────────────────▼──────────────────────┐  ┌──────────────────┐   │
│  │          MinIO  :9000/:9001             │  │ Thanos Compactor │   │
│  │          (S3-compatible object store)   │  │ (downsampling)   │   │
│  └─────────────────────────────────────────┘  └──────────────────┘   │
│                                                                      │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────┐   │
│  │ Alertmanager     │  │ Blackbox Exporter │  │    Mailhog       │   │
│  │    :9093         │  │    :9115          │  │    :8025 (UI)    │   │
│  └──────────────────┘  └───────────────────┘  └──────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                    Grafana  :3000                            │    │
│  │   8 pre-built dashboards, 4 datasources                      │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

## Application Services

| Service | Stack | Metrics Approach | Endpoints |
|---|---|---|---|
| **spring-boot-app** | Java 24, Spring Boot 4 | OpenTelemetry SDK → Prometheus exporter | `/actuator/health`, `/actuator/prometheus`, `/api/items`, `/api/items/{id}` |
| **dotnet-app** | .NET 10, ASP.NET Core Web API | `prometheus-net.AspNetCore` | `/health`, `/metrics`, `/api/orders`, `/api/orders/{id}` |
| **fastapi-app** | Python 3.14, FastAPI | `prometheus-fastapi-instrumentator` | `/health`, `/metrics`, `/api/tasks`, `/api/tasks/{id}` |
| **azure-func** | Python, Azure Functions v4 | `prometheus_client` push → Pushgateway | `/api/process` (HTTP trigger) |

Each service includes simulated behaviors for realistic monitoring:

- **Spring Boot**: Custom OTel counter (`items_processed_total`)
- **.NET**: Simulated latency (10–200ms), degraded health checks (2% unhealthy, 8% degraded)
- **FastAPI**: ~5% error rate, custom gauge (`fastapi_active_background_jobs`)
- **Azure Function**: ~5% error rate, push-based metrics via Pushgateway

## Monitoring Infrastructure

### Prometheus HA

Two identical Prometheus replicas scrape all targets. Both share the same `prometheus.yml` with `external_labels: { region: use1 }`. Per-replica differentiation is handled by each Thanos Sidecar's `--label=replica="use1-X"` flag.

- 15-second scrape interval
- 2-hour local retention (Thanos handles long-term storage)
- TSDB block duration locked to 2h for Thanos upload compatibility

### Thanos

| Component | Purpose |
|---|---|
| **Sidecar** (x2) | Uploads TSDB blocks to MinIO, serves Store API for real-time data |
| **Query** | Fanout across sidecars + Store Gateway, deduplicates by `replica` label |
| **Store Gateway** | Reads historical blocks from MinIO for long-term queries |
| **Compactor** | Compacts and downsamples blocks in MinIO (singleton) |

### Object Storage (MinIO)

MinIO provides S3-compatible object storage. The `thanos/objstore.yml` includes commented-out examples for swapping to:

- **AWS S3**
- **Azure Blob Storage**
- **Google Cloud Storage**

### Alerting Pipeline

```
Prometheus → Alertmanager → Mailhog (SMTP)
```

- **Critical alerts**: 1-minute group wait, 1-hour repeat
- **Warning alerts**: 5-minute group wait, 4-hour repeat
- **Inhibition**: Critical alerts silence related warnings on the same `alertname`/`job`
- **Mailhog UI** at `http://localhost:8025` captures all alert emails

### Blackbox Exporter

External probing of service health:

- **HTTP probes**: Spring Boot, .NET, FastAPI, Grafana health endpoints
- **TCP probes**: Both Prometheus replicas, Grafana

## Alert Rules

### Service Alerts (`service-alerts.yml`)

| Alert | Condition | Severity |
|---|---|---|
| ServiceDown | `up == 0` for 1m | critical |
| HighErrorRate | >5% HTTP 5xx over 5m | warning |
| HighLatencyP99 | p99 > 1s over 5m | warning |
| HighLatencyP99Critical | p99 > 5s over 5m | critical |
| TooManyInFlightRequests | in-flight > threshold for 2m | warning |

### Infrastructure Alerts (`infrastructure-alerts.yml`)

| Alert | Condition | Severity |
|---|---|---|
| ContainerRestarting | restart count > 3 in 10m | warning |
| HighMemoryUsage | memory > 80% limit for 5m | warning |
| HighCpuUsage | CPU > 80% for 5m | warning |
| PushgatewayStaleMetrics | last push > 2m ago | warning |

### Blackbox Alerts (`blackbox-alerts.yml`)

| Alert | Condition | Severity |
|---|---|---|
| EndpointDown | `probe_success == 0` for 1m | critical |
| SlowEndpoint | probe duration > 2s for 5m | warning |
| SSLCertExpiringSoon | cert expiry < 30 days | warning |
| DNSResolutionFailure | DNS lookup fails | critical |

### Meta-Monitoring Alerts (`meta-alerts.yml`)

| Alert | Condition | Severity |
|---|---|---|
| PrometheusTargetDown | infrastructure target `up == 0` for 2m | critical |
| PrometheusScrapeErrors | scrape error rate > 10% over 5m | warning |
| ThanosCompactHalted | compactor not running for 10m | critical |
| ThanosQueryGrpcErrors | gRPC error rate > 5% over 5m | warning |
| AlertmanagerDown | unreachable for 1m | critical |

## Port Map

| Service | Container Port | Host Port |
|---|---|---|
| spring-boot-app | 8080 | **8081** |
| dotnet-app | 8080 | **8082** |
| fastapi-app | 8000 | **8083** |
| azure-func | 80 | **8084** |
| prometheus-use1-1 | 9090 | **9081** |
| prometheus-use1-2 | 9090 | **9082** |
| thanos-query | 9090 | **9090** |
| pushgateway | 9091 | **9091** |
| alertmanager | 9093 | **9093** |
| blackbox-exporter | 9115 | **9115** |
| grafana | 3000 | **3000** |
| minio (API) | 9000 | **9000** |
| minio (console) | 9001 | **9001** |
| mailhog (SMTP) | 1025 | **1025** |
| mailhog (UI) | 8025 | **8025** |

All ports are configurable via `.env`. Thanos Sidecars, Store Gateway, and Compactor are internal only.

## Grafana Dashboards

Eight pre-provisioned dashboards are available immediately on startup:

| Dashboard | Description |
|---|---|
| **Overview** | All services at a glance — up/down status, request rates, error rates |
| **Spring Boot** | JVM memory, GC, thread counts, HTTP metrics, custom OTel counters |
| **.NET** | Request rate, latency histograms, health check status, order metrics |
| **FastAPI** | HTTP metrics, error rate, active background jobs gauge |
| **Azure Function** | Invocation count, duration histogram, error count (via Pushgateway) |
| **Infrastructure** | Prometheus, Thanos, MinIO, Pushgateway health and performance |
| **Blackbox** | Probe success/failure, response times, SSL certificate expiry |
| **Alerts** | Active and historical alerts from Alertmanager |

**Datasources** (auto-provisioned):

- Thanos Query (default) — deduplicated, global view
- Prometheus use1-1 — direct replica access
- Prometheus use1-2 — direct replica access
- Alertmanager — alert state queries

## Project Structure

```
sample-monitoring/
├── compose.yaml                  # All 18 services in one file
├── .env.example                  # Environment template (copy to .env)
├── .gitignore
├── services/
│   ├── spring-boot-app/          # Java 24, Spring Boot 4, OTel SDK
│   │   ├── Dockerfile
│   │   ├── pom.xml
│   │   └── src/
│   ├── dotnet-app/               # .NET 10, ASP.NET Core Web API
│   │   ├── Dockerfile
│   │   ├── DotnetApp.csproj
│   │   ├── Program.cs
│   │   ├── Controllers/
│   │   ├── Models/
│   │   └── Health/
│   ├── fastapi-app/              # Python 3.14, FastAPI
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   └── app/
│   └── azure-func/               # Python, Azure Functions v4
│       ├── Dockerfile
│       ├── function_app.py
│       ├── host.json
│       └── requirements.txt
├── prometheus/
│   ├── prometheus.yml            # Shared config for both replicas
│   └── rules/
│       ├── service-alerts.yml
│       ├── infrastructure-alerts.yml
│       ├── blackbox-alerts.yml
│       └── meta-alerts.yml
├── thanos/
│   └── objstore.yml              # S3-compatible config (MinIO default)
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
│   └── init.sh                   # Bucket auto-creation
└── docs/
    └── plans/
        ├── 2026-02-25-monitoring-stack-design.md
        └── 2026-02-25-monitoring-stack-plan.md
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
|---|---|---|
| `MINIO_ROOT_USER` | `thanos` | MinIO access key (must match `thanos/objstore.yml`) |
| `MINIO_ROOT_PASSWORD` | `changeme` | MinIO secret key (must match `thanos/objstore.yml`) |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin username |
| `GRAFANA_ADMIN_PASSWORD` | `changeme` | Grafana admin password |
| `REGION` | `use1` | Region label applied to all Prometheus metrics |
| `*_PORT` | various | Host port mappings (see [Port Map](#port-map)) |
| `*_VERSION` | pinned | Image tags for all infrastructure components |

### Swapping Object Storage

Edit `thanos/objstore.yml` — commented examples for AWS S3, Azure Blob, and GCS are included. Credentials in this file must match your `.env` if using MinIO.

## Validation

After starting the stack, verify everything is working:

```bash
# Application health checks
curl -s http://localhost:8081/actuator/health   # Spring Boot
curl -s http://localhost:8082/health            # .NET
curl -s http://localhost:8083/health            # FastAPI
curl -s http://localhost:8084/api/process       # Azure Function

# Metrics endpoints
curl -s http://localhost:8081/actuator/prometheus | head -3
curl -s http://localhost:8082/metrics | head -3
curl -s http://localhost:8083/metrics | head -3
curl -s http://localhost:9091/metrics | grep azure   # Pushgateway

# Prometheus targets (via replica 1)
curl -s http://localhost:9081/api/v1/targets | python3 -c "
import json, sys
data = json.load(sys.stdin)
for t in data['data']['activeTargets']:
    print(f\"{t['labels'].get('job','?'):30s} {t['health']}\")"

# Thanos Query (deduplicated view)
curl -s 'http://localhost:9090/api/v1/query?query=up' | python3 -m json.tool

# Alertmanager status
curl -s http://localhost:9093/api/v2/status | python3 -m json.tool

# Grafana dashboards
curl -s -u admin:changeme http://localhost:3000/api/search | python3 -m json.tool

# Blackbox probes via Prometheus
curl -s 'http://localhost:9081/api/v1/query?query=probe_success' | python3 -m json.tool

# Mailhog (should receive alerts if any are firing)
curl -s http://localhost:8025/api/v2/messages
```

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Audience | Reference architecture | Production-oriented configs, not a tutorial |
| Object storage | MinIO (pluggable to cloud) | Self-contained, documented swap to Azure Blob/S3/GCS |
| Prometheus HA | 2 replicas + Thanos Sidecar | Standard Thanos HA with query-time deduplication |
| Naming convention | Region-based (`use1`) | Mimics single Azure region deployment |
| Alerting | Alertmanager + Grafana + Mailhog | Full pipeline with email notification |
| Spring Boot metrics | OpenTelemetry SDK | Industry direction, vendor-neutral |
| .NET app style | ASP.NET Core Web API with controllers | Enterprise-representative |
| Compose approach | Single flat `compose.yaml` | Simplest to reason about and run |

See [Design Document](docs/plans/2026-02-25-monitoring-stack-design.md) and [Implementation Plan](docs/plans/2026-02-25-monitoring-stack-plan.md) for full details.

## Prerequisites

- **Podman** (or Docker) with Compose v2
- ~4 GB RAM for the full stack (18 containers)
- Ports listed in the [Port Map](#port-map) must be available on the host

## License

This is a reference architecture for educational and demonstration purposes.
