# Grafana Dashboard Fix + Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 8 Grafana dashboards so they load via file provisioning, correct broken PromQL queries, and add visual polish (styling, navigation, template variables, descriptions).

**Architecture:** Each dashboard is an independent JSON file in `grafana/dashboards/`. All share a common pattern (datasource variable, styling conventions, schema version) but have service-specific queries. Dashboards are loaded by Grafana's file provisioner on startup or file change.

**Tech Stack:** Grafana 11.x dashboard JSON (schemaVersion 39), PromQL, Prometheus datasource

---

## Common Pattern (apply to ALL dashboards)

Every dashboard JSON must follow this root structure (NO `{"dashboard": ...}` wrapper):

```json
{
  "id": null,
  "uid": "<unique-id>",
  "title": "<Dashboard Title>",
  "tags": [...],
  "schemaVersion": 39,
  "timezone": "browser",
  "editable": true,
  "graphTooltip": 1,
  "refresh": "15s",
  "time": { "from": "now-1h", "to": "now" },
  "templating": {
    "list": [
      {
        "name": "datasource",
        "type": "datasource",
        "query": "prometheus",
        "current": { "text": "Thanos", "value": "Thanos" },
        "hide": 0
      }
    ]
  },
  "links": [...],
  "panels": [...]
}
```

Every `targets` entry must include:

```json
"datasource": { "type": "prometheus", "uid": "$datasource" }
```

### Style Standards

- Colors: green=#73BF69, yellow=#FADE2A, red=#F2495C
- Timeseries legends: `"displayMode": "table", "placement": "bottom", "calcs": ["min", "max", "mean", "lastNotNull"]`
- All panels get a `"description"` field (shown on hover (i) icon)
- Row panels for grouping: `"type": "row", "collapsed": false`
- Stat panels: `"colorMode": "background", "graphMode": "none"` for status indicators

---

### Task 1: Rewrite overview.json

**Files:**

- Modify: `grafana/dashboards/overview.json`

**Step 1: Rewrite the dashboard**

Complete rewrite with:

- Bare root (no wrapper)
- `$datasource` and `$interval` (custom variable, values: 1m,5m,15m, default 5m) template variables
- Dashboard links to all 7 other dashboards with `keepTime: true`
- Row 1 "Service Health": 4 stat panels (one per service: spring-boot-app, dotnet-app, fastapi-app, pushgateway for azure-func), using `up{job="<name>"}` with UP/DOWN mappings
- Row 2 "HTTP Performance":
  - Request Rate: union query `sum by (job) (rate(http_server_request_duration_seconds_count{job="spring-boot-app"}[$interval])) or sum by (job) (rate(http_request_duration_seconds_count{job=~"dotnet-app|fastapi-app"}[$interval]))`
  - Error Rate: same union pattern with `http_response_status_code=~"5.."` for spring-boot, `status=~"5.."` for dotnet/fastapi
- Row 3 "Latency":
  - P99 Latency: union `histogram_quantile(0.99, sum by (job, le) (rate(http_server_request_duration_seconds_bucket{job="spring-boot-app"}[$interval])))` and similar for `http_request_duration_seconds_bucket`
- Row 4 "Azure Function":
  - Invocations stat: `azure_func_invocations_total`

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('grafana/dashboards/overview.json'))"`
Expected: No output (valid JSON)

**Step 3: Commit**

```bash
git add grafana/dashboards/overview.json
git commit -m "fix: rewrite overview dashboard for file provisioning + polish"
```

---

### Task 2: Rewrite spring-boot.json

**Files:**

- Modify: `grafana/dashboards/spring-boot.json`

**Step 1: Rewrite the dashboard**

Complete rewrite with:

- Bare root, common pattern, `$datasource` variable
- Link back to overview
- Row 1 "HTTP Performance":
  - Request Rate by Endpoint: `sum by (http_route) (rate(http_server_request_duration_seconds_count{job="spring-boot-app"}[5m]))` (existing, correct)
  - Latency P50/P95/P99: existing queries (correct)
  - **NEW** Error Rate: `sum(rate(http_server_request_duration_seconds_count{job="spring-boot-app",http_response_status_code=~"5.."}[5m])) / sum(rate(http_server_request_duration_seconds_count{job="spring-boot-app"}[5m]))`
- Row 2 "JVM Runtime":
  - JVM Memory: existing query (correct)
  - JVM GC Pause: existing query (correct)
  - JVM Threads: existing query (correct)
  - **NEW** CPU Usage: `rate(process_cpu_seconds_total{job="spring-boot-app"}[5m])`
- Row 3 "Application":
  - Items Processed: existing query (correct)

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('grafana/dashboards/spring-boot.json'))"`

**Step 3: Commit**

```bash
git add grafana/dashboards/spring-boot.json
git commit -m "fix: rewrite spring-boot dashboard for file provisioning + polish"
```

---

### Task 3: Rewrite dotnet.json

**Files:**

- Modify: `grafana/dashboards/dotnet.json`

**Step 1: Rewrite the dashboard**

Complete rewrite with:

- Bare root, common pattern, `$datasource` variable
- Link back to overview
- Row 1 "HTTP Performance":
  - Request Rate by Endpoint: existing `http_request_duration_seconds_count` with `controller`, `action` labels (correct)
  - Latency P50/P95/P99: existing queries (correct)
  - Error Rate (carry over pattern from fastapi)
- Row 2 ".NET Runtime":
  - GC Collections: existing `dotnet_collection_count_total` (correct)
  - ThreadPool: existing `dotnet_threadpool_num_threads` (correct)
  - **NEW** CPU Usage: `rate(process_cpu_seconds_total{job="dotnet-app"}[5m])`
- Row 3 "Health":
  - Health Check Status: existing `up{job="dotnet-app"}` (correct)

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('grafana/dashboards/dotnet.json'))"`

**Step 3: Commit**

```bash
git add grafana/dashboards/dotnet.json
git commit -m "fix: rewrite dotnet dashboard for file provisioning + polish"
```

---

### Task 4: Rewrite fastapi.json

**Files:**

- Modify: `grafana/dashboards/fastapi.json`

**Step 1: Rewrite the dashboard**

Complete rewrite with:

- Bare root, common pattern, `$datasource` variable
- Link back to overview
- Row 1 "HTTP Performance":
  - Request Rate by Endpoint: existing `http_request_duration_seconds_count` with `handler` label (correct)
  - Latency P50/P95/P99: existing queries (correct)
  - Error Rate: existing query (correct)
- Row 2 "Python Runtime":
  - **NEW** Process Memory: `process_resident_memory_bytes{job="fastapi-app"}`
  - **NEW** CPU Usage: `rate(process_cpu_seconds_total{job="fastapi-app"}[5m])`
  - Active Background Jobs: existing gauge (correct)

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('grafana/dashboards/fastapi.json'))"`

**Step 3: Commit**

```bash
git add grafana/dashboards/fastapi.json
git commit -m "fix: rewrite fastapi dashboard for file provisioning + polish"
```

---

### Task 5: Rewrite azure-func.json

**Files:**

- Modify: `grafana/dashboards/azure-func.json`

**Step 1: Rewrite the dashboard**

Complete rewrite with:

- Bare root, common pattern, `$datasource` variable
- Link back to overview
- Row 1 "Invocations":
  - Invocation Count by Status: existing `azure_func_invocations_total` (correct)
  - Duration P50/P95/P99: existing histogram queries (correct)
- Row 2 "Health":
  - Success vs Error: existing piechart (correct)
  - **FIX** Pushgateway Last Push: change to `time() - push_time_seconds{exported_job="azure-func"}`

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('grafana/dashboards/azure-func.json'))"`

**Step 3: Commit**

```bash
git add grafana/dashboards/azure-func.json
git commit -m "fix: rewrite azure-func dashboard for file provisioning + fix push label"
```

---

### Task 6: Rewrite infrastructure.json

**Files:**

- Modify: `grafana/dashboards/infrastructure.json`

**Step 1: Rewrite the dashboard**

Complete rewrite with:

- Bare root, common pattern, `$datasource` variable
- Link back to overview
- Row 1 "Prometheus":
  - Scrape Duration: existing query (correct)
  - Target Count: existing queries (correct)
  - **NEW** TSDB Head Series: `prometheus_tsdb_head_series`
- Row 2 "Thanos":
  - Compactor Status: existing query with value mappings (correct)
  - Store Status: existing gRPC connections query (correct)
- Row 3 "Pushgateway & MinIO":
  - Pushgateway Staleness: existing query (correct)
  - **NEW** MinIO Health: `minio_cluster_health_status` with UP/DOWN mappings

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('grafana/dashboards/infrastructure.json'))"`

**Step 3: Commit**

```bash
git add grafana/dashboards/infrastructure.json
git commit -m "fix: rewrite infrastructure dashboard for file provisioning + add MinIO/TSDB"
```

---

### Task 7: Rewrite blackbox.json

**Files:**

- Modify: `grafana/dashboards/blackbox.json`

**Step 1: Rewrite the dashboard**

Complete rewrite with:

- Bare root, common pattern, `$datasource` variable
- Link back to overview
- Row 1 "Probe Status":
  - Probe Success/Failure: existing stat panel with mappings (correct)
  - **NEW** HTTP Status Code: `probe_http_status_code` as stat per instance
- Row 2 "Probe Performance":
  - Probe Duration: existing timeseries (correct)
  - DNS Lookup: existing timeseries (correct)
- Row 3 "TLS":
  - SSL Cert Expiry: existing stat with thresholds (correct)

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('grafana/dashboards/blackbox.json'))"`

**Step 3: Commit**

```bash
git add grafana/dashboards/blackbox.json
git commit -m "fix: rewrite blackbox dashboard for file provisioning + add HTTP status"
```

---

### Task 8: Rewrite alerts.json

**Files:**

- Modify: `grafana/dashboards/alerts.json`

**Step 1: Rewrite the dashboard**

Complete rewrite with:

- Bare root, common pattern, `$datasource` variable
- Link back to overview
- Row 1 "Active Alerts":
  - Firing Alerts table: existing query (correct)
  - **NEW** Pending Alerts table: `ALERTS{alertstate="pending"}` with same table format
- Row 2 "Trends":
  - Alert History: existing firing count timeseries (correct)
- Row 3 "Breakdown":
  - By Severity: existing piechart (correct)
  - Alertmanager Notifications: existing rate query (correct)

**Step 2: Validate JSON**

Run: `python3 -c "import json; json.load(open('grafana/dashboards/alerts.json'))"`

**Step 3: Commit**

```bash
git add grafana/dashboards/alerts.json
git commit -m "fix: rewrite alerts dashboard for file provisioning + add pending alerts"
```
