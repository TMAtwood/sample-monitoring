#!/usr/bin/env bash
# Generate traffic against all services to populate metrics, logs, and traces.
# Usage: ./scripts/generate-traffic.sh [duration_seconds]
# Default: runs for 120 seconds (2 minutes)

set -euo pipefail

DURATION=${1:-120}
END_TIME=$((SECONDS + DURATION))
CYCLE=0

echo "Generating traffic for ${DURATION}s across all services..."
echo "Press Ctrl+C to stop early."
echo ""

while [ $SECONDS -lt $END_TIME ]; do
    CYCLE=$((CYCLE + 1))
    REMAINING=$((END_TIME - SECONDS))
    echo "── Cycle $CYCLE (${REMAINING}s remaining) ──"

    # ── Spring Boot (Java) ───────────────────────────────
    curl -sf http://localhost:8081/api/items > /dev/null && echo "  spring-boot  GET /api/items"
    curl -sf http://localhost:8081/api/items/1 > /dev/null && echo "  spring-boot  GET /api/items/1"
    curl -sf http://localhost:8081/api/items/$((RANDOM % 6 + 1)) > /dev/null 2>&1 || true
    curl -sf http://localhost:8081/actuator/health > /dev/null && echo "  spring-boot  GET /actuator/health"

    # ── .NET ─────────────────────────────────────────────
    curl -sf http://localhost:8082/api/orders > /dev/null && echo "  dotnet       GET /api/orders"
    curl -sf http://localhost:8082/api/orders/1 > /dev/null && echo "  dotnet       GET /api/orders/1"
    curl -sf http://localhost:8082/api/orders/$((RANDOM % 5 + 1)) > /dev/null 2>&1 || true
    curl -sf http://localhost:8082/health/live > /dev/null && echo "  dotnet       GET /health/live"
    curl -sf http://localhost:8082/health/ready > /dev/null && echo "  dotnet       GET /health/ready"

    # ── FastAPI (Python) ─────────────────────────────────
    curl -sf http://localhost:8083/api/tasks > /dev/null && echo "  fastapi      GET /api/tasks"
    curl -sf http://localhost:8083/api/tasks/1 > /dev/null && echo "  fastapi      GET /api/tasks/1"
    curl -sf "http://localhost:8083/api/tasks?status=done" > /dev/null && echo "  fastapi      GET /api/tasks?status=done"
    curl -sf "http://localhost:8083/api/tasks?priority=high" > /dev/null && echo "  fastapi      GET /api/tasks?priority=high"
    curl -sf http://localhost:8083/api/tasks/stats/summary > /dev/null && echo "  fastapi      GET /api/tasks/stats/summary"
    curl -sf http://localhost:8083/health/live > /dev/null && echo "  fastapi      GET /health/live"
    curl -sf http://localhost:8083/health/ready > /dev/null && echo "  fastapi      GET /health/ready"

    # ── Azure Function ───────────────────────────────────
    curl -sf http://localhost:8084/api/process > /dev/null && echo "  azure-func   POST /api/process"
    curl -sf http://localhost:8084/api/process > /dev/null 2>&1 || true
    curl -sf http://localhost:8084/api/process > /dev/null 2>&1 || true

    # ── React Admin (Node.js) ────────────────────────────
    curl -sf http://localhost:8085/healthz > /dev/null && echo "  react-admin  GET /healthz"
    curl -sf http://localhost:8085/live > /dev/null && echo "  react-admin  GET /live"
    curl -sf http://localhost:8085/ready > /dev/null && echo "  react-admin  GET /ready"
    curl -sf http://localhost:8085/metrics > /dev/null && echo "  react-admin  GET /metrics"

    # ── React Dashboard (Node.js) ────────────────────────
    curl -sf http://localhost:8086/healthz > /dev/null && echo "  react-dash   GET /healthz"
    curl -sf http://localhost:8086/live > /dev/null && echo "  react-dash   GET /live"
    curl -sf http://localhost:8086/ready > /dev/null && echo "  react-dash   GET /ready"
    curl -sf http://localhost:8086/api/securities > /dev/null && echo "  react-dash   GET /api/securities"
    curl -sf http://localhost:8086/api/portfolios > /dev/null && echo "  react-dash   GET /api/portfolios"
    curl -sf http://localhost:8086/api/holdings > /dev/null && echo "  react-dash   GET /api/holdings"
    curl -sf http://localhost:8086/api/securities/1 > /dev/null && echo "  react-dash   GET /api/securities/1"
    curl -sf http://localhost:8086/api/portfolios/1 > /dev/null && echo "  react-dash   GET /api/portfolios/1"

    # ── Cross-service calls (generate distributed traces) ─
    echo "  ── cross-service traces ──"
    curl -sf http://localhost:8082/api/orders/with-items > /dev/null && echo "  trace        dotnet → spring-boot → postgres"
    curl -sf http://localhost:8081/api/items/with-tasks > /dev/null && echo "  trace        spring-boot → fastapi → postgres"
    curl -sf http://localhost:8083/api/tasks/with-orders > /dev/null && echo "  trace        fastapi → dotnet → postgres"

    # ── Occasional 404s and edge cases (realistic traffic) ─
    curl -sf http://localhost:8082/api/orders/999 > /dev/null 2>&1 || true
    curl -sf http://localhost:8083/api/tasks/999 > /dev/null 2>&1 || true
    curl -sf http://localhost:8081/api/items/999 > /dev/null 2>&1 || true

    echo ""
    sleep 2
done

echo "Done. Generated $CYCLE cycles of traffic across all services."
echo ""
echo "View results:"
echo "  Grafana:     http://localhost:3000  (admin/admin)"
echo "  Traces:      Grafana > Explore > Tempo > Search"
echo "  Metrics:     Grafana > Explore > Thanos > up"
echo "  Logs:        Grafana > Explore > Loki > {container_name=\"fastapi-app\"}"
echo "  Pushgateway: http://localhost:9091  (Azure Function metrics)"
