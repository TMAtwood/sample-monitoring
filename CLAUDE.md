# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Prometheus monitoring stack reference architecture with 6 application services, PostgreSQL, Thanos HA, Loki logging, Tempo tracing, and a full alerting pipeline — all in a single `compose.yaml` (26 containers).

## Commands

```bash
# Start entire stack (works with docker compose too)
podman compose up -d

# Rebuild after code changes to a service
podman compose up -d --build <service-name>

# Tear down with volume cleanup
podman compose down -v

# Validate Prometheus config
podman exec prometheus-use1-1 promtool check config /etc/prometheus/prometheus.yml

# Validate alert rules
podman exec prometheus-use1-1 promtool check rules /etc/prometheus/rules/*.yml

# Check Alertmanager config
podman exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml

# Run Spring Boot tests
cd services/spring-boot-app && mvn test

# Run a single Spring Boot test
cd services/spring-boot-app && mvn test -Dtest=ItemsControllerTest
```

## Architecture

**Data flow (metrics)**: Services expose `/metrics` endpoints → two Prometheus replicas scrape them → Thanos Sidecars upload blocks to MinIO → Thanos Query provides deduplicated reads → Grafana visualizes. The Azure Function is the exception: it **pushes** to Pushgateway, which Prometheus then scrapes.

**Data flow (logs)**: All containers emit logs → Promtail discovers containers via Docker socket and ships logs → Loki stores and indexes them → Grafana queries Loki for log exploration.

**Data flow (traces)**: Application services send OTLP spans → OpenTelemetry Collector batches and exports them → Tempo stores trace data in MinIO (S3) → Grafana queries Tempo for trace exploration. Trace IDs injected into log output enable cross-signal correlation between traces and logs.

**Prometheus HA**: Both replicas use identical `prometheus/prometheus.yml`. Per-replica differentiation is NOT in the Prometheus config — it's handled by each Thanos Sidecar's `--label=replica="use1-X"` flag in `compose.yaml`. Thanos Query deduplicates by this label.

**Credential sync points**: MinIO credentials appear in five places that must match: `.env`, `thanos/objstore.yml`, `loki/loki.yml`, `tempo/tempo.yml`, and the `minio-init` service environment. If you change one, change all five. PostgreSQL credentials appear in three places: `.env` (app user + exporter password), `postgres/init.sql` (exporter user creation), and the `dotnet-app` connection string in `compose.yaml`.

**Config file → container mappings**:

- `prometheus/prometheus.yml` → mounted into both `prometheus-use1-1` and `prometheus-use1-2`
- `prometheus/rules/*.yml` → mounted into both Prometheus replicas
- `thanos/objstore.yml` → mounted into all Thanos components (sidecar, store-gateway, compactor)
- `alertmanager/alertmanager.yml` + `alertmanager/templates/` → `alertmanager` container
- `blackbox/blackbox.yml` → `blackbox-exporter` container
- `loki/loki.yml` → `loki` container
- `promtail/promtail.yml` → `promtail` container
- `tempo/tempo.yml` → `tempo` container
- `otel-collector/otel-collector.yml` → `otel-collector` container
- `postgres/init.sql` → `postgres` container (via `/docker-entrypoint-initdb.d/`)
- `grafana/provisioning/` + `grafana/dashboards/` → `grafana` container

**Container networking**: All services communicate on `monitoring-net` using container names as hostnames. Config files reference container ports (e.g., `prometheus-use1-1:9090`), not host ports. Host port mappings in `.env` only affect external access.

## Service-Specific Patterns

| Service | Language | Metrics Library | Tracing | Metrics Path | Container Port |
|---|---|---|---|---|---|
| spring-boot-app | Java 24 / Spring Boot 4 | Micrometer + Prometheus registry | OTel Java agent (auto) | `/actuator/prometheus` | 8080 |
| dotnet-app | .NET 10 | `prometheus-net.AspNetCore` | OTel .NET SDK (auto) | `/metrics` | 8080 (depends on postgres) |
| fastapi-app | Python 3.14 | `prometheus-fastapi-instrumentator` | OTel Python SDK (auto) | `/metrics` | 8000 |
| azure-func | Python | `prometheus_client` push to Pushgateway | OTel Python SDK (manual spans) | N/A (push-based) | 80 |
| react-admin-app | TypeScript / Node.js | `prom-client` | None | `/metrics` | 3001 |
| react-dashboard-app | TypeScript / Node.js | `prom-client` | None | `/metrics` | 3002 |

## Key Conventions

- **YAML everywhere**: Prometheus, Alertmanager, Blackbox, Thanos, Loki, Promtail, Grafana provisioning — all YAML. Grafana dashboards are JSON.
- **Alert rules** are split by domain: `service-alerts.yml`, `infrastructure-alerts.yml`, `blackbox-alerts.yml`, `meta-alerts.yml`, `postgres-alerts.yml`. Each rule group must have `severity: critical` or `severity: warning` labels for Alertmanager routing to work.
- **Grafana dashboards** are provisioned from files (not API). Edit JSON in `grafana/dashboards/`, then restart Grafana or wait for file watcher.
- **Blackbox probing** uses Prometheus relabeling to route through the exporter — the `relabel_configs` in `prometheus.yml` are standard boilerplate for this pattern.
- **All images are pinned** to specific versions in `.env.example`. Infrastructure images come from `quay.io`; app images are built locally from Dockerfiles.
- **Simulated failures**: All four services include intentional error/latency simulation to generate interesting monitoring data. This is by design.
