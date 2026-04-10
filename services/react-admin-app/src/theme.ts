import { defaultTheme } from "react-admin";

export const theme = {
  ...defaultTheme,
  palette: {
    primary: {
      main: "#389865",
      dark: "#30724F",
      light: "#6AC897",
      contrastText: "#fff",
    },
    secondary: {
      main: "#C5944A",
      light: "#D4AF6E",
      dark: "#A67A35",
      contrastText: "#fff",
    },
    background: {
      default: "#FBFBFA",
    },
    text: {
      secondary: "#939393",
    },
  },
  typography: {
    fontFamily: "Arial, sans-serif",
  },
  components: {
    ...defaultTheme.components,
    MuiAppBar: {
      styleOverrides: {
        colorSecondary: {
          backgroundColor: "#1e293b",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          "&:hover": {
            backgroundColor: "#30724F",
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            fontWeight: 700,
            color: "#30724F",
          },
        },
      },
    },
  },
};
