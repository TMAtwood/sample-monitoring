import { AppBar as RaAppBar, type AppBarProps } from "react-admin";
import { Box } from "@mui/material";

export const AppBar = (props: AppBarProps) => (
  <RaAppBar {...props} sx={{ backgroundColor: "#1e293b" }}>
    <Box sx={{ display: "flex", alignItems: "center", flex: 1 }}>
      <img
        src="/geode-logo-white.png"
        alt="Geode Capital Management"
        style={{ height: 32 }}
      />
    </Box>
  </RaAppBar>
);
