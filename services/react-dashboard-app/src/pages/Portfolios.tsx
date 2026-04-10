import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolios } from "@/api/queries";
import { formatNumber, formatPercent } from "@/lib/utils";

const strategyColors: Record<string, "success" | "gold" | "secondary" | "muted"> = {
  "Long Only": "success",
  Growth: "gold",
  "Dividend Income": "secondary",
  Quant: "success",
  "Long/Short": "gold",
  "Sector Rotation": "muted",
  Value: "secondary",
  "Multi-Strategy": "success",
};

export function Portfolios() {
  const { data: portfolios, isLoading } = usePortfolios();

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-geode-green-dark">Portfolios</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead className="text-right">AUM ($M)</TableHead>
              <TableHead>Benchmark</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">YTD Return</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {portfolios?.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell>
                  <Link to="/portfolios/$id" params={{ id: String(p.id) }} className="font-semibold text-geode-green hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell><Badge variant={strategyColors[p.strategy] ?? "muted"}>{p.strategy}</Badge></TableCell>
                <TableCell className="text-right">{formatNumber(p.aum, 0)}</TableCell>
                <TableCell>{p.benchmark}</TableCell>
                <TableCell>{p.manager}</TableCell>
                <TableCell className={`text-right font-bold ${p.ytdReturn >= 0 ? "text-geode-green" : "text-red-500"}`}>
                  {formatPercent(p.ytdReturn)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
