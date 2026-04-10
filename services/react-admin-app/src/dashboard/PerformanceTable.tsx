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
} from "@mui/material";

export const PerformanceTable = () => {
  const { data: portfolios } = useGetList("portfolios", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "ytdReturn", order: "DESC" },
  });

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700, color: "#30724F" }}>
          Portfolio Performance
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: "#30724F" }}>Portfolio</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#30724F" }}>Strategy</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#30724F" }} align="right">AUM ($M)</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#30724F" }}>Benchmark</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#30724F" }}>Manager</TableCell>
                <TableCell sx={{ fontWeight: 700, color: "#30724F" }} align="right">YTD Return</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {portfolios?.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
                  <TableCell>{p.strategy}</TableCell>
                  <TableCell align="right">{p.aum.toLocaleString()}</TableCell>
                  <TableCell>{p.benchmark}</TableCell>
                  <TableCell>{p.manager}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      color: p.ytdReturn >= 0 ? "#389865" : "#d32f2f",
                    }}
                  >
                    {p.ytdReturn >= 0 ? "+" : ""}
                    {p.ytdReturn.toFixed(1)}%
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
