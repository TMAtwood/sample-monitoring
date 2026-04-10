# Monitoring Stack Reference Architecture — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-grade Prometheus monitoring stack with four application services, Thanos HA, full alerting, and Grafana dashboards — all running in Podman Compose.

**Architecture:** Two Prometheus replicas (use1 region) with Thanos Sidecars uploading to MinIO, Thanos Query for deduplication, Alertmanager routing to Mailhog email, Blackbox Exporter for probe-based monitoring, Pushgateway for the Azure Function, and Grafana for visualization. Four sample apps (Spring Boot 4, .NET 10, FastAPI, Azure Function) each expose metrics in Prometheus format.

**Tech Stack:** Podman Compose, Prometheus, Thanos, MinIO, Alertmanager, Grafana, Blackbox Exporter, Pushgateway, Mailhog, Spring Boot 4 (Java 24 / OTel), ASP.NET Core 10, FastAPI (Python 3.14), Azure Functions (Python)

**Design Doc:** `docs/plans/2026-02-25-monitoring-stack-design.md`

---

## Phase 1: Foundation

### Task 1: Project Scaffolding

**Files:**

- Create: `.gitignore`
- Create: `.env`
- Create: `compose.yaml` (skeleton)
- Create: directory structure

**Step 1: Create `.gitignore`**

```gitignore
# Build artifacts
services/spring-boot-app/target/
services/dotnet-app/bin/
services/dotnet-app/obj/

# Python
__pycache__/
*.pyc
.venv/

# IDE
.idea/
.vs/
.vscode/
*.swp

# Data volumes (created at runtime)
data/

# OS
.DS_Store
Thumbs.db
```

**Step 2: Create `.env`**

```env
# ── Image Tags ──────────────────────────────────────────
PROMETHEUS_VERSION=v3.2.1
THANOS_VERSION=v0.37.2
ALERTMANAGER_VERSION=v0.28.1
GRAFANA_VERSION=11.5.2
BLACKBOX_VERSION=v0.26.0
PUSHGATEWAY_VERSION=v1.11.0
MINIO_VERSION=RELEASE.2025-02-18T16-25-55Z
MAILHOG_VERSION=v1.0.1

# ── MinIO Credentials ──────────────────────────────────
MINIO_ROOT_USER=thanos
MINIO_ROOT_PASSWORD=thanospassword
MINIO_BUCKET=thanos-data

# ── Host Ports ──────────────────────────────────────────
SPRING_BOOT_PORT=8081
DOTNET_PORT=8082
FASTAPI_PORT=8083
AZURE_FUNC_PORT=8084
PROMETHEUS_USE1_1_PORT=9081
PROMETHEUS_USE1_2_PORT=9082
THANOS_QUERY_PORT=9090
PUSHGATEWAY_PORT=9091
ALERTMANAGER_PORT=9093
BLACKBOX_PORT=9115
GRAFANA_PORT=3000
MINIO_API_PORT=9000
MINIO_CONSOLE_PORT=9001
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

# ── Region / Replica Labels ────────────────────────────
REGION=use1
```

**Step 3: Create `compose.yaml` skeleton**

```yaml
# Monitoring Stack Reference Architecture
# Usage: podman compose up -d
# Docs:  docs/plans/2026-02-25-monitoring-stack-design.md

networks:
  monitoring-net:
    driver: bridge

volumes:
  prometheus-use1-1-data:
  prometheus-use1-2-data:
  minio-data:
  grafana-data:

services:
  # ════════════════════════════════════════════════════════
  # APPLICATION SERVICES
  # ════════════════════════════════════════════════════════

  # Populated in Phase 4

  # ════════════════════════════════════════════════════════
  # MONITORING INFRASTRUCTURE
  # ════════════════════════════════════════════════════════

  # Populated in Phases 2-3

  # ════════════════════════════════════════════════════════
  # VISUALIZATION
  # ════════════════════════════════════════════════════════

  # Populated in Phase 5
```

**Step 4: Create directory structure**

```bash
mkdir -p services/{spring-boot-app,dotnet-app,fastapi-app,azure-func}
mkdir -p prometheus/rules
mkdir -p thanos
mkdir -p alertmanager/templates
mkdir -p blackbox
mkdir -p grafana/provisioning/{datasources,dashboards}
mkdir -p grafana/dashboards
mkdir -p minio
```

**Step 5: Commit**

```bash
git add .gitignore .env compose.yaml services/ prometheus/ thanos/ alertmanager/ blackbox/ grafana/ minio/
git commit -m "scaffold: project structure, .env, and compose skeleton"
```

---

### Task 2: MinIO Object Storage

**Files:**

- Create: `minio/init.sh`
- Modify: `compose.yaml` (add minio + minio-init services)

**Step 1: Create `minio/init.sh`**

This script runs as a one-shot init container to create the Thanos bucket.

```bash
#!/bin/sh
set -e

# Wait for MinIO to be ready
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" 2>/dev/null; do
  echo "Waiting for MinIO..."
  sleep 2
done

# Create bucket if it doesn't exist
if ! mc ls local/"${MINIO_BUCKET}" 2>/dev/null; then
  mc mb local/"${MINIO_BUCKET}"
  echo "Created bucket: ${MINIO_BUCKET}"
else
  echo "Bucket already exists: ${MINIO_BUCKET}"
fi
```

```bash
chmod +x minio/init.sh
```

**Step 2: Add MinIO services to `compose.yaml`**

Replace the `# Populated in Phases 2-3` comment with the MinIO block (more services added in later tasks). Add these under `services:`:

```yaml
  # ── Object Storage ──────────────────────────────────────
  minio:
    image: quay.io/minio/minio:${MINIO_VERSION}
    container_name: minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio-data:/data
    ports:
      - "${MINIO_API_PORT}:9000"
      - "${MINIO_CONSOLE_PORT}:9001"
    networks:
      - monitoring-net
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio-init:
    image: quay.io/minio/mc:latest
    container_name: minio-init
    depends_on:
      minio:
        condition: service_healthy
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET: ${MINIO_BUCKET}
    volumes:
      - ./minio/init.sh:/init.sh:ro
    entrypoint: /bin/sh
    command: /init.sh
    networks:
      - monitoring-net
    restart: "no"
```

**Step 3: Validate MinIO starts**

```bash
podman compose up -d minio minio-init
podman compose logs minio-init  # Should show "Created bucket: thanos-data"
curl -s http://localhost:9000/minio/health/live  # Should return 200
podman compose down
```

**Step 4: Commit**

```bash
git add minio/init.sh compose.yaml
git commit -m "feat: add MinIO object storage with auto bucket creation"
```

---

## Phase 2: Prometheus Core

### Task 3: Prometheus Configuration + HA Replicas

**Files:**

- Create: `prometheus/prometheus.yml`
- Modify: `compose.yaml` (add prometheus-use1-1, prometheus-use1-2)

**Step 1: Create `prometheus/prometheus.yml`**

This config is shared by both replicas. The `external_labels` are overridden per-replica via CLI flags.

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

scrape_configs:
  # ── Self-monitoring ─────────────────────────────────────
  - job_name: prometheus
    static_configs:
      - targets:
          - prometheus-use1-1:9090
          - prometheus-use1-2:9090

  # ── Application Services ────────────────────────────────
  - job_name: spring-boot-app
    metrics_path: /actuator/prometheus
    static_configs:
      - targets:
          - spring-boot-app:8080

  - job_name: dotnet-app
    metrics_path: /metrics
    static_configs:
      - targets:
          - dotnet-app:8080

  - job_name: fastapi-app
    metrics_path: /metrics
    static_configs:
      - targets:
          - fastapi-app:8000

  # ── Infrastructure ──────────────────────────────────────
  - job_name: pushgateway
    honor_labels: true
    static_configs:
      - targets:
          - pushgateway:9091

  - job_name: alertmanager
    static_configs:
      - targets:
          - alertmanager:9093

  - job_name: grafana
    static_configs:
      - targets:
          - grafana:3000

  - job_name: thanos-query
    static_configs:
      - targets:
          - thanos-query:9090

  - job_name: thanos-sidecar
    static_configs:
      - targets:
          - thanos-sidecar-use1-1:10902
          - thanos-sidecar-use1-2:10902

  - job_name: thanos-store-gateway
    static_configs:
      - targets:
          - thanos-store-gateway:10902

  - job_name: thanos-compactor
    static_configs:
      - targets:
          - thanos-compactor:10902

  # ── Blackbox Exporter ───────────────────────────────────
  - job_name: blackbox-http
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - http://spring-boot-app:8080/actuator/health
          - http://dotnet-app:8080/health
          - http://fastapi-app:8000/health
          - http://grafana:3000/api/health
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115

  - job_name: blackbox-tcp
    metrics_path: /probe
    params:
      module: [tcp_connect]
    static_configs:
      - targets:
          - prometheus-use1-1:9090
          - prometheus-use1-2:9090
          - grafana:3000
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115
```

**Step 2: Add Prometheus replicas to `compose.yaml`**

Add under the monitoring infrastructure section:

```yaml
  # ── Prometheus HA ───────────────────────────────────────
  prometheus-use1-1:
    image: quay.io/prometheus/prometheus:${PROMETHEUS_VERSION}
    container_name: prometheus-use1-1
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --storage.tsdb.retention.time=2h
      - --storage.tsdb.min-block-duration=2h
      - --storage.tsdb.max-block-duration=2h
      - --web.enable-lifecycle
      - --web.enable-admin-api
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/rules:/etc/prometheus/rules:ro
      - prometheus-use1-1-data:/prometheus
    ports:
      - "${PROMETHEUS_USE1_1_PORT}:9090"
    networks:
      - monitoring-net
    restart: unless-stopped

  prometheus-use1-2:
    image: quay.io/prometheus/prometheus:${PROMETHEUS_VERSION}
    container_name: prometheus-use1-2
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --storage.tsdb.retention.time=2h
      - --storage.tsdb.min-block-duration=2h
      - --storage.tsdb.max-block-duration=2h
      - --web.enable-lifecycle
      - --web.enable-admin-api
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ./prometheus/rules:/etc/prometheus/rules:ro
      - prometheus-use1-2-data:/prometheus
    ports:
      - "${PROMETHEUS_USE1_2_PORT}:9090"
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 3: Validate Prometheus starts (without targets — they don't exist yet)**

```bash
podman compose up -d prometheus-use1-1 prometheus-use1-2
curl -s http://localhost:9081/-/healthy  # "Prometheus Server is Healthy."
curl -s http://localhost:9082/-/healthy  # "Prometheus Server is Healthy."
podman compose down
```

**Step 4: Commit**

```bash
git add prometheus/prometheus.yml compose.yaml
git commit -m "feat: add Prometheus HA replicas (use1-1, use1-2) with shared scrape config"
```

---

### Task 4: Thanos Sidecars

**Files:**

- Create: `thanos/objstore.yml`
- Modify: `compose.yaml` (add thanos-sidecar-use1-1, thanos-sidecar-use1-2)

**Step 1: Create `thanos/objstore.yml`**

```yaml
type: S3
config:
  bucket: thanos-data
  endpoint: minio:9000
  access_key: thanos
  secret_key: thanospassword
  insecure: true
  # ── To swap to a cloud provider, replace the above with one of: ──
  #
  # AWS S3:
  #   type: S3
  #   config:
  #     bucket: your-bucket
  #     endpoint: s3.us-east-1.amazonaws.com
  #     access_key: <AWS_ACCESS_KEY>
  #     secret_key: <AWS_SECRET_KEY>
  #
  # Azure Blob Storage:
  #   type: AZURE
  #   config:
  #     storage_account: <ACCOUNT_NAME>
  #     storage_account_key: <ACCOUNT_KEY>
  #     container: thanos-data
  #
  # GCS:
  #   type: GCS
  #   config:
  #     bucket: your-bucket
  #     service_account: <path-to-service-account-json>
```

**Step 2: Add Thanos Sidecars to `compose.yaml`**

```yaml
  # ── Thanos Sidecars ─────────────────────────────────────
  thanos-sidecar-use1-1:
    image: quay.io/thanos/thanos:${THANOS_VERSION}
    container_name: thanos-sidecar-use1-1
    command:
      - sidecar
      - --tsdb.path=/prometheus
      - --prometheus.url=http://prometheus-use1-1:9090
      - --objstore.config-file=/etc/thanos/objstore.yml
      - --grpc-address=0.0.0.0:10901
      - --http-address=0.0.0.0:10902
    volumes:
      - ./thanos/objstore.yml:/etc/thanos/objstore.yml:ro
      - prometheus-use1-1-data:/prometheus:ro
    depends_on:
      - prometheus-use1-1
      - minio-init
    networks:
      - monitoring-net
    restart: unless-stopped

  thanos-sidecar-use1-2:
    image: quay.io/thanos/thanos:${THANOS_VERSION}
    container_name: thanos-sidecar-use1-2
    command:
      - sidecar
      - --tsdb.path=/prometheus
      - --prometheus.url=http://prometheus-use1-2:9090
      - --objstore.config-file=/etc/thanos/objstore.yml
      - --grpc-address=0.0.0.0:10901
      - --http-address=0.0.0.0:10902
    volumes:
      - ./thanos/objstore.yml:/etc/thanos/objstore.yml:ro
      - prometheus-use1-2-data:/prometheus:ro
    depends_on:
      - prometheus-use1-2
      - minio-init
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 3: Validate sidecars connect to Prometheus**

```bash
podman compose up -d minio minio-init prometheus-use1-1 prometheus-use1-2 thanos-sidecar-use1-1 thanos-sidecar-use1-2
podman compose logs thanos-sidecar-use1-1 | grep "listening"  # Should show gRPC + HTTP
podman compose down
```

**Step 4: Commit**

```bash
git add thanos/objstore.yml compose.yaml
git commit -m "feat: add Thanos sidecars with MinIO object store config"
```

---

### Task 5: Thanos Query, Store Gateway, and Compactor

**Files:**

- Modify: `compose.yaml` (add thanos-query, thanos-store-gateway, thanos-compactor)

**Step 1: Add Thanos Query to `compose.yaml`**

```yaml
  # ── Thanos Query ────────────────────────────────────────
  thanos-query:
    image: quay.io/thanos/thanos:${THANOS_VERSION}
    container_name: thanos-query
    command:
      - query
      - --http-address=0.0.0.0:9090
      - --grpc-address=0.0.0.0:10901
      - --store=thanos-sidecar-use1-1:10901
      - --store=thanos-sidecar-use1-2:10901
      - --store=thanos-store-gateway:10901
      - --query.replica-label=replica
    ports:
      - "${THANOS_QUERY_PORT}:9090"
    depends_on:
      - thanos-sidecar-use1-1
      - thanos-sidecar-use1-2
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 2: Add Thanos Store Gateway to `compose.yaml`**

```yaml
  # ── Thanos Store Gateway ────────────────────────────────
  thanos-store-gateway:
    image: quay.io/thanos/thanos:${THANOS_VERSION}
    container_name: thanos-store-gateway
    command:
      - store
      - --data-dir=/data
      - --objstore.config-file=/etc/thanos/objstore.yml
      - --grpc-address=0.0.0.0:10901
      - --http-address=0.0.0.0:10902
    volumes:
      - ./thanos/objstore.yml:/etc/thanos/objstore.yml:ro
    depends_on:
      - minio-init
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 3: Add Thanos Compactor to `compose.yaml`**

```yaml
  # ── Thanos Compactor ────────────────────────────────────
  thanos-compactor:
    image: quay.io/thanos/thanos:${THANOS_VERSION}
    container_name: thanos-compactor
    command:
      - compact
      - --data-dir=/data
      - --objstore.config-file=/etc/thanos/objstore.yml
      - --http-address=0.0.0.0:10902
      - --wait
      - --consistency-delay=30s
    volumes:
      - ./thanos/objstore.yml:/etc/thanos/objstore.yml:ro
    depends_on:
      - minio-init
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 4: Validate Thanos Query can reach stores**

```bash
podman compose up -d minio minio-init prometheus-use1-1 prometheus-use1-2 \
  thanos-sidecar-use1-1 thanos-sidecar-use1-2 thanos-query thanos-store-gateway thanos-compactor
curl -s http://localhost:9090/api/v1/query?query=up | python3 -m json.tool  # Should return results
podman compose down
```

**Step 5: Commit**

```bash
git add compose.yaml
git commit -m "feat: add Thanos Query, Store Gateway, and Compactor"
```

---

## Phase 3: Supporting Infrastructure

### Task 6: Pushgateway

**Files:**

- Modify: `compose.yaml` (add pushgateway)

**Step 1: Add Pushgateway to `compose.yaml`**

```yaml
  # ── Pushgateway ─────────────────────────────────────────
  pushgateway:
    image: quay.io/prometheus/pushgateway:${PUSHGATEWAY_VERSION}
    container_name: pushgateway
    command:
      - --web.listen-address=:9091
      - --persistence.file=/data/pushgateway.dat
    volumes:
      - pushgateway-data:/data
    ports:
      - "${PUSHGATEWAY_PORT}:9091"
    networks:
      - monitoring-net
    restart: unless-stopped
```

Add `pushgateway-data:` to the top-level `volumes:` section.

**Step 2: Validate Pushgateway accepts metrics**

```bash
podman compose up -d pushgateway
curl -s http://localhost:9091/metrics | head -5  # Should return Prometheus metrics
echo 'test_metric 42' | curl --data-binary @- http://localhost:9091/metrics/job/test
curl -s http://localhost:9091/metrics | grep test_metric  # Should show test_metric 42
podman compose down
```

**Step 3: Commit**

```bash
git add compose.yaml
git commit -m "feat: add Pushgateway for ephemeral workload metrics"
```

---

### Task 7: Blackbox Exporter

**Files:**

- Create: `blackbox/blackbox.yml`
- Modify: `compose.yaml` (add blackbox-exporter)

**Step 1: Create `blackbox/blackbox.yml`**

```yaml
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: [200]
      method: GET
      follow_redirects: true
      preferred_ip_protocol: ip4

  tcp_connect:
    prober: tcp
    timeout: 5s
    tcp:
      preferred_ip_protocol: ip4
```

**Step 2: Add Blackbox Exporter to `compose.yaml`**

```yaml
  # ── Blackbox Exporter ───────────────────────────────────
  blackbox-exporter:
    image: quay.io/prometheus/blackbox-exporter:${BLACKBOX_VERSION}
    container_name: blackbox-exporter
    command:
      - --config.file=/etc/blackbox/blackbox.yml
    volumes:
      - ./blackbox/blackbox.yml:/etc/blackbox/blackbox.yml:ro
    ports:
      - "${BLACKBOX_PORT}:9115"
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 3: Validate Blackbox Exporter starts**

```bash
podman compose up -d blackbox-exporter
curl -s http://localhost:9115/metrics | head -5  # Should return metrics
podman compose down
```

**Step 4: Commit**

```bash
git add blackbox/blackbox.yml compose.yaml
git commit -m "feat: add Blackbox Exporter with HTTP and TCP probe modules"
```

---

### Task 8: Alertmanager + Mailhog

**Files:**

- Create: `alertmanager/alertmanager.yml`
- Create: `alertmanager/templates/email.tmpl`
- Modify: `compose.yaml` (add alertmanager, mailhog)

**Step 1: Create `alertmanager/alertmanager.yml`**

```yaml
global:
  smtp_smarthost: mailhog:1025
  smtp_from: alertmanager@monitoring.local
  smtp_require_tls: false

route:
  receiver: default-email
  group_by: [alertname, job]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    - receiver: critical-email
      match:
        severity: critical
      group_wait: 1m
      repeat_interval: 1h

    - receiver: warning-email
      match:
        severity: warning
      group_wait: 5m
      repeat_interval: 4h

receivers:
  - name: default-email
    email_configs:
      - to: alerts@monitoring.local
        html: '{{ template "email.html" . }}'
        headers:
          Subject: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'

  - name: critical-email
    email_configs:
      - to: critical@monitoring.local
        html: '{{ template "email.html" . }}'
        headers:
          Subject: '[CRITICAL] {{ .GroupLabels.alertname }}'

  - name: warning-email
    email_configs:
      - to: warnings@monitoring.local
        html: '{{ template "email.html" . }}'
        headers:
          Subject: '[WARNING] {{ .GroupLabels.alertname }}'

inhibit_rules:
  - source_matchers:
      - severity = critical
    target_matchers:
      - severity = warning
    equal: [alertname, job]

templates:
  - /etc/alertmanager/templates/*.tmpl
```

**Step 2: Create `alertmanager/templates/email.tmpl`**

```html
{{ define "email.html" }}
<html>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden;">
    <div style="padding: 20px; background: {{ if eq .Status "firing" }}#dc3545{{ else }}#28a745{{ end }}; color: white;">
      <h2 style="margin: 0;">{{ .Status | toUpper }}: {{ .GroupLabels.alertname }}</h2>
      <p style="margin: 5px 0 0;">{{ .Alerts | len }} alert(s)</p>
    </div>
    <div style="padding: 20px;">
      {{ range .Alerts }}
      <div style="border-left: 4px solid {{ if eq .Status "firing" }}#dc3545{{ else }}#28a745{{ end }}; padding: 10px; margin: 10px 0; background: #f8f9fa;">
        <strong>{{ .Labels.alertname }}</strong>
        <br/>Severity: {{ .Labels.severity }}
        <br/>Job: {{ .Labels.job }}
        {{ if .Labels.instance }}<br/>Instance: {{ .Labels.instance }}{{ end }}
        <br/><br/>{{ .Annotations.summary }}
        {{ if .Annotations.description }}<br/><small>{{ .Annotations.description }}</small>{{ end }}
      </div>
      {{ end }}
    </div>
  </div>
</body>
</html>
{{ end }}
```

**Step 3: Add Alertmanager and Mailhog to `compose.yaml`**

```yaml
  # ── Alertmanager ────────────────────────────────────────
  alertmanager:
    image: quay.io/prometheus/alertmanager:${ALERTMANAGER_VERSION}
    container_name: alertmanager
    command:
      - --config.file=/etc/alertmanager/alertmanager.yml
      - --storage.path=/alertmanager
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml:ro
      - ./alertmanager/templates:/etc/alertmanager/templates:ro
    ports:
      - "${ALERTMANAGER_PORT}:9093"
    networks:
      - monitoring-net
    restart: unless-stopped

  # ── Mailhog ────────────────────────────────────────────
  mailhog:
    image: docker.io/mailhog/mailhog:${MAILHOG_VERSION}
    container_name: mailhog
    ports:
      - "${MAILHOG_SMTP_PORT}:1025"
      - "${MAILHOG_UI_PORT}:8025"
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 4: Validate Alertmanager connects to Mailhog**

```bash
podman compose up -d mailhog alertmanager
curl -s http://localhost:9093/-/healthy  # "OK"
curl -s http://localhost:8025/api/v2/messages  # Should return []
podman compose down
```

**Step 5: Commit**

```bash
git add alertmanager/ compose.yaml
git commit -m "feat: add Alertmanager with email routing and Mailhog"
```

---

### Task 9: Alert Rules

**Files:**

- Create: `prometheus/rules/service-alerts.yml`
- Create: `prometheus/rules/infrastructure-alerts.yml`
- Create: `prometheus/rules/blackbox-alerts.yml`
- Create: `prometheus/rules/meta-alerts.yml`

**Step 1: Create `prometheus/rules/service-alerts.yml`**

```yaml
groups:
  - name: service-alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.job }} instance {{ $labels.instance }} has been unreachable for more than 1 minute."

      - alert: HighErrorRate
        expr: |
          (
            sum by (job) (rate(http_server_requests_seconds_count{status=~"5.."}[5m]))
            /
            sum by (job) (rate(http_server_requests_seconds_count[5m]))
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.job }}"
          description: "{{ $labels.job }} has a 5xx error rate above 5% for the last 5 minutes (current: {{ $value | humanizePercentage }})."

      - alert: HighLatencyP99
        expr: |
          histogram_quantile(0.99, sum by (job, le) (rate(http_server_requests_seconds_bucket[5m]))) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High p99 latency on {{ $labels.job }}"
          description: "{{ $labels.job }} p99 latency is above 1s for the last 5 minutes (current: {{ $value | humanizeDuration }})."

      - alert: HighLatencyP99Critical
        expr: |
          histogram_quantile(0.99, sum by (job, le) (rate(http_server_requests_seconds_bucket[5m]))) > 5
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Critical p99 latency on {{ $labels.job }}"
          description: "{{ $labels.job }} p99 latency is above 5s for the last 5 minutes (current: {{ $value | humanizeDuration }})."

      - alert: TooManyInFlightRequests
        expr: |
          sum by (job) (http_server_active_requests) > 100
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High in-flight requests on {{ $labels.job }}"
          description: "{{ $labels.job }} has more than 100 in-flight requests for the last 2 minutes (current: {{ $value }})."
```

**Step 2: Create `prometheus/rules/infrastructure-alerts.yml`**

```yaml
groups:
  - name: infrastructure-alerts
    rules:
      - alert: PushgatewayStaleMetrics
        expr: |
          (time() - push_time_seconds) > 120
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Stale metrics in Pushgateway for job {{ $labels.job }}"
          description: "Pushgateway has not received a push for job {{ $labels.job }} in over 2 minutes."

      - alert: HighMemoryUsage
        expr: |
          process_resident_memory_bytes / 1024 / 1024 > 512
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.job }}"
          description: "{{ $labels.job }} instance {{ $labels.instance }} is using more than 512MB of memory (current: {{ $value | humanize }}MB)."
```

**Step 3: Create `prometheus/rules/blackbox-alerts.yml`**

```yaml
groups:
  - name: blackbox-alerts
    rules:
      - alert: EndpointDown
        expr: probe_success == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Endpoint {{ $labels.instance }} is down"
          description: "Blackbox probe has failed for {{ $labels.instance }} for more than 1 minute."

      - alert: SlowEndpoint
        expr: probe_duration_seconds > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response from {{ $labels.instance }}"
          description: "{{ $labels.instance }} is responding slowly (current: {{ $value | humanizeDuration }})."

      - alert: SSLCertExpiringSoon
        expr: |
          (probe_ssl_earliest_cert_expiry - time()) / 86400 < 30
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "SSL certificate expiring soon for {{ $labels.instance }}"
          description: "SSL certificate for {{ $labels.instance }} expires in {{ $value | humanize }} days."

      - alert: DNSResolutionFailure
        expr: probe_dns_lookup_time_seconds == 0 and probe_success == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "DNS resolution failure for {{ $labels.instance }}"
          description: "DNS lookup failed for {{ $labels.instance }}."
```

**Step 4: Create `prometheus/rules/meta-alerts.yml`**

```yaml
groups:
  - name: meta-alerts
    rules:
      - alert: PrometheusTargetDown
        expr: up == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Prometheus target {{ $labels.job }}/{{ $labels.instance }} is down"
          description: "Prometheus cannot scrape {{ $labels.job }} at {{ $labels.instance }} for more than 2 minutes."

      - alert: PrometheusScrapeErrors
        expr: |
          rate(prometheus_target_scrapes_exceeded_sample_limit_total[5m]) > 0
          or
          rate(prometheus_target_scrapes_sample_duplicate_timestamp_total[5m]) > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Prometheus scrape errors detected"
          description: "Prometheus is experiencing scrape errors (exceeded sample limit or duplicate timestamps)."

      - alert: ThanosCompactHalted
        expr: thanos_compact_halted == 1
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Thanos Compactor has halted"
          description: "Thanos Compactor has halted and is no longer compacting blocks."

      - alert: ThanosQueryGrpcErrors
        expr: |
          rate(grpc_server_handled_total{grpc_code=~"Unknown|Internal|Unavailable", job="thanos-query"}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Thanos Query gRPC errors"
          description: "Thanos Query is experiencing gRPC errors above 5% (current: {{ $value | humanizePercentage }})."

      - alert: AlertmanagerDown
        expr: up{job="alertmanager"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Alertmanager is down"
          description: "Alertmanager has been unreachable for more than 1 minute."
```

**Step 5: Validate rules syntax**

```bash
podman compose up -d prometheus-use1-1
podman compose exec prometheus-use1-1 promtool check rules /etc/prometheus/rules/*.yml
podman compose down
```

Expected: each file prints "SUCCESS" with the number of rules.

**Step 6: Commit**

```bash
git add prometheus/rules/
git commit -m "feat: add comprehensive alert rules (service, infra, blackbox, meta)"
```

---

## Phase 4: Application Services

### Task 10: FastAPI Application

**Files:**

- Create: `services/fastapi-app/requirements.txt`
- Create: `services/fastapi-app/app/__init__.py`
- Create: `services/fastapi-app/app/main.py`
- Create: `services/fastapi-app/app/test_main.py`
- Create: `services/fastapi-app/Dockerfile`
- Modify: `compose.yaml` (add fastapi-app)

**Step 1: Create `services/fastapi-app/requirements.txt`**

```
fastapi==0.115.8
uvicorn[standard]==0.34.0
prometheus-fastapi-instrumentator==7.0.2
prometheus-client==0.22.0
```

**Step 2: Create `services/fastapi-app/app/__init__.py`**

Empty file.

**Step 3: Create `services/fastapi-app/app/main.py`**

```python
import random

from fastapi import FastAPI, HTTPException
from prometheus_client import Gauge
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI(title="FastAPI Sample Service")

# Custom gauge: active background jobs
active_jobs = Gauge(
    "fastapi_active_background_jobs",
    "Number of active background jobs",
)
active_jobs.set(0)

# Instrument HTTP metrics automatically
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

TASKS_DB: dict[int, dict] = {
    1: {"id": 1, "title": "Set up monitoring", "status": "done"},
    2: {"id": 2, "title": "Write alert rules", "status": "in_progress"},
    3: {"id": 3, "title": "Configure dashboards", "status": "pending"},
}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/api/tasks")
def list_tasks():
    # Simulate ~5% error rate
    if random.random() < 0.05:
        raise HTTPException(status_code=500, detail="Random simulated error")
    return list(TASKS_DB.values())


@app.get("/api/tasks/{task_id}")
def get_task(task_id: int):
    # Simulate ~5% error rate
    if random.random() < 0.05:
        raise HTTPException(status_code=500, detail="Random simulated error")
    task = TASKS_DB.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task
```

**Step 4: Write tests — `services/fastapi-app/app/test_main.py`**

```python
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_list_tasks():
    with patch("app.main.random.random", return_value=0.5):
        response = client.get("/api/tasks")
        assert response.status_code == 200
        assert len(response.json()) == 3


def test_get_task():
    with patch("app.main.random.random", return_value=0.5):
        response = client.get("/api/tasks/1")
        assert response.status_code == 200
        assert response.json()["title"] == "Set up monitoring"


def test_get_task_not_found():
    with patch("app.main.random.random", return_value=0.5):
        response = client.get("/api/tasks/999")
        assert response.status_code == 404


def test_metrics_endpoint():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_request" in response.text


def test_simulated_error():
    with patch("app.main.random.random", return_value=0.01):
        response = client.get("/api/tasks")
        assert response.status_code == 500
```

**Step 5: Run tests locally to verify**

```bash
cd services/fastapi-app
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt pytest httpx
pytest app/test_main.py -v
deactivate
cd ../..
```

Expected: all 6 tests pass.

**Step 6: Create `services/fastapi-app/Dockerfile`**

```dockerfile
FROM docker.io/library/python:3.14-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 7: Add fastapi-app to `compose.yaml`**

```yaml
  # ── FastAPI ─────────────────────────────────────────────
  fastapi-app:
    build:
      context: ./services/fastapi-app
    container_name: fastapi-app
    ports:
      - "${FASTAPI_PORT}:8000"
    networks:
      - monitoring-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 10s
      timeout: 5s
      retries: 3
```

**Step 8: Build and validate**

```bash
podman compose build fastapi-app
podman compose up -d fastapi-app
curl -s http://localhost:8083/health           # {"status":"healthy"}
curl -s http://localhost:8083/metrics | head -5 # Prometheus metrics
podman compose down
```

**Step 9: Commit**

```bash
git add services/fastapi-app/ compose.yaml
git commit -m "feat: add FastAPI service with Prometheus instrumentation and simulated errors"
```

---

### Task 11: Azure Function Application

**Files:**

- Create: `services/azure-func/requirements.txt`
- Create: `services/azure-func/host.json`
- Create: `services/azure-func/function_app.py`
- Create: `services/azure-func/test_function_app.py`
- Create: `services/azure-func/Dockerfile`
- Modify: `compose.yaml` (add azure-func)

**Step 1: Create `services/azure-func/requirements.txt`**

```
azure-functions==1.21.3
prometheus-client==0.22.0
requests==2.32.3
```

**Step 2: Create `services/azure-func/host.json`**

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
```

**Step 3: Create `services/azure-func/function_app.py`**

```python
import logging
import random
import time

import azure.functions as func
from prometheus_client import CollectorRegistry, Counter, Histogram, push_to_gateway

app = func.FunctionApp()

PUSHGATEWAY_URL = "pushgateway:9091"
REGISTRY = CollectorRegistry()

invocation_count = Counter(
    "azure_func_invocations_total",
    "Total Azure Function invocations",
    ["function_name", "status"],
    registry=REGISTRY,
)

invocation_duration = Histogram(
    "azure_func_invocation_duration_seconds",
    "Azure Function invocation duration",
    ["function_name"],
    registry=REGISTRY,
)


def push_metrics():
    """Push metrics to Pushgateway."""
    try:
        push_to_gateway(PUSHGATEWAY_URL, job="azure-func", registry=REGISTRY)
    except Exception as e:
        logging.warning(f"Failed to push metrics to Pushgateway: {e}")


@app.route(route="process", auth_level=func.AuthLevel.ANONYMOUS)
def process(req: func.HttpRequest) -> func.HttpResponse:
    start = time.monotonic()
    try:
        # Simulate work (50-500ms)
        work_time = random.uniform(0.05, 0.5)
        time.sleep(work_time)

        # Simulate ~5% error rate
        if random.random() < 0.05:
            invocation_count.labels(function_name="process", status="error").inc()
            raise Exception("Simulated processing error")

        result = {"message": "Processed successfully", "duration_ms": round(work_time * 1000)}
        invocation_count.labels(function_name="process", status="success").inc()
        push_metrics()

        return func.HttpResponse(
            body=str(result),
            status_code=200,
            mimetype="application/json",
        )
    except Exception as e:
        invocation_count.labels(function_name="process", status="error").inc()
        push_metrics()
        return func.HttpResponse(
            body=str({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )
    finally:
        duration = time.monotonic() - start
        invocation_duration.labels(function_name="process").observe(duration)


@app.timer_trigger(schedule="0 */1 * * * *", arg_name="timer")
def metrics_push(timer: func.TimerRequest) -> None:
    """Push accumulated metrics to Pushgateway every minute."""
    push_metrics()
    logging.info("Pushed metrics to Pushgateway")
```

**Step 4: Write tests — `services/azure-func/test_function_app.py`**

```python
from unittest.mock import MagicMock, patch

import azure.functions as func

from function_app import process


def test_process_success():
    req = func.HttpRequest(method="POST", url="/api/process", body=b"")
    with patch("function_app.random.random", return_value=0.5), \
         patch("function_app.random.uniform", return_value=0.05), \
         patch("function_app.push_metrics"):
        response = process(req)
        assert response.status_code == 200
        assert "Processed successfully" in response.get_body().decode()


def test_process_error():
    req = func.HttpRequest(method="POST", url="/api/process", body=b"")
    with patch("function_app.random.random", return_value=0.01), \
         patch("function_app.random.uniform", return_value=0.05), \
         patch("function_app.push_metrics"):
        response = process(req)
        assert response.status_code == 500
```

**Step 5: Run tests locally**

```bash
cd services/azure-func
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt pytest
pytest test_function_app.py -v
deactivate
cd ../..
```

Expected: both tests pass.

**Step 6: Create `services/azure-func/Dockerfile`**

```dockerfile
FROM mcr.microsoft.com/azure-functions/python:4-python3.13

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

COPY requirements.txt /home/site/wwwroot/
RUN pip install --no-cache-dir -r /home/site/wwwroot/requirements.txt

COPY host.json /home/site/wwwroot/
COPY function_app.py /home/site/wwwroot/

# Note: Using Python 3.13 base image. Upgrade to 3.14 when
# mcr.microsoft.com/azure-functions/python:4-python3.14 is available.
# Track: https://github.com/Azure/azure-functions-python-worker/issues
```

**Step 7: Add azure-func to `compose.yaml`**

```yaml
  # ── Azure Function ──────────────────────────────────────
  azure-func:
    build:
      context: ./services/azure-func
    container_name: azure-func
    environment:
      AzureWebJobsStorage: ""
      FUNCTIONS_WORKER_RUNTIME: python
    ports:
      - "${AZURE_FUNC_PORT}:80"
    depends_on:
      - pushgateway
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 8: Build and validate**

```bash
podman compose build azure-func
podman compose up -d pushgateway azure-func
curl -s http://localhost:8084/api/process  # Should return 200 with JSON
podman compose down
```

**Step 9: Commit**

```bash
git add services/azure-func/ compose.yaml
git commit -m "feat: add Azure Function with Pushgateway metric push"
```

---

### Task 12: .NET 10 Application

**Files:**

- Create: `services/dotnet-app/DotnetApp.csproj`
- Create: `services/dotnet-app/Program.cs`
- Create: `services/dotnet-app/Controllers/OrdersController.cs`
- Create: `services/dotnet-app/Models/Order.cs`
- Create: `services/dotnet-app/Health/DependencyHealthCheck.cs`
- Create: `services/dotnet-app/Dockerfile`
- Create: `services/dotnet-app/DotnetApp.Tests/DotnetApp.Tests.csproj`
- Create: `services/dotnet-app/DotnetApp.Tests/OrdersControllerTests.cs`
- Modify: `compose.yaml` (add dotnet-app)

**Step 1: Create `services/dotnet-app/DotnetApp.csproj`**

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="prometheus-net.AspNetCore" Version="8.2.1" />
    <PackageReference Include="AspNetCore.HealthChecks.Uris" Version="8.0.1" />
  </ItemGroup>
</Project>
```

**Step 2: Create `services/dotnet-app/Models/Order.cs`**

```csharp
namespace DotnetApp.Models;

public record Order(int Id, string Product, decimal Amount, string Status);
```

**Step 3: Create `services/dotnet-app/Controllers/OrdersController.cs`**

```csharp
using Microsoft.AspNetCore.Mvc;
using DotnetApp.Models;

namespace DotnetApp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    private static readonly List<Order> Orders =
    [
        new(1, "Monitoring License", 299.99m, "completed"),
        new(2, "Dashboard Plugin", 49.99m, "processing"),
        new(3, "Alert Pack", 19.99m, "pending"),
    ];

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Order>>> GetOrders()
    {
        // Simulate variable latency (10-200ms)
        await Task.Delay(Random.Shared.Next(10, 200));
        return Ok(Orders);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<Order>> GetOrder(int id)
    {
        // Simulate variable latency (10-200ms)
        await Task.Delay(Random.Shared.Next(10, 200));
        var order = Orders.FirstOrDefault(o => o.Id == id);
        if (order is null)
            return NotFound();
        return Ok(order);
    }
}
```

**Step 4: Create `services/dotnet-app/Health/DependencyHealthCheck.cs`**

```csharp
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DotnetApp.Health;

public class DependencyHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        // Simulate a dependency check (e.g., database ping)
        // ~10% chance of degraded state for demo purposes
        var value = Random.Shared.NextDouble();
        if (value < 0.02)
            return Task.FromResult(HealthCheckResult.Unhealthy("Simulated dependency failure"));
        if (value < 0.10)
            return Task.FromResult(HealthCheckResult.Degraded("Simulated slow dependency"));
        return Task.FromResult(HealthCheckResult.Healthy("All dependencies OK"));
    }
}
```

**Step 5: Create `services/dotnet-app/Program.cs`**

```csharp
using DotnetApp.Health;
using Prometheus;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHealthChecks()
    .AddCheck<DependencyHealthCheck>("dependency_check");

var app = builder.Build();

app.UseRouting();
app.UseHttpMetrics();
app.MapControllers();
app.MapHealthChecks("/health");
app.MapMetrics();

app.Run();
```

**Step 6: Create test project — `services/dotnet-app/DotnetApp.Tests/DotnetApp.Tests.csproj`**

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.0" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="../DotnetApp.csproj" />
  </ItemGroup>
</Project>
```

**Step 7: Create `services/dotnet-app/DotnetApp.Tests/OrdersControllerTests.cs`**

```csharp
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DotnetApp.Tests;

public class OrdersControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public OrdersControllerTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetOrders_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/orders");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetOrder_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/orders/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetOrder_NotFound()
    {
        var response = await _client.GetAsync("/api/orders/999");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Health_ReturnsSuccess()
    {
        var response = await _client.GetAsync("/health");
        Assert.True(response.IsSuccessStatusCode || response.StatusCode == HttpStatusCode.ServiceUnavailable);
    }

    [Fact]
    public async Task Metrics_ReturnsPrometheusFormat()
    {
        var response = await _client.GetAsync("/metrics");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("dotnet_", body);
    }
}
```

Make `Program` accessible to tests by adding to the bottom of `Program.cs`:

```csharp
// Make Program accessible to test project
public partial class Program { }
```

**Step 8: Run tests**

```bash
cd services/dotnet-app
dotnet test DotnetApp.Tests/ -v normal
cd ../..
```

Expected: all 5 tests pass.

**Step 9: Create `services/dotnet-app/Dockerfile`**

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY DotnetApp.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "DotnetApp.dll"]
```

**Step 10: Add dotnet-app to `compose.yaml`**

```yaml
  # ── .NET 10 ─────────────────────────────────────────────
  dotnet-app:
    build:
      context: ./services/dotnet-app
    container_name: dotnet-app
    environment:
      ASPNETCORE_URLS: http://+:8080
    ports:
      - "${DOTNET_PORT}:8080"
    networks:
      - monitoring-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

**Step 11: Build and validate**

```bash
podman compose build dotnet-app
podman compose up -d dotnet-app
curl -s http://localhost:8082/health     # Healthy/Degraded
curl -s http://localhost:8082/metrics | head -5  # Prometheus metrics
podman compose down
```

**Step 12: Commit**

```bash
git add services/dotnet-app/ compose.yaml
git commit -m "feat: add .NET 10 Web API with Prometheus metrics and health checks"
```

---

### Task 13: Spring Boot 4 Application

**Files:**

- Create: `services/spring-boot-app/pom.xml`
- Create: `services/spring-boot-app/src/main/java/com/example/monitoring/MonitoringApplication.java`
- Create: `services/spring-boot-app/src/main/java/com/example/monitoring/controller/ItemsController.java`
- Create: `services/spring-boot-app/src/main/java/com/example/monitoring/model/Item.java`
- Create: `services/spring-boot-app/src/main/resources/application.yml`
- Create: `services/spring-boot-app/src/test/java/com/example/monitoring/controller/ItemsControllerTest.java`
- Create: `services/spring-boot-app/Dockerfile`
- Modify: `compose.yaml` (add spring-boot-app)

**Step 1: Create `services/spring-boot-app/pom.xml`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>4.0.0</version>
        <relativePath/>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>monitoring-app</artifactId>
    <version>1.0.0</version>

    <properties>
        <java.version>24</java.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>

        <!-- OpenTelemetry -->
        <dependency>
            <groupId>io.opentelemetry.instrumentation</groupId>
            <artifactId>opentelemetry-spring-boot-starter</artifactId>
        </dependency>
        <dependency>
            <groupId>io.opentelemetry</groupId>
            <artifactId>opentelemetry-exporter-prometheus</artifactId>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>io.opentelemetry.instrumentation</groupId>
                <artifactId>opentelemetry-instrumentation-bom</artifactId>
                <version>2.12.0</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

**Step 2: Create `services/spring-boot-app/src/main/resources/application.yml`**

```yaml
server:
  port: 8080

management:
  endpoints:
    web:
      exposure:
        include: health,prometheus
  endpoint:
    health:
      show-details: always
    prometheus:
      enabled: true

otel:
  sdk:
    disabled: false
  metric:
    export:
      prometheus:
        enabled: true
```

**Step 3: Create the model — `services/spring-boot-app/src/main/java/com/example/monitoring/model/Item.java`**

```java
package com.example.monitoring.model;

public record Item(int id, String name, String category) {}
```

**Step 4: Create the main application class**

`services/spring-boot-app/src/main/java/com/example/monitoring/MonitoringApplication.java`:

```java
package com.example.monitoring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class MonitoringApplication {
    public static void main(String[] args) {
        SpringApplication.run(MonitoringApplication.class, args);
    }
}
```

**Step 5: Create the controller**

`services/spring-boot-app/src/main/java/com/example/monitoring/controller/ItemsController.java`:

```java
package com.example.monitoring.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import io.opentelemetry.api.GlobalOpenTelemetry;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.metrics.LongCounter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.example.monitoring.model.Item;

@RestController
@RequestMapping("/api/items")
public class ItemsController {

    private final LongCounter itemsProcessed;

    private static final Map<Integer, Item> ITEMS = new ConcurrentHashMap<>(Map.of(
        1, new Item(1, "Prometheus Server", "monitoring"),
        2, new Item(2, "Grafana Dashboard", "visualization"),
        3, new Item(3, "Thanos Gateway", "storage")
    ));

    public ItemsController() {
        var meter = GlobalOpenTelemetry.getMeter("com.example.monitoring");
        this.itemsProcessed = meter.counterBuilder("items_processed_total")
            .setDescription("Total number of items processed")
            .build();
    }

    @GetMapping
    public List<Item> getItems() {
        itemsProcessed.add(1, Attributes.builder().put("operation", "list").build());
        return List.copyOf(ITEMS.values());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Item> getItem(@PathVariable int id) {
        itemsProcessed.add(1, Attributes.builder().put("operation", "get").build());
        return Optional.ofNullable(ITEMS.get(id))
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }
}
```

**Step 6: Write tests**

`services/spring-boot-app/src/test/java/com/example/monitoring/controller/ItemsControllerTest.java`:

```java
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
            .andExpect(jsonPath("$.length()").value(3));
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
```

**Step 7: Run tests**

```bash
cd services/spring-boot-app
./mvnw test
cd ../..
```

Expected: all 5 tests pass.

**Step 8: Create `services/spring-boot-app/Dockerfile`**

```dockerfile
FROM docker.io/library/maven:3.9-eclipse-temurin-24 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM docker.io/library/eclipse-temurin:24-jre
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Step 9: Add spring-boot-app to `compose.yaml`**

```yaml
  # ── Spring Boot 4 ───────────────────────────────────────
  spring-boot-app:
    build:
      context: ./services/spring-boot-app
    container_name: spring-boot-app
    ports:
      - "${SPRING_BOOT_PORT}:8080"
    networks:
      - monitoring-net
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/actuator/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

**Step 10: Build and validate**

```bash
podman compose build spring-boot-app
podman compose up -d spring-boot-app
curl -s http://localhost:8081/actuator/health        # {"status":"UP"...}
curl -s http://localhost:8081/actuator/prometheus | head -5  # OTel metrics
podman compose down
```

**Step 11: Commit**

```bash
git add services/spring-boot-app/ compose.yaml
git commit -m "feat: add Spring Boot 4 app with OpenTelemetry Prometheus metrics"
```

---

## Phase 5: Visualization

### Task 14: Grafana Setup + Datasources

**Files:**

- Create: `grafana/provisioning/datasources/datasources.yml`
- Create: `grafana/provisioning/dashboards/dashboards.yml`
- Modify: `compose.yaml` (add grafana)

**Step 1: Create `grafana/provisioning/datasources/datasources.yml`**

```yaml
apiVersion: 1

datasources:
  - name: Thanos
    type: prometheus
    access: proxy
    url: http://thanos-query:9090
    isDefault: true
    jsonData:
      timeInterval: 15s

  - name: Prometheus-use1-1
    type: prometheus
    access: proxy
    url: http://prometheus-use1-1:9090
    jsonData:
      timeInterval: 15s

  - name: Prometheus-use1-2
    type: prometheus
    access: proxy
    url: http://prometheus-use1-2:9090
    jsonData:
      timeInterval: 15s

  - name: Alertmanager
    type: alertmanager
    access: proxy
    url: http://alertmanager:9093
    jsonData:
      implementation: prometheus
```

**Step 2: Create `grafana/provisioning/dashboards/dashboards.yml`**

```yaml
apiVersion: 1

providers:
  - name: Default
    orgId: 1
    folder: Monitoring
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

**Step 3: Add Grafana to `compose.yaml`**

```yaml
  # ── Grafana ─────────────────────────────────────────────
  grafana:
    image: docker.io/grafana/grafana:${GRAFANA_VERSION}
    container_name: grafana
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - grafana-data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
    ports:
      - "${GRAFANA_PORT}:3000"
    depends_on:
      - thanos-query
    networks:
      - monitoring-net
    restart: unless-stopped
```

**Step 4: Validate Grafana starts with datasources**

```bash
podman compose up -d minio minio-init prometheus-use1-1 prometheus-use1-2 \
  thanos-sidecar-use1-1 thanos-sidecar-use1-2 thanos-query grafana
curl -s -u admin:admin http://localhost:3000/api/datasources | python3 -m json.tool
# Should show 4 datasources
podman compose down
```

**Step 5: Commit**

```bash
git add grafana/provisioning/ compose.yaml
git commit -m "feat: add Grafana with provisioned Thanos and Prometheus datasources"
```

---

### Task 15: Grafana Dashboards

**Files:**

- Create: `grafana/dashboards/overview.json`
- Create: `grafana/dashboards/spring-boot.json`
- Create: `grafana/dashboards/dotnet.json`
- Create: `grafana/dashboards/fastapi.json`
- Create: `grafana/dashboards/azure-func.json`
- Create: `grafana/dashboards/infrastructure.json`
- Create: `grafana/dashboards/blackbox.json`
- Create: `grafana/dashboards/alerts.json`

Each dashboard is a Grafana JSON model. These are large files. The implementation agent should build each one with the following panels:

**Step 1: `overview.json` — Service Overview**

- Row per service: up/down status (stat), request rate (timeseries), error rate (gauge)
- Uses `up`, `http_server_requests_seconds_count`, `http_server_requests_seconds_count{status=~"5.."}`

**Step 2: `spring-boot.json` — Spring Boot Detail**

- HTTP request rate + latency histograms (by endpoint)
- JVM memory usage (heap/non-heap)
- JVM GC pause time
- Thread count
- `items_processed_total` counter
- Uses OTel metric names: `http_server_request_duration_seconds`, `jvm_memory_used_bytes`, etc.

**Step 3: `dotnet.json` — .NET Detail**

- HTTP request rate + latency histograms (by endpoint)
- .NET runtime stats (GC, threadpool)
- Health check status over time
- Uses `http_request_duration_seconds`, `dotnet_gc_*`, `dotnet_threadpool_*`

**Step 4: `fastapi.json` — FastAPI Detail**

- HTTP request rate + latency histograms (by endpoint)
- Error rate over time
- Active background jobs gauge
- Uses `http_request_duration_seconds`, `fastapi_active_background_jobs`

**Step 5: `azure-func.json` — Azure Function Detail**

- Invocation count by status (success/error)
- Invocation duration histogram
- Pushgateway last push time
- Uses `azure_func_invocations_total`, `azure_func_invocation_duration_seconds`, `push_time_seconds`

**Step 6: `infrastructure.json` — Monitoring Infrastructure**

- Prometheus scrape duration + target count
- Thanos compaction status
- Thanos Query store status
- Pushgateway staleness
- Uses `prometheus_target_*`, `thanos_compact_*`, `thanos_store_*`, `push_time_seconds`

**Step 7: `blackbox.json` — Blackbox Probes**

- Probe success/failure table (stat)
- Probe duration over time (timeseries)
- SSL cert expiry (stat)
- Uses `probe_success`, `probe_duration_seconds`, `probe_ssl_earliest_cert_expiry`

**Step 8: `alerts.json` — Alert Status**

- Alertmanager alerts panel
- Active alerts table
- Alert history
- Uses Alertmanager datasource

**Step 9: Commit**

```bash
git add grafana/dashboards/
git commit -m "feat: add Grafana dashboards (overview, per-service, infra, blackbox, alerts)"
```

---

## Phase 6: Validation

### Task 16: End-to-End Smoke Test

**Files:**

- None (validation only)

**Step 1: Bring up the entire stack**

```bash
podman compose up -d --build
```

**Step 2: Wait for all services to be healthy (allow ~2-3 minutes for builds)**

```bash
podman compose ps  # All services should show "running" or "healthy"
```

**Step 3: Validate each application service**

```bash
curl -s http://localhost:8081/actuator/health        # Spring Boot
curl -s http://localhost:8082/health                 # .NET
curl -s http://localhost:8083/health                 # FastAPI
curl -s http://localhost:8084/api/process            # Azure Function
```

**Step 4: Validate metrics endpoints**

```bash
curl -s http://localhost:8081/actuator/prometheus | head -3
curl -s http://localhost:8082/metrics | head -3
curl -s http://localhost:8083/metrics | head -3
curl -s http://localhost:9091/metrics | grep azure   # Pushgateway has Azure func metrics
```

**Step 5: Validate Prometheus targets**

```bash
curl -s http://localhost:9081/api/v1/targets | python3 -c "
import json, sys
data = json.load(sys.stdin)
for t in data['data']['activeTargets']:
    print(f\"{t['labels']['job']:30s} {t['health']}\")
"
```

Expected: all targets show `up`.

**Step 6: Validate Thanos Query deduplication**

```bash
curl -s 'http://localhost:9090/api/v1/query?query=up&dedup=true' | python3 -m json.tool
```

Should return deduplicated results (one entry per target, not two).

**Step 7: Validate Alertmanager**

```bash
curl -s http://localhost:9093/api/v2/status | python3 -m json.tool
```

**Step 8: Validate Grafana dashboards**

```bash
curl -s -u admin:admin http://localhost:3000/api/search?query= | python3 -c "
import json, sys
for d in json.load(sys.stdin):
    print(f\"  {d['title']}\")
"
```

Should list all 8 dashboards.

**Step 9: Validate Blackbox probes via Prometheus**

```bash
curl -s 'http://localhost:9081/api/v1/query?query=probe_success' | python3 -m json.tool
```

**Step 10: Validate Mailhog receives test alert (optional manual step)**

Open <http://localhost:8025> in a browser to check for any fired alerts.

**Step 11: Commit any final fixes, then tag**

```bash
git tag v1.0.0
```
