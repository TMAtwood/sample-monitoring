import express from "express";
import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from "prom-client";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import { statfsSync } from "fs";
import v8 from "v8";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3002;
const START_TIME = new Date();

// ── Load static data ────────────────────────────────────
const securities = JSON.parse(readFileSync(join(__dirname, "data/securities.json"), "utf8"));
const portfolios = JSON.parse(readFileSync(join(__dirname, "data/portfolios.json"), "utf8"));
const holdings = JSON.parse(readFileSync(join(__dirname, "data/holdings.json"), "utf8"));

const securityMap = new Map(securities.map((s) => [s.id, s]));
const portfolioMap = new Map(portfolios.map((p) => [p.id, p]));

function enrichHolding(h) {
  const sec = securityMap.get(h.securityId);
  const port = portfolioMap.get(h.portfolioId);
  const gainLoss = h.marketValue - h.costBasis;
  return {
    ...h,
    ticker: sec?.ticker ?? "?",
    securityName: sec?.name ?? "?",
    portfolioName: port?.name ?? "?",
    gainLoss,
    gainLossPercent: h.costBasis > 0 ? (gainLoss / h.costBasis) * 100 : 0,
  };
}

// ── PostgreSQL pool ─────────────────────────────────────
const pool = new pg.Pool({ max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 });

// ── Prometheus metrics ──────────────────────────────────
collectDefaultMetrics({ prefix: "react_dashboard_" });

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "code"],
});

const httpActiveConnections = new Gauge({
  name: "http_active_connections",
  help: "Number of active HTTP connections",
});

// ── Metrics middleware ──────────────────────────────────
app.use((req, res, next) => {
  httpActiveConnections.inc();
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    httpActiveConnections.dec();
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;

    let route = req.path;
    if (route.startsWith("/api")) route = "/api";
    else if (!["/metrics", "/healthz", "/live", "/ready"].includes(route)) route = "/";

    const labels = { method: req.method, route, code: res.statusCode };
    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);
  });

  next();
});

// ── API endpoints ───────────────────────────────────────
app.get("/api/securities", (_req, res) => res.json(securities));

app.get("/api/securities/:id", (req, res) => {
  const sec = securities.find((s) => s.id === parseInt(req.params.id));
  if (!sec) return res.status(404).json({ error: "Not found" });
  const secHoldings = holdings.filter((h) => h.securityId === sec.id).map(enrichHolding);
  res.json({ ...sec, holdings: secHoldings });
});

app.get("/api/portfolios", (_req, res) => res.json(portfolios));

app.get("/api/portfolios/:id", (req, res) => {
  const port = portfolios.find((p) => p.id === parseInt(req.params.id));
  if (!port) return res.status(404).json({ error: "Not found" });
  const portHoldings = holdings.filter((h) => h.portfolioId === port.id).map(enrichHolding);
  res.json({ ...port, holdings: portHoldings });
});

app.get("/api/holdings", (_req, res) => res.json(holdings.map(enrichHolding)));

// ── Health check helpers ────────────────────────────────
function formatDuration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(3)}s` : `${ms.toFixed(2)}ms`;
}

function timedCheck(fn) {
  return async () => {
    const start = performance.now();
    const result = await fn();
    const durationMs = performance.now() - start;
    return { ...result, duration: formatDuration(durationMs), durationMs: Math.round(durationMs * 100) / 100 };
  };
}

function uptimeCheck() {
  const uptime = process.uptime();
  const d = Math.floor(uptime / 86400), h = Math.floor((uptime % 86400) / 3600), m = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
  const formatted = `${d}.${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  let threadCount = 1;
  try { threadCount = execFileSync("ls", ["/proc/self/task"], { encoding: "utf8" }).trim().split("\n").length; } catch {}
  return { name: "uptime", status: "Healthy", description: `Up for ${formatted}`, data: { start_time: START_TIME.toISOString(), uptime: formatted, uptime_seconds: Math.round(uptime * 10) / 10, process_id: process.pid, thread_count: threadCount, node_version: process.version } };
}

function memoryCheck() {
  const heapStats = v8.getHeapStatistics();
  const rssMb = process.memoryUsage.rss() / (1024 * 1024);
  const data = { rss_mb: Math.round(rssMb * 100) / 100, heap_used_mb: Math.round(heapStats.used_heap_size / (1024 * 1024) * 100) / 100, heap_total_mb: Math.round(heapStats.total_heap_size / (1024 * 1024) * 100) / 100, threshold_degraded_mb: 150, threshold_unhealthy_mb: 300, heap_size_limit_mb: Math.round(heapStats.heap_size_limit / (1024 * 1024) * 100) / 100 };
  if (rssMb >= 300) return { name: "memory", status: "Unhealthy", description: `Memory critically high: ${rssMb.toFixed(1)} MB`, data };
  if (rssMb >= 150) return { name: "memory", status: "Degraded", description: `Memory elevated: ${rssMb.toFixed(1)} MB`, data };
  return { name: "memory", status: "Healthy", description: `Memory OK: ${rssMb.toFixed(1)} MB`, data };
}

async function databaseCheck() {
  const start = performance.now();
  try {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT 1 AS ok, version() AS version");
      const elapsed = Math.round(performance.now() - start);
      const data = { server: `${process.env.PGHOST || "postgres"}:${process.env.PGPORT || "5432"}`, database: process.env.PGDATABASE || "orders_db", query: "SELECT 1", response_time_ms: elapsed, pg_version: result.rows[0].version.split(" ").slice(0, 2).join(" "), total_connections: pool.totalCount, idle_connections: pool.idleCount, waiting_clients: pool.waitingCount };
      if (elapsed > 100) return { name: "database", status: "Degraded", description: `PostgreSQL responding slowly (${elapsed} ms)`, data };
      return { name: "database", status: "Healthy", description: `PostgreSQL OK (${elapsed} ms)`, data };
    } finally { client.release(); }
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return { name: "database", status: "Unhealthy", description: `PostgreSQL connection failed: ${err.message}`, data: { response_time_ms: elapsed, error: err.code || err.message } };
  }
}

function diskSpaceCheck() {
  try {
    const stats = statfsSync("/");
    const totalBytes = stats.bsize * stats.blocks, freeBytes = stats.bsize * stats.bavail;
    const freeMb = freeBytes / (1024 * 1024), usedPct = ((1 - freeBytes / totalBytes) * 100);
    const data = { drive: "/", total_mb: Math.round(totalBytes / (1024 * 1024) * 10) / 10, free_mb: Math.round(freeMb * 10) / 10, used_percent: Math.round(usedPct * 10) / 10 };
    if (freeMb <= 100) return { name: "disk_space", status: "Unhealthy", description: `Disk critically low: ${Math.round(freeMb)} MB free`, data };
    if (freeMb <= 500) return { name: "disk_space", status: "Degraded", description: `Disk space low: ${Math.round(freeMb)} MB free`, data };
    return { name: "disk_space", status: "Healthy", description: `Disk OK: ${Math.round(freeMb)} MB free (${usedPct.toFixed(1)}% used)`, data };
  } catch { return { name: "disk_space", status: "Healthy", description: "Disk check not available", data: {} }; }
}

async function httpDependencyCheck(url, name) {
  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const elapsed = Math.round(performance.now() - start);
    const data = { endpoint: url, status_code: response.status, response_time_ms: elapsed };
    if (response.ok) return { name, status: "Healthy", description: `${name} is reachable (${elapsed} ms)`, data };
    return { name, status: "Unhealthy", description: `${name} returned ${response.status} (${elapsed} ms)`, data };
  } catch (err) {
    return { name, status: "Unhealthy", description: `${name} is unreachable: ${err.message}`, data: { endpoint: url, response_time_ms: Math.round(performance.now() - start) } };
  }
}

async function runChecks(checks) {
  const start = performance.now();
  const results = await Promise.all(checks.map((fn) => timedCheck(fn)()));
  const totalMs = performance.now() - start;
  const statuses = results.map((r) => r.status);
  let overall = "Healthy";
  if (statuses.includes("Unhealthy")) overall = "Unhealthy";
  else if (statuses.includes("Degraded")) overall = "Degraded";
  return { status: overall, totalDuration: formatDuration(totalMs), totalDurationMs: Math.round(totalMs * 100) / 100, checks: results };
}

// ── Health endpoints ────────────────────────────────────
app.get("/healthz", (_req, res) => res.json({ status: "healthy", uptime: process.uptime() }));

app.get("/live", async (_req, res) => {
  const report = await runChecks([() => Promise.resolve(uptimeCheck()), () => Promise.resolve(memoryCheck())]);
  res.status(report.status === "Unhealthy" ? 503 : 200).json(report);
});

app.get("/ready", async (_req, res) => {
  const report = await runChecks([databaseCheck, () => Promise.resolve(diskSpaceCheck()), () => httpDependencyCheck("http://prometheus-use1-1:9090/-/healthy", "prometheus")]);
  res.status(report.status === "Unhealthy" ? 503 : 200).json(report);
});

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// ── Serve SPA ───────────────────────────────────────────
app.use(express.static(join(__dirname, "dist")));
app.get("*", (_req, res) => res.sendFile(join(__dirname, "dist", "index.html")));

app.listen(PORT, () => console.log(`react-dashboard-app listening on port ${PORT}`));
