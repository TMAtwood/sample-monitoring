import { Box, Typography } from "@mui/material";
import { SummaryCards } from "./SummaryCards";
import { PerformanceTable } from "./PerformanceTable";
import { SectorAllocation } from "./SectorAllocation";
import { TopPerformers } from "./TopPerformers";

export const Dashboard = () => (
  <Box sx={{ p: 2 }}>
    <Typography
      variant="h5"
      sx={{ mb: 3, fontWeight: 700, color: "#30724F", fontFamily: "Arial, sans-serif" }}
    >
      Investment Dashboard
    </Typography>

    <SummaryCards />
    <PerformanceTable />

    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        gap: 2,
      }}
    >
      <SectorAllocation />
      <TopPerformers />
    </Box>
  </Box>
);
