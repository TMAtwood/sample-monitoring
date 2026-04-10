import { useGetList } from "react-admin";
import {
  Box,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

const SECTOR_COLORS: Record<string, string> = {
  Technology: "#389865",
  Healthcare: "#30724F",
  Financials: "#C5944A",
  "Consumer Discretionary": "#6AC897",
  "Consumer Staples": "#A67A35",
  Energy: "#D4AF6E",
  Industrials: "#939393",
  Communications: "#5BA37E",
  Utilities: "#7DB89A",
  "Real Estate": "#B8B8B8",
};

export const SectorAllocation = () => {
  const { data: holdings } = useGetList("holdings", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: securities } = useGetList("securities", {
    pagination: { page: 1, perPage: 100 },
  });

  if (!holdings || !securities) return null;

  const securityMap = new Map(securities.map((s) => [s.id, s]));

  const sectorTotals = new Map<string, number>();
  let grandTotal = 0;
  for (const h of holdings) {
    const sec = securityMap.get(h.securityId);
    if (!sec) continue;
    const current = sectorTotals.get(sec.sector) ?? 0;
    sectorTotals.set(sec.sector, current + h.marketValue);
    grandTotal += h.marketValue;
  }

  const sectors = [...sectorTotals.entries()]
    .map(([sector, value]) => ({
      sector,
      value,
      pct: grandTotal > 0 ? (value / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: "#30724F" }}>
          Sector Allocation
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "#30724F" }}>Sector</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#30724F" }} align="right">Value ($M)</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#30724F", width: "40%" }}>Allocation</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sectors.map((s) => (
                <TableRow key={s.sector} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{s.sector}</TableCell>
                  <TableCell align="right">
                    {(s.value / 1_000_000).toFixed(1)}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          height: 14,
                          borderRadius: 1,
                          width: `${Math.max(s.pct, 2)}%`,
                          backgroundColor: SECTOR_COLORS[s.sector] ?? "#939393",
                          transition: "width 0.3s",
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 42 }}>
                        {s.pct.toFixed(1)}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};
