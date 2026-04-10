# Monitoring Stack Demo Script

**Presenter:** Thomas Atwood
**Audience:** Moorthi + Architecture Team
**Duration:** 15 min guided tour + 15 min Q&A
**Vibe:** Fast-moving, polished, "wow we built all this?" energy

---

## Pre-Demo Checklist (5 min before)

- [ ] Stack is running: `podman compose up -d`
- [ ] Verify 25+ containers running: `podman ps` (minio-init exits after setup — this is normal)
- [ ] Generate traffic data (run 5 min before): `./scripts/generate-traffic.sh 300`
- [ ] Open these browser tabs, ready to switch:
  1. React Dashboard (`http://localhost:8086`) — logged out, on login screen
  2. React Admin (`http://localhost:8085`) — logged out, on login screen
  3. Grafana — Service Overview dashboard (`http://localhost:3000/d/overview`) — logged in (admin/admin)
  4. Grafana — Distributed Tracing dashboard (`http://localhost:3000/d/tracing`)
  5. Grafana — PostgreSQL dashboard (`http://localhost:3000/d/postgres`)
  6. Grafana — Alerts dashboard (`http://localhost:3000/d/alerts`)
  7. Grafana — Explore tab — datasource set to Tempo, query type Search, service `dotnet-app`, min duration `50ms`
  8. Mailhog (`http://localhost:8025`) — should have alert emails from simulated failures
  9. Terminal with commands ready
- [ ] In Grafana Explore (Tempo), run the query so results are pre-loaded and ready to click
- [ ] Verify Mailhog has at least one alert email (check `http://localhost:8025`)

---

## Minute 0:00 — The Hook (30 sec)

"Thanks everyone for the time. What I'm about to show you took less than a week to build — and a good chunk of it was built with AI assistance using Claude Code. This is a full production-grade observability stack: metrics, logs, distributed tracing, alerting — 26 containers, 6 application services written in four different languages, 10 Grafana dashboards, 24 alert rules — all running from a single compose file on my laptop. Let me show you what we've got."

---

## Minute 0:30 — React Dashboard App (1.5 min)

*[Tab: React Dashboard — http://localhost:8086, showing login screen]*

"Let's start with the front end. This is a React 19 app — Vite, Tailwind, ShadCN/UI, TanStack Router and Query. Geode branding throughout."

*[Type in thomas.atwood@geodecapital.com / demo12345 and log in]*

"After login we land on the Investment Dashboard. Summary cards with live data — total AUM, securities count, average YTD return. Portfolio performance with color-coded returns, sector allocation breakdown."

*[Click "Securities" in the sidebar]*

"Security Master — 30 US equities, filterable by sector, searchable by ticker."

*[Click on AAPL or NVDA to open detail view]*

"Detail view with stat cards and tabbed holdings — which portfolios hold this, at what weight, what market value."

*[Click "Editor" in the sidebar]*

"And this is fun — we embedded Monaco, the same editor that powers VS Code, right inside the app. You can view and edit Prometheus alert rules in YAML or Grafana dashboard JSON with full syntax highlighting. Polished, not a prototype."

---

## Minute 2:00 — React Admin App (30 sec)

*[Switch tab: React Admin — http://localhost:8085, showing login screen]*

"Second frontend — completely different framework. React Admin by Marmelab — full CRUD out of the box. Same Geode branding, same data domain."

*[Log in, show dashboard briefly, click into Portfolios or Holdings]*

"Built-in list views, filters, edit forms. The point: two different React frameworks, both producing real HTTP traffic, both fully instrumented for monitoring. Two frontends, one sprint."

---

## Minute 2:30 — The Health Check Contract (1 min)

*[Switch to terminal]*

"Now under the hood. Every service — regardless of language — implements the same health check contract."

*[Run: `curl -s http://localhost:8086/ready | jq .`]*

"React Dashboard readiness: real Postgres connectivity check with response time and pool stats, disk space with free megabytes, HTTP probe to Prometheus. Every check has status, duration, and data payload."

*[Run: `curl -s http://localhost:8083/health/live | jq .`]*

"FastAPI — Python. Uptime with PID, memory with GC stats and threshold warnings. Same JSON structure."

*[Run: `curl -s http://localhost:8082/health/ready | jq .`]*

".NET — database check, disk space, plus HTTP probes to Thanos Query, Loki, and Prometheus. Four languages, one contract. Any on-call engineer reads any service's health endpoint and immediately knows what they're seeing."

---

## Minute 3:30 — Service Overview Dashboard (1.5 min)

*[Switch to Grafana — Service Overview dashboard tab]*

"Now let's talk about what we're actually monitoring. This is the Service Overview dashboard — the single pane of glass."

*[Point out the service status panels at the top]*

"Across the top: every service's up/down status at a glance. Green means the scrape target is healthy, red means it's unreachable. Six app services plus infrastructure — all reporting in on a 15-second scrape interval."

*[Scroll to the request rate and error rate panels]*

"Below that: request rates per service, error rates, and latency percentiles — P50, P95, P99 — all in real time. You can see the traffic that our generate-traffic script is producing. Notice the FastAPI service has a slightly elevated error rate — that's intentional, we simulate ~5% failures to make the monitoring data realistic."

*[Point out the datasource selector showing Thanos]*

"And notice the datasource here is Thanos, not Prometheus directly. That's important — Thanos is deduplicating across our two Prometheus replicas and giving Grafana one clean, unified view."

---

## Minute 5:00 — Prometheus HA & Thanos (1 min)

*[Stay in Grafana, switch to Explore tab, Thanos datasource, type `up` and Run]*

"Under the hood: two Prometheus replicas independently scraping every target on a 15-second interval. Here's the `up` metric — every scrape target in the stack. Spring Boot, .NET, FastAPI, both React apps, Postgres exporter, Loki, Tempo, OTel Collector, Blackbox — all reporting in."

"If replica one goes down, replica two keeps scraping. Zero gap. Thanos Query deduplicates by replica label. And Thanos Sidecars upload blocks to MinIO — S3-compatible object storage — for long-term retention. We also have a Store Gateway for querying historical data and a Compactor for downsampling. Full production Thanos deployment."

---

## Minute 6:00 — Distributed Tracing: THE WOW MOMENT (3.5 min)

*[Switch to terminal]*

"Now here's where it gets really interesting. Watch this."

*[Run: `curl -s http://localhost:8082/api/orders/with-items | jq . | head -5`]*

"That single curl just triggered a chain reaction. The .NET app received the request, queried Postgres for orders, then called the Spring Boot app over HTTP, which queried Postgres for items. Two services, two databases, one request."

"And we have two more chains just like it."

*[Run: `curl -s http://localhost:8081/api/items/with-tasks | jq . | head -5`]*

"Spring Boot calls FastAPI."

*[Run: `curl -s http://localhost:8083/api/tasks/with-orders | jq . | head -5`]*

"FastAPI calls .NET. Three services, each calling the next — a full triangle of dependencies. And because we have OpenTelemetry instrumentation on every service, every hop was captured as a distributed trace."

### The Waterfall

*[Switch to Grafana — Explore tab with Tempo results pre-loaded]*

"Here are the traces. See the ones around 150-200 milliseconds? Those are the cross-service calls."

*[Click on a trace for GET /api/orders/with-items or GET /api/items/with-tasks]*

"The waterfall view. Same visualization you'd see in Jaeger, Zipkin, or Azure Application Insights. Top span: the inbound HTTP request. Nested underneath: a database span — the actual SQL query, you can see it took about a millisecond. Then an outbound HTTP call to the next service. And inside that, the downstream service's own spans with its own database call."

"Each bar is a span. Colors represent different services. Nesting shows parent-child. Width shows duration. You can see exactly where time is spent across the entire request chain."

"The instrumentation is all auto-discovered. The Spring Boot app uses the OTel Java agent — zero code changes, it instruments JDBC and HTTP by bytecode manipulation. .NET uses the OTel SDK with Npgsql tracing. FastAPI uses psycopg and httpx instrumentation. Different languages, different libraries, same trace."

### The Service Map

*[Switch to Grafana — Distributed Tracing dashboard tab]*

"Now look at this — the Service Map. Grafana generates this automatically from trace data. No one drew this diagram. The system discovered its own architecture."

*[Point out the nodes and edges showing service dependencies]*

"You can see the triangle: dotnet calls spring-boot, spring-boot calls fastapi, fastapi calls dotnet. Each node shows request rate and error rate. This is a live, self-updating architecture diagram derived purely from observed traffic."

### Cross-Signal Correlation: Traces to Logs

*[Go back to Grafana Explore, Tempo, click on a trace span]*

"But here's the real power. See this 'Logs for this span' link?"

*[Click the traces-to-logs link on a span]*

"One click — and I'm looking at the exact log lines from that service, filtered to this specific trace ID. I didn't search for anything. The trace context propagated through HTTP headers, the OTel instrumentation injected the trace ID into the logging context, Promtail extracted it, and Grafana linked them together."

*[Switch Explore datasource to Loki, query: `{container="fastapi-app"}`]*

"And it works the other direction too. Here are the FastAPI logs in Loki. See the trace ID in the log line?"

*[Click on a log line, find the TraceID derived field, click 'View Trace']*

"Click 'View Trace' — and I'm back in Tempo looking at the full distributed trace. Logs to traces, traces to logs. This is what correlated observability looks like. Metrics tell you something is wrong. Logs tell you what happened. Traces tell you where across services. And they're all linked."

---

## Minute 9:30 — Dashboard Tour (2 min)

"Let me do a quick tour of what else we're monitoring."

### PostgreSQL

*[Switch to Grafana — PostgreSQL dashboard tab]*

"PostgreSQL dashboard. Uptime, version, active connections out of the max pool, database size. Down here — cache hit ratio. You want this above 95%; below that, your queries are hitting disk instead of shared buffers. Deadlock detection, transaction throughput, row operations broken down by inserts, updates, deletes, fetches."

"All of this comes from the Postgres Exporter — a sidecar that queries `pg_stat` views and exposes them as Prometheus metrics. Zero changes to the database itself."

### Blackbox Probing

*[Switch to Grafana — navigate to Blackbox dashboard (http://localhost:3000/d/blackbox)]*

"Blackbox monitoring — external health probes. We're doing HTTP probes against all six services and TCP connection checks against Prometheus, Grafana, and Postgres. This is the outside-in view: can I actually reach this service right now? Probe success rate, response times, HTTP status codes. If internal metrics say everything is fine but Blackbox says the endpoint is unreachable, you know the problem is network-level."

### Alerts Dashboard

*[Switch to Grafana — Alerts dashboard tab]*

"And the Alerts dashboard. Firing alerts, pending alerts, alert history over time, breakdown by severity. We have 24 alert rules across five domains: service health, infrastructure, Postgres, blackbox probes, and meta-alerts — alerts that monitor the monitoring system itself. If Prometheus can't scrape, if Thanos Compactor halts, if Alertmanager goes down — we know."

---

## Minute 11:30 — Alerting Pipeline Live (1.5 min)

*[Open prometheus/rules/service-alerts.yml in Monaco editor tab, or describe verbally]*

"Let me show the alerting pipeline end to end. Here's `service-alerts.yml`. Five rules: `ServiceDown` fires critical if any scrape target is unreachable for 60 seconds. `HighErrorRate` fires warning if 5xx errors exceed 5% for five minutes. Latency P99 rules at warning and critical thresholds. And `TooManyInFlightRequests` for concurrency pressure."

"Alerts flow from Prometheus to Alertmanager, which handles grouping, deduplication, and routing. Critical alerts route to one receiver with a 1-minute group wait and 1-hour repeat. Warnings route separately with a 5-minute group wait. And there's an inhibition rule: if a critical alert fires, it suppresses the corresponding warning — so you don't get paged twice for the same problem."

*[Switch to Mailhog tab — http://localhost:8025]*

"And here's the proof. Mailhog is catching the alert emails. Let me open one."

*[Click on an alert email]*

"Fully formatted HTML — alert name, severity, which job, which instance, description. Red banner for firing, green for resolved. In production, this routes to PagerDuty, Slack, or email. Locally, Mailhog lets us verify the entire pipeline end to end without spamming anyone."

---

## Minute 13:00 — Architecture + AI Story (1.5 min)

"Let me tie it together. Three data flows:"

"Metrics: services expose `/metrics`. Two Prometheus replicas scrape on 15-second intervals. Thanos Sidecars upload to S3. Thanos Query deduplicates. Ten Grafana dashboards visualize."

"Logs: containers emit stdout. Promtail auto-discovers via Docker socket, ships to Loki. Grafana queries Loki. Trace IDs in logs link back to Tempo."

"Traces: services emit OTLP spans to the OpenTelemetry Collector. Collector batches and exports to Tempo. Tempo stores in S3 and generates RED metrics back into Prometheus. Grafana queries Tempo — with service maps, trace-to-log links, and metrics correlation."

"Six services. Four languages — Java 24, .NET 10, Python 3.14, TypeScript on Node. Every one has the same health check contract, the same metrics format, the same trace propagation."

"And all of this — the six services, the HA Prometheus, the Thanos integration, the OTel instrumentation across four languages, the two React frontends with Geode branding, the health check patterns, 24 alert rules, 10 dashboards, the Grafana datasource provisioning with cross-signal linking — was built in under a week using Claude Code as an AI pair programmer."

"I drove the architecture. I made the design decisions. Claude Code handled the velocity — wiring up OTel across four languages, authoring ShadCN components, writing Prometheus relabeling configs, building Grafana dashboard JSON. What would normally be a multi-sprint effort was done in days. And these patterns are production-grade — any team can fork this repo and have observability from day one."

---

## Minute 14:30 — Close (30 sec)

"So to wrap up: 26 containers, one compose file, `podman compose up`, and you have a complete observability platform. HA metrics with Thanos. Logs with Loki. Distributed tracing with Tempo and auto-generated service maps. Full cross-signal correlation — traces to logs, logs to traces, traces to metrics. 24 alert rules with HTML email delivery. Database monitoring. External blackbox probes. Six services across four languages, all speaking the same observability language. And two polished React frontends."

"Happy to take questions."

---

## Q&A Prep — Anticipated Questions

| Question | Your Answer |
|---|---|
| **How does this compare to what Jude's team has?** | This goes significantly beyond what's in place today. We have HA Prometheus, long-term storage with Thanos, distributed tracing with auto-instrumented cross-service correlation, structured health checks, and a complete alerting pipeline. This is the target state. |
| **How does this compare to Azure Monitor / Datadog?** | Same three pillars — metrics, logs, traces. But open-source and vendor-neutral. The instrumentation is OpenTelemetry, which is the CNCF standard. If we move to Azure Monitor or Grafana Cloud later, the service-side code doesn't change — only the backend. |
| **What about cost?** | Everything here is open-source. In production, the main costs are storage (S3 for Thanos, Loki, and Tempo blocks) and compute for the Prometheus/Thanos layer. At our scale, significantly cheaper than commercial APM. |
| **How hard is it to onboard a new service?** | Three steps: add a /metrics endpoint (every language has a library), add a scrape job to prometheus.yml, add health endpoints following the contract. For tracing, OTel auto-instrumentation means zero code changes in most cases — just attach the agent. The service shows up in dashboards, service maps, and alerting automatically. |
| **Why not just use one Prometheus?** | Single point of failure. With two replicas, if one crashes or gets restarted, the other keeps scraping — no data gap. Thanos deduplicates transparently. In production, you'd put them in different availability zones. |
| **Can this run in Kubernetes?** | Yes, directly. Prometheus Operator manages the replicas. OTel Collector runs as a DaemonSet. Thanos components deploy as standard workloads. The application instrumentation code is identical — nothing changes. |
| **What's the AI angle? Is it reliable?** | Claude Code is a pair programmer, not autopilot. I set the architecture direction — which frameworks, which patterns, which trade-offs. The AI handles the implementation velocity — wiring up OTel across four languages, writing ShadCN components, authoring Prometheus configs. Every line was reviewed. The speed gain is real — what would normally be a multi-sprint effort was done in days. |
| **What about security?** | This demo skips auth for simplicity. Production additions: TLS on all internal traffic, OAuth2/OIDC on Grafana, network policies, secrets management for credentials (currently in .env). The architecture supports all of it. |
| **Can we use the React frontends as templates for real apps?** | Absolutely. The React Dashboard app demonstrates the modern stack we'd recommend — Vite, Tailwind, ShadCN/UI, TanStack. The monitoring patterns (metrics endpoint, health checks, structured readiness probes) are directly portable. |
| **How does the service map work?** | Tempo's metrics generator analyzes trace data and builds a service dependency graph. Grafana's node graph panel renders it automatically. No manual configuration — if Service A calls Service B, it appears. Add a new service with OTel, and it shows up in the map on its own. |
| **What about the push-based Azure Function?** | Azure Functions can't be scraped — they're ephemeral. So the function pushes metrics to Pushgateway on a 1-minute timer, and Prometheus scrapes Pushgateway. Same pipeline, different ingestion pattern. It also sends OTLP traces with manually created spans, so it shows up in Tempo too. |
| **What's MinIO doing here?** | MinIO provides S3-compatible object storage for three systems: Thanos stores long-term metric blocks, Loki stores log chunks, and Tempo stores trace data. In production, you'd point these at real S3 or Azure Blob. The configs are cloud-portable — just change the endpoint and credentials. |

---

## If You Have Extra Time — Bonus Beats

These are impressive features you can pull out during Q&A or if you're running ahead of schedule:

- **MinIO Console** (`http://localhost:9001`, login: thanos/changeme): Show the three buckets — `thanos-data`, `loki-data`, `tempo-data`. Visual proof that long-term storage is working.
- **Prometheus Targets UI** (`http://localhost:9081/targets`): Show all 20 scrape jobs with their up/down status and last scrape time.
- **Infrastructure Dashboard**: Prometheus scrape duration, TSDB head series, Thanos component status — monitoring the monitoring.
- **Per-Service Dashboards** (Spring Boot, .NET, FastAPI, Azure Function): Deep-dive into any individual service — JVM memory, GC, thread pools, custom counters.
- **Alertmanager UI** (`http://localhost:9093`): Show active alerts, silences, inhibition rules.
- **Live failure demo**: `podman stop fastapi-app`, wait 60s, watch `ServiceDown` fire in the Alerts dashboard, then show the email arrive in Mailhog. Restart with `podman start fastapi-app` and show the resolved email.
