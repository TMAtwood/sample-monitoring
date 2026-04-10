import express from "express";
import { collectDefaultMetrics, Counter, Histogram, Gauge, register } from "prom-client";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import os from "os";
import fs from "fs";
import v8 from "v8";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;
const START_TIME = new Date();

// ── PostgreSQL connection pool ──────────────────────────
const pool = new pg.Pool({
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ── Prometheus metrics ──────────────────────────────────
collectDefaultMetrics({ prefix: "react_admin_" });

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
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    // Collapse SPA routes to "/" for cleaner metrics
    let route = req.path;
    if (!["/metrics", "/healthz", "/live", "/ready"].includes(route)) {
      route = "/";
    }

    const labels = { method: req.method, route, code: res.statusCode };
    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);
  });

  next();
});

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

// ── Liveness checks ─────────────────────────────────────

function uptimeCheck() {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const formatted = `${days}.${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  let threadCount = 1;
  try {
    const output = execFileSync("ls", ["/proc/self/task"], { encoding: "utf8" });
    threadCount = output.trim().split("\n").length;
  } catch { /* not available on all platforms */ }

  return {
    name: "uptime",
    status: "Healthy",
    description: `Up for ${formatted}`,
    data: {
      start_time: START_TIME.toISOString(),
      uptime: formatted,
      uptime_seconds: Math.round(uptime * 10) / 10,
      process_id: process.pid,
      thread_count: threadCount,
      node_version: process.version,
    },
  };
}

function memoryCheck() {
  const DEGRADED_MB = 150;
  const UNHEALTHY_MB = 300;

  const heapStats = v8.getHeapStatistics();
  const rss = process.memoryUsage.rss();
  const rssMb = rss / (1024 * 1024);
  const heapUsedMb = heapStats.used_heap_size / (1024 * 1024);
  const heapTotalMb = heapStats.total_heap_size / (1024 * 1024);

  const data = {
    rss_mb: Math.round(rssMb * 100) / 100,
    heap_used_mb: Math.round(heapUsedMb * 100) / 100,
    heap_total_mb: Math.round(heapTotalMb * 100) / 100,
    threshold_degraded_mb: DEGRADED_MB,
    threshold_unhealthy_mb: UNHEALTHY_MB,
    external_mb: Math.round(process.memoryUsage().external / (1024 * 1024) * 100) / 100,
    heap_size_limit_mb: Math.round(heapStats.heap_size_limit / (1024 * 1024) * 100) / 100,
  };

  if (rssMb >= UNHEALTHY_MB) {
    return { name: "memory", status: "Unhealthy", description: `Memory critically high: ${rssMb.toFixed(1)} MB`, data };
  }
  if (rssMb >= DEGRADED_MB) {
    return { name: "memory", status: "Degraded", description: `Memory elevated: ${rssMb.toFixed(1)} MB`, data };
  }
  return { name: "memory", status: "Healthy", description: `Memory OK: ${rssMb.toFixed(1)} MB`, data };
}

// ── Readiness checks ────────────────────────────────────

async function databaseCheck() {
  const server = `${process.env.PGHOST || "postgres"}:${process.env.PGPORT || "5432"}`;
  const database = process.env.PGDATABASE || "orders_db";
  const start = performance.now();

  try {
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT 1 AS ok, version() AS version");
      const elapsed = Math.round(performance.now() - start);
      const row = result.rows[0];

      const data = {
        server,
        database,
        query: "SELECT 1",
        response_time_ms: elapsed,
        max_pool_size: pool.options.max,
        total_connections: pool.totalCount,
        idle_connections: pool.idleCount,
        waiting_clients: pool.waitingCount,
        pg_version: row.version.split(" ").slice(0, 2).join(" "),
      };

      // Flag as degraded if the query took more than 100ms
      if (elapsed > 100) {
        return { name: "database", status: "Degraded", description: `PostgreSQL responding slowly (${elapsed} ms)`, data };
      }

      return { name: "database", status: "Healthy", description: `PostgreSQL OK (${elapsed} ms)`, data };
    } finally {
      client.release();
    }
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return {
      name: "database",
      status: "Unhealthy",
      description: `PostgreSQL connection failed: ${err.message}`,
      data: {
        server,
        database,
        response_time_ms: elapsed,
        error: err.code || err.message,
      },
    };
  }
}

function diskSpaceCheck() {
  const DEGRADED_MB = 500;
  const UNHEALTHY_MB = 100;

  let totalBytes, freeBytes;
  try {
    const stats = fs.statfsSync("/");
    totalBytes = stats.bsize * stats.blocks;
    freeBytes = stats.bsize * stats.bavail;
  } catch {
    return { name: "disk_space", status: "Healthy", description: "Disk check not available", data: {} };
  }

  const totalMb = totalBytes / (1024 * 1024);
  const freeMb = freeBytes / (1024 * 1024);
  const usedPercent = ((1 - freeBytes / totalBytes) * 100);

  const data = {
    drive: "/",
    total_mb: Math.round(totalMb * 10) / 10,
    free_mb: Math.round(freeMb * 10) / 10,
    used_percent: Math.round(usedPercent * 10) / 10,
  };

  if (freeMb <= UNHEALTHY_MB) {
    return { name: "disk_space", status: "Unhealthy", description: `Disk critically low: ${Math.round(freeMb)} MB free`, data };
  }
  if (freeMb <= DEGRADED_MB) {
    return { name: "disk_space", status: "Degraded", description: `Disk space low: ${Math.round(freeMb)} MB free`, data };
  }
  return { name: "disk_space", status: "Healthy", description: `Disk OK: ${Math.round(freeMb)} MB free (${usedPercent.toFixed(1)}% used)`, data };
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

    if (response.ok) {
      return { name, status: "Healthy", description: `${name} is reachable (${elapsed} ms)`, data };
    }
    return { name, status: "Unhealthy", description: `${name} returned ${response.status} (${elapsed} ms)`, data };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    return { name, status: "Unhealthy", description: `${name} is unreachable: ${err.message}`, data: { endpoint: url, response_time_ms: elapsed } };
  }
}

async function runChecks(checks) {
  const overallStart = performance.now();
  const results = await Promise.all(checks.map((fn) => timedCheck(fn)()));
  const totalMs = performance.now() - overallStart;

  const statuses = results.map((r) => r.status);
  let overallStatus = "Healthy";
  if (statuses.includes("Unhealthy")) overallStatus = "Unhealthy";
  else if (statuses.includes("Degraded")) overallStatus = "Degraded";

  return {
    status: overallStatus,
    totalDuration: formatDuration(totalMs),
    totalDurationMs: Math.round(totalMs * 100) / 100,
    checks: results,
  };
}

// ── Health endpoints ────────────────────────────────────

app.get("/healthz", (_req, res) => {
  res.json({ status: "healthy", uptime: process.uptime() });
});

app.get("/live", async (_req, res) => {
  const report = await runChecks([
    () => Promise.resolve(uptimeCheck()),
    () => Promise.resolve(memoryCheck()),
  ]);

  const statusCode = report.status === "Unhealthy" ? 503 : 200;
  res.status(statusCode).json(report);
});

app.get("/ready", async (_req, res) => {
  const report = await runChecks([
    databaseCheck,
    () => Promise.resolve(diskSpaceCheck()),
    () => httpDependencyCheck("http://prometheus-use1-1:9090/-/healthy", "prometheus"),
  ]);

  const statusCode = report.status === "Unhealthy" ? 503 : 200;
  res.status(statusCode).json(report);
});

// ── Prometheus metrics endpoint ─────────────────────────
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// ── Serve SPA ───────────────────────────────────────────
app.use(express.static(join(__dirname, "dist")));

app.get("*", (_req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// ── Start server ────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`react-admin-app listening on port ${PORT}`);
});
