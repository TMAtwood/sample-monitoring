import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useHoldings } from "@/api/queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function Holdings() {
  const { data: holdings, isLoading } = useHoldings();

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-geode-green-dark">All Holdings</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Portfolio</TableHead>
              <TableHead>Ticker</TableHead>
              <TableHead>Security</TableHead>
              <TableHead className="text-right">Weight %</TableHead>
              <TableHead className="text-right">Shares</TableHead>
              <TableHead className="text-right">Market Value</TableHead>
              <TableHead className="text-right">Cost Basis</TableHead>
              <TableHead className="text-right">Gain/Loss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings?.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-medium">{h.portfolioName}</TableCell>
                <TableCell className="font-bold">{h.ticker}</TableCell>
                <TableCell>{h.securityName}</TableCell>
                <TableCell className="text-right">{h.weight.toFixed(1)}%</TableCell>
                <TableCell className="text-right">{formatNumber(h.shares, 0)}</TableCell>
                <TableCell className="text-right">{formatCurrency(h.marketValue)}</TableCell>
                <TableCell className="text-right">{formatCurrency(h.costBasis)}</TableCell>
                <TableCell className={`text-right font-semibold ${h.gainLoss >= 0 ? "text-geode-green" : "text-red-500"}`}>
                  {h.gainLoss >= 0 ? "+" : ""}${(h.gainLoss / 1000).toFixed(0)}K ({h.gainLossPercent.toFixed(1)}%)
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
