import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    setTimeout(() => {
      if (login(email, password)) {
        navigate({ to: "/" });
      } else {
        setError("Invalid email or password");
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: "linear-gradient(160deg, #1e293b 0%, #0f172a 50%, #020617 100%)" }}>
      <div className="mb-8 text-center">
        <img src="/geode-logo-white.png" alt="Geode Capital" className="h-24 mx-auto mb-2" />
        <p className="text-white/50 text-sm tracking-widest uppercase">Investment Dashboard</p>
      </div>

      <Card className="w-[400px] shadow-2xl">
        <CardContent className="p-8">
          <h2 className="text-xl font-bold text-center text-geode-green-dark mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">Demo: thomas.atwood@geodecapital.com / demo12345</p>
        </CardContent>
      </Card>

      <p className="text-white/30 text-xs mt-6">&copy; {new Date().getFullYear()} Geode Capital Management</p>
    </div>
  );
}
