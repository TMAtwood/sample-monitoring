import { useParams, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecurity } from "@/api/queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function SecurityDetail() {
  const { id } = useParams({ strict: false });
  const { data, isLoading } = useSecurity(id!);

  if (isLoading || !data) return <Skeleton className="h-96" />;

  const stats = [
    { label: "Price", value: formatCurrency(data.price, 2) },
    { label: "Market Cap", value: `$${formatNumber(data.marketCap, 1)}B` },
    { label: "P/E Ratio", value: data.peRatio > 0 ? formatNumber(data.peRatio, 1) : "N/A" },
    { label: "Dividend Yield", value: data.dividendYield > 0 ? `${data.dividendYield.toFixed(2)}%` : "—" },
  ];

  return (
    <div className="space-y-6">
      <Link to="/securities" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Securities
      </Link>

      <div className="flex items-center gap-4">
        <h2 className="text-3xl font-bold text-geode-green-dark">{data.ticker}</h2>
        <span className="text-lg text-muted-foreground">{data.name}</span>
        <Badge variant="success">{data.sector}</Badge>
        <Badge variant="outline">{data.exchange}</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-geode-green-dark">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="holdings">
        <TabsList>
          <TabsTrigger value="holdings">Portfolio Holdings</TabsTrigger>
        </TabsList>
        <TabsContent value="holdings">
          <Card>
            <CardHeader><CardTitle>Portfolios Holding {data.ticker}</CardTitle></CardHeader>
            <CardContent>
              {data.holdings?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Portfolio</TableHead>
                      <TableHead className="text-right">Weight %</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Market Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.holdings.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium">{h.portfolioName}</TableCell>
                        <TableCell className="text-right">{h.weight.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{formatNumber(h.shares, 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(h.marketValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No portfolio holdings found.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
