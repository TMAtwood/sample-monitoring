import { useState } from "react";
import Editor from "@monaco-editor/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PROMETHEUS_RULES = `groups:
  - name: service-alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: >
            {{ $labels.job }} instance {{ $labels.instance }}
            has been unreachable for more than 1 minute.

      - alert: HighErrorRate
        expr: |
          sum by (job) (rate(http_requests_total{code=~"5.."}[5m]))
          / sum by (job) (rate(http_requests_total[5m]))
          > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.job }}"
`;

const GRAFANA_DASHBOARD = JSON.stringify(
  {
    dashboard: {
      title: "Geode Capital — Overview",
      panels: [
        {
          type: "stat",
          title: "Total Services",
          targets: [{ expr: "count(up)" }],
          gridPos: { h: 4, w: 6, x: 0, y: 0 },
        },
        {
          type: "timeseries",
          title: "Request Rate",
          targets: [{ expr: "sum(rate(http_requests_total[5m])) by (job)" }],
          gridPos: { h: 8, w: 12, x: 0, y: 4 },
        },
      ],
    },
  },
  null,
  2
);

export function EditorPage() {
  const [readOnly, setReadOnly] = useState(false);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="prometheus">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="prometheus">Alert Rules (YAML)</TabsTrigger>
            <TabsTrigger value="grafana">Dashboard (JSON)</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-3">
            <Badge variant={readOnly ? "muted" : "success"}>{readOnly ? "Read Only" : "Editable"}</Badge>
            <Button variant="outline" size="sm" onClick={() => setReadOnly(!readOnly)}>
              Toggle Read Only
            </Button>
          </div>
        </div>

        <TabsContent value="prometheus">
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-mono text-muted-foreground">prometheus/rules/service-alerts.yml</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Editor height="600px" defaultLanguage="yaml" defaultValue={PROMETHEUS_RULES} theme="vs-dark" options={{ readOnly, minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grafana">
          <Card>
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-sm font-mono text-muted-foreground">grafana/dashboards/overview.json</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Editor height="600px" defaultLanguage="json" defaultValue={GRAFANA_DASHBOARD} theme="vs-dark" options={{ readOnly, minimap: { enabled: false }, fontSize: 14, padding: { top: 16 } }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
