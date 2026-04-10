import { useGetList } from "react-admin";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Box,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

export const TopPerformers = () => {
  const { data: holdings } = useGetList("holdings", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: securities } = useGetList("securities", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: portfolios } = useGetList("portfolios", {
    pagination: { page: 1, perPage: 100 },
  });

  if (!holdings || !securities || !portfolios) return null;

  const securityMap = new Map(securities.map((s) => [s.id, s]));
  const portfolioMap = new Map(portfolios.map((p) => [p.id, p]));

  const enriched = holdings.map((h) => {
    const gain = h.marketValue - h.costBasis;
    const gainPct = h.costBasis > 0 ? (gain / h.costBasis) * 100 : 0;
    return {
      ...h,
      gain,
      gainPct,
      ticker: securityMap.get(h.securityId)?.ticker ?? "?",
      portfolio: portfolioMap.get(h.portfolioId)?.name ?? "?",
    };
  });

  const sorted = [...enriched].sort((a, b) => b.gain - a.gain);
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  const renderTable = (
    title: string,
    items: typeof top5,
    icon: React.ReactNode
  ) => (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
        {icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#30724F" }}>
          {title}
        </Typography>
      </Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: "#30724F" }}>Ticker</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#30724F" }}>Portfolio</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#30724F" }} align="right">Gain/Loss</TableCell>
              <TableCell sx={{ fontWeight: 700, color: "#30724F" }} align="right">%</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((h) => (
              <TableRow key={h.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{h.ticker}</TableCell>
                <TableCell>{h.portfolio}</TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 600,
                    color: h.gain >= 0 ? "#389865" : "#d32f2f",
                  }}
                >
                  {h.gain >= 0 ? "+" : ""}${(h.gain / 1000).toFixed(0)}K
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 600,
                    color: h.gain >= 0 ? "#389865" : "#d32f2f",
                  }}
                >
                  {h.gainPct >= 0 ? "+" : ""}
                  {h.gainPct.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: "#30724F" }}>
          Top & Bottom Holdings
        </Typography>
        {renderTable(
          "Top 5 Gainers",
          top5,
          <ArrowUpwardIcon sx={{ color: "#389865" }} />
        )}
        {renderTable(
          "Bottom 5",
          bottom5,
          <ArrowDownwardIcon sx={{ color: "#d32f2f" }} />
        )}
      </CardContent>
    </Card>
  );
};
