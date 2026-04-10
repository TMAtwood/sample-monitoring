import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecurities } from "@/api/queries";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function Securities() {
  const { data: securities, isLoading } = useSecurities();
  const [search, setSearch] = useState("");
  const [sectorFilter, setSectorFilter] = useState("");

  const filtered = securities?.filter((s) => {
    const matchesSearch = !search || s.ticker.toLowerCase().includes(search.toLowerCase()) || s.name.toLowerCase().includes(search.toLowerCase());
    const matchesSector = !sectorFilter || s.sector === sectorFilter;
    return matchesSearch && matchesSector;
  });

  const sectors = [...new Set(securities?.map((s) => s.sector) ?? [])].sort();

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <CardTitle className="text-geode-green-dark">Security Master</CardTitle>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-64" />
            </div>
            <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">All Sectors</option>
              {sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Sector</TableHead>
              <TableHead>Exchange</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Mkt Cap ($B)</TableHead>
              <TableHead className="text-right">P/E</TableHead>
              <TableHead className="text-right">Div Yield</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered?.map((s) => (
              <TableRow key={s.id} className="cursor-pointer">
                <TableCell>
                  <Link to="/securities/$id" params={{ id: String(s.id) }} className="font-bold text-geode-green hover:underline">
                    {s.ticker}
                  </Link>
                </TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell><Badge variant="muted">{s.sector}</Badge></TableCell>
                <TableCell><Badge variant="outline">{s.exchange}</Badge></TableCell>
                <TableCell className="text-right">{formatCurrency(s.price, 2)}</TableCell>
                <TableCell className="text-right">{formatNumber(s.marketCap, 1)}</TableCell>
                <TableCell className="text-right">{s.peRatio > 0 ? formatNumber(s.peRatio, 1) : "N/A"}</TableCell>
                <TableCell className="text-right">{s.dividendYield > 0 ? `${s.dividendYield.toFixed(2)}%` : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
