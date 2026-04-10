import os
import random
import time
import platform
import shutil
import resource as sys_resource
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import psycopg_pool
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from prometheus_client import Gauge
from prometheus_fastapi_instrumentator import Instrumentator

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource

# ── OpenTelemetry setup ──────────────────────────────────
resource = Resource.create(
    {"service.name": os.environ.get("OTEL_SERVICE_NAME", "fastapi-app")}
)
provider = TracerProvider(resource=resource)
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
trace.set_tracer_provider(provider)

LoggingInstrumentor().instrument(set_logging_format=True)
PsycopgInstrumentor().instrument()
HTTPXClientInstrumentor().instrument()

# ── Database connection pool ─────────────────────────────
DB_DSN = os.environ.get(
    "DATABASE_URL",
    "postgresql://orders_app:changeme@postgres:5432/orders_db",
)

pool: psycopg_pool.AsyncConnectionPool | None = None

START_TIME = datetime.now(timezone.utc)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global pool
    pool = psycopg_pool.AsyncConnectionPool(DB_DSN, min_size=2, max_size=10, open=False)
    await pool.open()
    yield
    await pool.close()


app = FastAPI(title="FastAPI Sample Service", lifespan=lifespan)

# Instrument with OpenTelemetry
FastAPIInstrumentor.instrument_app(app)

# Custom gauge: active background jobs
active_jobs = Gauge(
    "fastapi_active_background_jobs",
    "Number of active background jobs",
)
active_jobs.set(0)

# Instrument HTTP metrics automatically
Instrumentator().instrument(app).expose(app, endpoint="/metrics")


# ════════════════════════════════════════════════════════
# HEALTH CHECK HELPERS
# ════════════════════════════════════════════════════════


def _format_duration(seconds: float) -> str:
    if seconds >= 1:
        return f"{seconds:.3f}s"
    return f"{seconds * 1000:.2f}ms"


async def _timed_check(fn):
    start = time.perf_counter()
    result = await fn()
    elapsed = time.perf_counter() - start
    result["duration"] = _format_duration(elapsed)
    result["durationMs"] = round(elapsed * 1000, 2)
    return result


async def _uptime_check() -> dict:
    uptime = (datetime.now(timezone.utc) - START_TIME).total_seconds()
    days = int(uptime // 86400)
    hours = int((uptime % 86400) // 3600)
    minutes = int((uptime % 3600) // 60)
    seconds = int(uptime % 60)
    formatted = f"{days}.{hours:02d}:{minutes:02d}:{seconds:02d}"

    return {
        "name": "uptime",
        "status": "Healthy",
        "description": f"Up for {formatted}",
        "data": {
            "start_time": START_TIME.isoformat(),
            "uptime": formatted,
            "uptime_seconds": round(uptime, 1),
            "process_id": os.getpid(),
            "python_version": platform.python_version(),
            "platform": platform.platform(),
        },
    }


async def _memory_check() -> dict:
    DEGRADED_MB = 150
    UNHEALTHY_MB = 300

    import gc

    usage = sys_resource.getrusage(sys_resource.RUSAGE_SELF)
    rss_mb = usage.ru_maxrss / 1024
    gc_stats = gc.get_stats()

    data = {
        "rss_mb": round(rss_mb, 2),
        "threshold_degraded_mb": DEGRADED_MB,
        "threshold_unhealthy_mb": UNHEALTHY_MB,
        "gc_gen0_collections": gc_stats[0]["collections"],
        "gc_gen1_collections": gc_stats[1]["collections"],
        "gc_gen2_collections": gc_stats[2]["collections"],
    }

    if rss_mb >= UNHEALTHY_MB:
        return {
            "name": "memory",
            "status": "Unhealthy",
            "description": f"Memory critically high: {rss_mb:.1f} MB",
            "data": data,
        }
    if rss_mb >= DEGRADED_MB:
        return {
            "name": "memory",
            "status": "Degraded",
            "description": f"Memory elevated: {rss_mb:.1f} MB",
            "data": data,
        }
    return {
        "name": "memory",
        "status": "Healthy",
        "description": f"Memory OK: {rss_mb:.1f} MB",
        "data": data,
    }


async def _database_check() -> dict:
    start = time.perf_counter()
    try:
        assert pool is not None
        async with pool.connection() as conn:
            cur = await conn.execute("SELECT 1 AS ok, version() AS version")
            row = await cur.fetchone()
        elapsed_ms = round((time.perf_counter() - start) * 1000)

        pool_stats = pool.get_stats()
        data = {
            "server": "postgres:5432",
            "database": "orders_db",
            "query": "SELECT 1",
            "response_time_ms": elapsed_ms,
            "pg_version": " ".join(row[1].split()[:2]) if row else "unknown",
            "pool_size": pool_stats.get("pool_size", 0),
            "pool_available": pool_stats.get("pool_available", 0),
            "requests_waiting": pool_stats.get("requests_waiting", 0),
        }

        if elapsed_ms > 100:
            return {
                "name": "database",
                "status": "Degraded",
                "description": f"PostgreSQL responding slowly ({elapsed_ms} ms)",
                "data": data,
            }
        return {
            "name": "database",
            "status": "Healthy",
            "description": f"PostgreSQL OK ({elapsed_ms} ms)",
            "data": data,
        }
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start) * 1000)
        return {
            "name": "database",
            "status": "Unhealthy",
            "description": f"PostgreSQL connection failed: {exc}",
            "data": {"response_time_ms": elapsed_ms, "error": str(type(exc).__name__)},
        }


async def _disk_space_check() -> dict:
    DEGRADED_MB = 500
    UNHEALTHY_MB = 100
    disk = shutil.disk_usage("/")
    total_mb = disk.total / (1024 * 1024)
    free_mb = disk.free / (1024 * 1024)
    used_pct = ((disk.total - disk.free) / disk.total) * 100

    data = {
        "drive": "/",
        "total_mb": round(total_mb, 1),
        "free_mb": round(free_mb, 1),
        "used_percent": round(used_pct, 1),
    }

    if free_mb <= UNHEALTHY_MB:
        return {
            "name": "disk_space",
            "status": "Unhealthy",
            "description": f"Disk critically low: {free_mb:.0f} MB free",
            "data": data,
        }
    if free_mb <= DEGRADED_MB:
        return {
            "name": "disk_space",
            "status": "Degraded",
            "description": f"Disk space low: {free_mb:.0f} MB free",
            "data": data,
        }
    return {
        "name": "disk_space",
        "status": "Healthy",
        "description": f"Disk OK: {free_mb:.0f} MB free ({used_pct:.1f}% used)",
        "data": data,
    }


async def _http_dependency_check(url: str, name: str) -> dict:
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(url)
        elapsed_ms = round((time.perf_counter() - start) * 1000)
        data = {
            "endpoint": url,
            "status_code": response.status_code,
            "response_time_ms": elapsed_ms,
        }
        if response.is_success:
            return {
                "name": name,
                "status": "Healthy",
                "description": f"{name} is reachable ({elapsed_ms} ms)",
                "data": data,
            }
        return {
            "name": name,
            "status": "Unhealthy",
            "description": f"{name} returned {response.status_code} ({elapsed_ms} ms)",
            "data": data,
        }
    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start) * 1000)
        return {
            "name": name,
            "status": "Unhealthy",
            "description": f"{name} is unreachable: {exc}",
            "data": {"endpoint": url, "response_time_ms": elapsed_ms},
        }


async def _run_checks(checks) -> dict:
    overall_start = time.perf_counter()
    results = [await _timed_check(fn) for fn in checks]
    total_ms = (time.perf_counter() - overall_start) * 1000
    statuses = [r["status"] for r in results]
    overall = "Healthy"
    if "Unhealthy" in statuses:
        overall = "Unhealthy"
    elif "Degraded" in statuses:
        overall = "Degraded"
    return {
        "status": overall,
        "totalDuration": _format_duration(total_ms / 1000),
        "totalDurationMs": round(total_ms, 2),
        "checks": results,
    }


# ════════════════════════════════════════════════════════
# HEALTH ENDPOINTS
# ════════════════════════════════════════════════════════


@app.get("/health")
async def health():
    report = await _run_checks(
        [
            _uptime_check,
            _memory_check,
            _database_check,
            _disk_space_check,
            lambda: _http_dependency_check(
                "http://prometheus-use1-1:9090/-/healthy", "prometheus"
            ),
            lambda: _http_dependency_check(
                "http://otel-collector:13133/", "otel-collector"
            ),
        ]
    )
    return JSONResponse(
        content=report, status_code=503 if report["status"] == "Unhealthy" else 200
    )


@app.get("/health/live")
async def health_live():
    report = await _run_checks([_uptime_check, _memory_check])
    return JSONResponse(
        content=report, status_code=503 if report["status"] == "Unhealthy" else 200
    )


@app.get("/health/ready")
async def health_ready():
    report = await _run_checks(
        [
            _database_check,
            _disk_space_check,
            lambda: _http_dependency_check(
                "http://prometheus-use1-1:9090/-/healthy", "prometheus"
            ),
            lambda: _http_dependency_check(
                "http://otel-collector:13133/", "otel-collector"
            ),
        ]
    )
    return JSONResponse(
        content=report, status_code=503 if report["status"] == "Unhealthy" else 200
    )


# ════════════════════════════════════════════════════════
# TASKS API (backed by PostgreSQL)
# ════════════════════════════════════════════════════════


@app.get("/api/tasks")
async def list_tasks(
    status: str | None = None,
    priority: str | None = None,
    assignee: str | None = None,
):
    # Simulate ~5% error rate
    if random.random() < 0.05:
        raise HTTPException(status_code=500, detail="Random simulated error")

    assert pool is not None
    query = "SELECT id, title, status, priority, assignee, created FROM tasks WHERE 1=1"
    args: list = []
    if status:
        args.append(status)
        query += " AND status = %s"
    if priority:
        args.append(priority)
        query += " AND priority = %s"
    if assignee:
        args.append(assignee)
        query += " AND assignee = %s"
    query += " ORDER BY id"

    async with pool.connection() as conn:
        cur = await conn.execute(query, args or None)
        rows = await cur.fetchall()
        cols = [d.name for d in cur.description] if cur.description else []

    return [dict(zip(cols, r)) for r in rows]


@app.get("/api/tasks/stats/summary")
async def task_stats():
    assert pool is not None
    async with pool.connection() as conn:
        cur = await conn.execute("SELECT count(*) FROM tasks")
        total = (await cur.fetchone())[0]
        cur = await conn.execute(
            "SELECT status, count(*) AS cnt FROM tasks GROUP BY status"
        )
        by_status = {r[0]: r[1] for r in await cur.fetchall()}
        cur = await conn.execute(
            "SELECT priority, count(*) AS cnt FROM tasks GROUP BY priority"
        )
        by_priority = {r[0]: r[1] for r in await cur.fetchall()}
        cur = await conn.execute(
            "SELECT assignee, count(*) AS cnt FROM tasks GROUP BY assignee"
        )
        by_assignee = {r[0]: r[1] for r in await cur.fetchall()}

    return {
        "total": total,
        "by_status": by_status,
        "by_priority": by_priority,
        "by_assignee": by_assignee,
    }


@app.get("/api/tasks/{task_id}")
async def get_task(task_id: int):
    if random.random() < 0.05:
        raise HTTPException(status_code=500, detail="Random simulated error")

    assert pool is not None
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, title, status, priority, assignee, created FROM tasks WHERE id = %s",
            (task_id,),
        )
        row = await cur.fetchone()
        cols = [d.name for d in cur.description] if cur.description else []

    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return dict(zip(cols, row))


@app.post("/api/tasks", status_code=201)
async def create_task(
    title: str = Query(...),
    priority: str = Query("medium"),
    assignee: str = Query("unassigned"),
):
    assert pool is not None
    async with pool.connection() as conn:
        cur = await conn.execute(
            "INSERT INTO tasks (title, priority, assignee) VALUES (%s, %s, %s) RETURNING id, title, status, priority, assignee, created",
            (title, priority, assignee),
        )
        row = await cur.fetchone()
        cols = [d.name for d in cur.description] if cur.description else []
    return dict(zip(cols, row))


@app.put("/api/tasks/{task_id}")
async def update_task(
    task_id: int,
    title: str | None = Query(None),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    assignee: str | None = Query(None),
):
    assert pool is not None
    sets = []
    args: list = []
    for col, val in [
        ("title", title),
        ("status", status),
        ("priority", priority),
        ("assignee", assignee),
    ]:
        if val is not None:
            sets.append(f"{col} = %s")
            args.append(val)
    if not sets:
        raise HTTPException(status_code=400, detail="No fields to update")

    args.append(task_id)
    query = f"UPDATE tasks SET {', '.join(sets)} WHERE id = %s RETURNING id, title, status, priority, assignee, created"

    async with pool.connection() as conn:
        cur = await conn.execute(query, args)
        row = await cur.fetchone()
        cols = [d.name for d in cur.description] if cur.description else []

    if not row:
        raise HTTPException(status_code=404, detail="Task not found")
    return dict(zip(cols, row))


@app.delete("/api/tasks/{task_id}", status_code=204)
async def delete_task(task_id: int):
    assert pool is not None
    async with pool.connection() as conn:
        cur = await conn.execute("DELETE FROM tasks WHERE id = %s", (task_id,))
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Task not found")


# ════════════════════════════════════════════════════════
# CROSS-SERVICE ENDPOINT
# ════════════════════════════════════════════════════════


@app.get("/api/tasks/with-orders")
async def tasks_with_orders():
    """
    Cross-service call: fetches tasks from Postgres, then calls dotnet-app for orders.
    Creates a multi-hop trace: client → fastapi-app → postgres + dotnet-app → postgres.
    """
    assert pool is not None
    async with pool.connection() as conn:
        cur = await conn.execute(
            "SELECT id, title, status, priority, assignee, created FROM tasks ORDER BY id"
        )
        rows = await cur.fetchall()
        cols = [d.name for d in cur.description] if cur.description else []
    tasks = [dict(zip(cols, r)) for r in rows]

    # Cross-service call to dotnet-app
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get("http://dotnet-app:8080/api/orders")
        orders = resp.json()

    return {"tasks": tasks, "orders": orders}
