-- Initialize the database with schemas and seed data for all services.
-- This runs once on first container start (via /docker-entrypoint-initdb.d/).

-- ════════════════════════════════════════════════════════
-- ORDERS (dotnet-app)
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orders (
    id          SERIAL PRIMARY KEY,
    customer    VARCHAR(100) NOT NULL,
    product     VARCHAR(200) NOT NULL,
    quantity    INT NOT NULL DEFAULT 1,
    total_cents INT NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_orders_created_at ON orders (created_at);

INSERT INTO orders (customer, product, quantity, total_cents, status) VALUES
    ('alice',   'Widget A',  2, 4998, 'completed'),
    ('bob',     'Widget B',  1, 2499, 'pending'),
    ('charlie', 'Gadget C',  5, 7495, 'shipped'),
    ('diana',   'Widget A',  1, 2499, 'completed'),
    ('eve',     'Gadget D', 10, 9990, 'pending');

-- ════════════════════════════════════════════════════════
-- ITEMS (spring-boot-app)
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS items (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL
);

INSERT INTO items (name, category) VALUES
    ('Prometheus Server', 'monitoring'),
    ('Grafana Dashboard', 'visualization'),
    ('Thanos Gateway', 'storage'),
    ('Alertmanager', 'alerting'),
    ('Loki Log Aggregator', 'logging'),
    ('Tempo Tracing Backend', 'tracing');

-- ════════════════════════════════════════════════════════
-- TASKS (fastapi-app)
-- ════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tasks (
    id        SERIAL PRIMARY KEY,
    title     VARCHAR(200) NOT NULL,
    status    VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority  VARCHAR(20) NOT NULL DEFAULT 'medium',
    assignee  VARCHAR(100) NOT NULL DEFAULT 'unassigned',
    created   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status ON tasks (status);

INSERT INTO tasks (title, status, priority, assignee) VALUES
    ('Set up monitoring',              'done',        'high',   'alice'),
    ('Write alert rules',              'in_progress', 'high',   'bob'),
    ('Configure dashboards',           'pending',     'medium', 'alice'),
    ('Set up log aggregation',         'in_progress', 'high',   'carol'),
    ('Create runbook documentation',   'pending',     'low',    'bob'),
    ('Configure PagerDuty integration','pending',     'medium', 'carol'),
    ('Implement distributed tracing',  'done',        'high',   'alice'),
    ('Set up blackbox probes',         'done',        'medium', 'bob');

-- ════════════════════════════════════════════════════════
-- MONITORING USER (postgres-exporter)
-- ════════════════════════════════════════════════════════

CREATE USER exporter WITH PASSWORD 'exporter_password';
GRANT CONNECT ON DATABASE orders_db TO exporter;
GRANT pg_monitor TO exporter;
