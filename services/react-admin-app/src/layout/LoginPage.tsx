import { useState } from "react";
import { useLogin, useNotify } from "react-admin";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
} from "@mui/material";

export const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useLogin();
  const notify = useNotify();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    login({ username: email, password }).catch((err: Error) => {
      setLoading(false);
      notify(err.message || "Invalid email or password", { type: "error" });
    });
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(160deg, #1e293b 0%, #0f172a 50%, #020617 100%)",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <Box sx={{ mb: 4, textAlign: "center" }}>
        <img
          src="/geode-logo-white.png"
          alt="Geode Capital"
          style={{ height: 100, marginBottom: 8 }}
        />
        <Typography
          variant="subtitle1"
          sx={{ color: "rgba(255,255,255,0.7)", letterSpacing: 2, fontFamily: "Arial, sans-serif" }}
        >
          PORTFOLIO MANAGER
        </Typography>
      </Box>

      <Card
        sx={{
          width: 400,
          borderRadius: 3,
          boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
          overflow: "visible",
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography
            variant="h6"
            sx={{
              mb: 3,
              textAlign: "center",
              color: "#30724F",
              fontWeight: 700,
              fontFamily: "Arial, sans-serif",
            }}
          >
            Sign In
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              required
              autoFocus
              sx={{ mb: 2.5 }}
              slotProps={{
                inputLabel: { sx: { fontFamily: "Arial, sans-serif" } },
                input: { sx: { fontFamily: "Arial, sans-serif" } },
              }}
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              required
              sx={{ mb: 3 }}
              slotProps={{
                inputLabel: { sx: { fontFamily: "Arial, sans-serif" } },
                input: { sx: { fontFamily: "Arial, sans-serif" } },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                py: 1.3,
                fontSize: "1rem",
                fontWeight: 600,
                fontFamily: "Arial, sans-serif",
                backgroundColor: "#389865",
                "&:hover": { backgroundColor: "#30724F" },
                borderRadius: 2,
                textTransform: "none",
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: "#fff" }} />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <Typography
            variant="body2"
            sx={{
              mt: 2.5,
              textAlign: "center",
              color: "#939393",
              fontFamily: "Arial, sans-serif",
              fontSize: "0.8rem",
            }}
          >
            Demo: thomas.atwood@geodecapital.com / demo12345
          </Typography>
        </CardContent>
      </Card>

      <Typography
        variant="caption"
        sx={{
          mt: 4,
          color: "rgba(255,255,255,0.4)",
          fontFamily: "Arial, sans-serif",
        }}
      >
        &copy; {new Date().getFullYear()} Geode Capital Management
      </Typography>
    </Box>
  );
};
