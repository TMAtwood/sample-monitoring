# Grafana Dashboard Fix + Polish Design

**Date**: 2026-02-26
**Status**: Approved

## Problem

8 Grafana dashboard JSON files exist on disk with correct provisioning wiring, but none load because:

1. All files use the API wrapper format `{"dashboard": {...}}` instead of bare dashboard objects
2. `overview.json` references non-existent metric name `http_server_requests_seconds_count`
3. `azure-func.json` uses wrong label filter on `push_time_seconds`

## Approach: Progressive Enhancement (Option A)

Fix structural issues, then layer polish onto the existing 8-dashboard set. Keep separate dashboards per service (no consolidation) because metric naming diverges across libraries.

## Changes

### Structural (all 8 files)

- Unwrap `{"dashboard": {...}}` to bare root object
- Add `schemaVersion: 39`
- Add `$datasource` template variable (type: datasource, query: prometheus)
- Add datasource ref to every target
- Set `graphTooltip: 1` (shared crosshair)

### Query Fixes

- `overview.json`: Union Spring Boot + .NET/FastAPI metric names
- `azure-func.json`: Fix push_time_seconds label to `exported_job="azure-func"`

### Visual Polish

- Consistent color palette: green (#73BF69), yellow (#FADE2A), red (#F2495C)
- Collapsible row groupings per dashboard
- Panel description tooltips on every panel
- Legend: table mode with min/max/mean on timeseries, bottom placement
- Threshold background fills on error/latency panels

### Navigation

- Overview links to all 7 other dashboards
- Detail dashboards link back to overview
- `keepTime: true` on all links

### Per-Dashboard Enhancements

- Overview: Add `$interval` variable, per-service health stat row
- Spring Boot: Add error rate panel
- FastAPI: Add process memory panel
- All services: Add CPU usage panel
- Infrastructure: Add MinIO health, TSDB head series
- Blackbox: Add HTTP status code panel
- Alerts: Add pending alerts panel
