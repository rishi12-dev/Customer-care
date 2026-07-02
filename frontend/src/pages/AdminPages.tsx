import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import type { User } from "../types";

export function UsersPage() {
  const client = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/users") });
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "customer_care" });
  const create = useMutation({ mutationFn: () => api<User>("/users", { method: "POST", body: JSON.stringify(form) }), onSuccess: () => client.invalidateQueries({ queryKey: ["users"] }) });
  function submit(event: FormEvent) { event.preventDefault(); create.mutate(); }
  return <section className="grid gap-6"><Card><form className="grid gap-3 md:grid-cols-5" onSubmit={submit}><label className="grid gap-1 text-xs font-semibold">Name<Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></label><label className="grid gap-1 text-xs font-semibold">Email<Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label className="grid gap-1 text-xs font-semibold">Password<Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label><label className="grid gap-1 text-xs font-semibold">Role<select className="h-10 rounded-md border border-border bg-white px-3 dark:bg-muted" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="customer_care">Customer Care</option><option value="admin">Admin</option></select></label><div className="self-end"><Button>Create User</Button></div></form>{create.error && <p className="mt-3 text-sm text-red-600">{create.error.message}</p>}</Card><Card><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{data.map((user) => <tr key={user.id} className="border-t border-border"><td className="p-2">{user.full_name}</td><td>{user.email}</td><td>{user.role}</td><td>{user.is_active ? "Active" : "Disabled"}</td></tr>)}</tbody></table></Card></section>;
}

export function HistoryPage() {
  const { data = [] } = useQuery({ queryKey: ["history"], queryFn: () => api<any[]>("/upload-history") });
  return <Card><h1 className="mb-4 font-semibold">Upload History</h1><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Date</th><th>Time</th><th>Uploaded By</th><th>Records</th><th>Duration</th><th>Status</th></tr></thead><tbody>{data.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-2">{row.date}</td><td>{row.time}</td><td>{row.uploaded_by}</td><td>{row.records}</td><td>{row.duration} ms</td><td>{row.status}</td></tr>)}</tbody></table></Card>;
}

export function BackupPage() {
  const client = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["backup"], queryFn: () => api<any[]>("/backup") });
  const backup = useMutation({ mutationFn: () => api("/backup", { method: "POST" }), onSuccess: () => client.invalidateQueries({ queryKey: ["backup"] }) });
  const restore = useMutation({ mutationFn: (id: number) => api(`/restore/${id}`, { method: "POST" }), onSuccess: () => client.invalidateQueries() });
  return <section className="grid gap-6"><Card><Button onClick={() => backup.mutate()}>Create Manual Backup</Button></Card><Card><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Label</th><th>Records</th><th>Created</th><th></th></tr></thead><tbody>{data.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-2">{row.label}</td><td>{row.records}</td><td>{new Date(row.created_at).toLocaleString()}</td><td><Button className="h-8 bg-accent" onClick={() => restore.mutate(row.id)}>Restore</Button></td></tr>)}</tbody></table></Card></section>;
}

export function SettingsPage() {
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api<any>("/settings") });
  const [company, setCompany] = useState("");
  const [theme, setTheme] = useState("system");
  const save = useMutation({ mutationFn: () => api("/settings", { method: "PUT", body: JSON.stringify({ company_name: company || data?.company_name || "CourierOps", theme }) }) });
  return <Card className="max-w-2xl"><h1 className="mb-4 font-semibold">Settings</h1><div className="grid gap-4"><label className="grid gap-1 text-sm">Company Name<Input value={company || data?.company_name || ""} onChange={(e) => setCompany(e.target.value)} /></label><label className="grid gap-1 text-sm">Theme<select className="h-10 rounded-md border border-border bg-white px-3 dark:bg-muted" value={theme} onChange={(e) => setTheme(e.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><Button onClick={() => save.mutate()}>Save Settings</Button>{save.isSuccess && <p className="text-sm text-emerald-600">Settings saved.</p>}</div></Card>;
}
