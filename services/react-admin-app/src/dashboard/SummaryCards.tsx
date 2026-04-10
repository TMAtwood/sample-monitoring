import { useGetList } from "react-admin";
import { Box, Card, CardContent, Typography } from "@mui/material";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import PieChartIcon from "@mui/icons-material/PieChart";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

interface CardData {
  title: string;
  value: string;
  icon: React.ReactNode;
}

export const SummaryCards = () => {
  const { data: portfolios } = useGetList("portfolios", {
    pagination: { page: 1, perPage: 100 },
  });
  const { data: securities } = useGetList("securities", {
    pagination: { page: 1, perPage: 100 },
  });

  const totalAum = portfolios?.reduce((sum, p) => sum + p.aum, 0) ?? 0;
  const avgReturn =
    portfolios && portfolios.length > 0
      ? portfolios.reduce((sum, p) => sum + p.ytdReturn, 0) / portfolios.length
      : 0;

  const cards: CardData[] = [
    {
      title: "Total AUM",
      value: `$${(totalAum / 1000).toFixed(1)}B`,
      icon: <AccountBalanceIcon sx={{ fontSize: 40, color: "#C5944A" }} />,
    },
    {
      title: "Portfolios",
      value: `${portfolios?.length ?? 0}`,
      icon: <PieChartIcon sx={{ fontSize: 40, color: "#C5944A" }} />,
    },
    {
      title: "Securities",
      value: `${securities?.length ?? 0}`,
      icon: <ShowChartIcon sx={{ fontSize: 40, color: "#C5944A" }} />,
    },
    {
      title: "Avg YTD Return",
      value: `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(1)}%`,
      icon: <TrendingUpIcon sx={{ fontSize: 40, color: "#C5944A" }} />,
    },
  ];

  return (
    <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
      {cards.map((card) => (
        <Card key={card.title} sx={{ flex: "1 1 200px", minWidth: 200 }}>
          <CardContent
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              py: 2.5,
              "&:last-child": { pb: 2.5 },
            }}
          >
            {card.icon}
            <Box>
              <Typography variant="body2" sx={{ color: "#939393", fontWeight: 500 }}>
                {card.title}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#30724F" }}>
                {card.value}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};
