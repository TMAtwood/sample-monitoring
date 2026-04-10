import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolio } from "@/api/queries";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/utils";

export function PortfolioDetail() {
  const { id } = useParams({ strict: false });
  const { data, isLoading } = usePortfolio(id!);

  if (isLoading || !data) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <Link to="/portfolios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Portfolios
      </Link>

      <div className="flex items-center gap-4">
        <h2 className="text-3xl font-bold text-geode-green-dark">{data.name}</h2>
        <Badge variant="success">{data.strategy}</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "AUM", value: `$${formatNumber(data.aum, 0)}M` },
          { label: "YTD Return", value: formatPercent(data.ytdReturn), color: data.ytdReturn >= 0 },
          { label: "Benchmark", value: data.benchmark },
          { label: "Manager", value: data.manager },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className={`text-xl font-bold ${color === true ? "text-geode-green" : color === false ? "text-red-500" : "text-geode-green-dark"}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Holdings</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticker</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Weight %</TableHead>
                <TableHead className="text-right">Shares</TableHead>
                <TableHead className="text-right">Market Value</TableHead>
                <TableHead className="text-right">Cost Basis</TableHead>
                <TableHead className="text-right">Gain/Loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.holdings?.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-bold">{h.ticker}</TableCell>
                  <TableCell>{h.securityName}</TableCell>
                  <TableCell className="text-right">{h.weight.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{formatNumber(h.shares, 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(h.marketValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(h.costBasis)}</TableCell>
                  <TableCell className={`text-right font-semibold ${h.gainLoss >= 0 ? "text-geode-green" : "text-red-500"}`}>
                    {formatCurrency(h.gainLoss)} ({h.gainLossPercent.toFixed(1)}%)
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
