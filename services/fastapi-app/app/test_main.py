"""
Tests for the FastAPI app.

Note: Tests that hit /api/tasks require a running PostgreSQL database.
In CI without Postgres, only the health/live and metrics tests will pass.
Run the full suite with: podman compose up -d postgres && cd services/fastapi-app && pip install -r requirements.txt pytest && DATABASE_URL=postgresql://orders_app:changeme@localhost:5432/orders_db pytest
"""

import os
from unittest.mock import patch

import pytest


# Only import and test when DATABASE_URL is set (Postgres available)
HAS_DB = "DATABASE_URL" in os.environ


@pytest.fixture(scope="module")
def client():
    """Create a test client — requires DATABASE_URL to be set."""
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_health(client):
    response = client.get("/health")
    assert response.status_code in (200, 503)
    body = response.json()
    assert body["status"] in ("Healthy", "Degraded", "Unhealthy")
    assert "checks" in body
    assert "totalDurationMs" in body


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_health_live(client):
    response = client.get("/health/live")
    assert response.status_code in (200, 503)
    body = response.json()
    check_names = [c["name"] for c in body["checks"]]
    assert "uptime" in check_names
    assert "memory" in check_names


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_health_ready(client):
    response = client.get("/health/ready")
    assert response.status_code in (200, 503)
    body = response.json()
    check_names = [c["name"] for c in body["checks"]]
    assert "database" in check_names
    assert "disk_space" in check_names


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_list_tasks(client):
    with patch("app.main.random.random", return_value=0.5):
        response = client.get("/api/tasks")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_list_tasks_filter_by_status(client):
    with patch("app.main.random.random", return_value=0.5):
        response = client.get("/api/tasks?status=done")
        assert response.status_code == 200
        tasks = response.json()
        assert all(t["status"] == "done" for t in tasks)


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_get_task(client):
    with patch("app.main.random.random", return_value=0.5):
        response = client.get("/api/tasks/1")
        assert response.status_code == 200
        assert response.json()["title"] == "Set up monitoring"


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_get_task_not_found(client):
    with patch("app.main.random.random", return_value=0.5):
        response = client.get("/api/tasks/999")
        assert response.status_code == 404


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_task_stats(client):
    response = client.get("/api/tasks/stats/summary")
    assert response.status_code == 200
    body = response.json()
    assert "total" in body
    assert "by_status" in body


@pytest.mark.skipif(not HAS_DB, reason="No DATABASE_URL — Postgres not available")
def test_metrics_endpoint(client):
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "http_request" in response.text
