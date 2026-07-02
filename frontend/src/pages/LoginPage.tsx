import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/search" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/search");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.16),transparent_32%),linear-gradient(135deg,#f8fafc,#eef2f7)] p-5 dark:bg-none">
      <Card className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-white"><ShieldCheck /></div>
          <div><h1 className="text-2xl font-bold">CourierOps</h1><p className="text-sm text-slate-500">Secure courier tracking portal</p></div>
        </div>
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-medium">Email<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="grid gap-1 text-sm font-medium">Password<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">{error}</div>}
          <Button disabled={busy}>{busy ? "Signing in..." : "Sign in"}</Button>
        </form>
      </Card>
    </main>
  );
}
