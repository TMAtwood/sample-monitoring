CREATE TABLE IF NOT EXISTS items (
    id       INT AUTO_INCREMENT PRIMARY KEY,
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
