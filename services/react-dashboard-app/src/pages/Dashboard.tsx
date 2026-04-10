import { Building2, PieChart, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortfolios, useSecurities, useHoldings } from "@/api/queries";
import { formatNumber, formatPercent } from "@/lib/utils";

export function Dashboard() {
  const { data: portfolios, isLoading: pLoading } = usePortfolios();
  const { data: securities, isLoading: sLoading } = useSecurities();
  const { data: holdings, isLoading: hLoading } = useHoldings();

  const totalAum = portfolios?.reduce((s, p) => s + p.aum, 0) ?? 0;
  const avgReturn = portfolios && portfolios.length > 0 ? portfolios.reduce((s, p) => s + p.ytdReturn, 0) / portfolios.length : 0;

  const sectorMap = new Map<string, number>();
  let grandTotal = 0;
  if (holdings && securities) {
    const secMap = new Map(securities.map((s) => [s.id, s]));
    for (const h of holdings) {
      const sec = secMap.get(h.securityId);
      if (!sec) continue;
      sectorMap.set(sec.sector, (sectorMap.get(sec.sector) ?? 0) + h.marketValue);
      grandTotal += h.marketValue;
    }
  }
  const sectors = [...sectorMap.entries()].map(([name, value]) => ({ name, value, pct: grandTotal > 0 ? (value / grandTotal) * 100 : 0 })).sort((a, b) => b.value - a.value);

  const summaryCards = [
    { title: "Total AUM", value: `$${formatNumber(totalAum / 1000, 1)}B`, icon: Building2 },
    { title: "Portfolios", value: `${portfolios?.length ?? 0}`, icon: PieChart },
    { title: "Securities", value: `${securities?.length ?? 0}`, icon: TrendingUp },
    { title: "Avg YTD Return", value: formatPercent(avgReturn), icon: BarChart3 },
  ];

  if (pLoading || sLoading || hLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(({ title, value, icon: Icon }) => (
          <Card key={title}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-geode-gold/10">
                <Icon className="h-6 w-6 text-geode-gold" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-2xl font-bold text-geode-green-dark">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-geode-green-dark">Portfolio Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Portfolio</TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead className="text-right">AUM ($M)</TableHead>
                <TableHead>Benchmark</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">YTD Return</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolios?.sort((a, b) => b.ytdReturn - a.ytdReturn).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.name}</TableCell>
                  <TableCell><Badge variant="success">{p.strategy}</Badge></TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-geode-green-dark">Sector Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sectors.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <span className="w-48 text-sm font-medium truncate">{s.name}</span>
                <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-geode-green rounded-full transition-all" style={{ width: `${Math.max(s.pct, 1)}%` }} />
                </div>
                <span className="w-16 text-sm font-semibold text-right">{s.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
