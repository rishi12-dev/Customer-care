import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, Phone, RefreshCw } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";
import type { NdrCall, NdrCallsResponse } from "../types";

const girishDispositions = [
  "DELIVERED",
  "RTO INFORMED AND REFUNDED",
  "NO RESPONSE BOTH CX AND DR.",
  "NO RESPONSE,MAILED WAITING FOR 24 HOURS",
  "NO RESPONSE MAILED AND 24 HRS OVER, ASKED FOR RTO.",
  "ARRANGE DELIVERY ON OR BEFORE EDD AND ALSO WITHOUT FAKE REMARK.",
  "FAKE REMARK UPDATED, ARRANGE DELIVERY SOON.",
  "NO REPONSE FROM CX HUB ADDRESS MAILED TO CX.",
  "MAXIMUM ATTEMPT REACHED FOR SELF COLLECTION EVEN AFTER INFORMING TO CUSTOMER, MAILED AND REFUNDED.",
  "OTHER",
];
const generalDispositions = [
  "RNR",
  "SWITCH OFF",
  "SHIPMENT DELIVERED",
  "SHIPMENT NOT DELIVERED",
  "DELIVERED",
  "NOT DELIVERED",
  "OUT OF NETWORK",
  "CX DISCONNECTED CALL",
  "PHONE BUSY",
  "NOT SURE IF DELIVERED OR NOT",
  "NO RESPONSE",
  "DISCONNECTED THE CALL",
  "NOT REACHABLE",
  "WILL CONFIRM LATER IF DELIVERED OR NOT",
  "REARRANGE DELIVERY",
  "SELF PICKUP",
  "OTHER",
];
type PerformanceRow = { agent: string; assigned: number; completed: number; pending: number };

function copy(value: string | null) {
  if (value) navigator.clipboard?.writeText(value);
}

function CallCard({ call, onSaved }: { call: NdrCall; onSaved: () => void }) {
  const dispositions = call.agent?.trim().toLowerCase() === "girish" ? girishDispositions : generalDispositions;
  const [disposition, setDisposition] = useState(call.feedback?.disposition || "");
  const [remarks, setRemarks] = useState(call.feedback?.remarks || "");
  const [callbackDate, setCallbackDate] = useState(call.feedback?.callback_date || "");
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!disposition || (disposition === "OTHER" && !remarks.trim())) return;
    setSaving(true);
    try {
      await api(`/ndr/calls/${call.id}/feedback`, { method: "POST", body: JSON.stringify({ disposition, remarks, callback_date: callbackDate || null }) });
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  return <Card className="border-l-4 border-l-primary">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-lg font-bold">{call.customer_name}</p><p className="mt-1 text-xs text-slate-500">Order {call.order_no || "—"} · Docket {call.docket_number || "—"} · {call.shipment}</p></div>
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">{call.courier_remark || call.oms_status || "Awaiting call"}</span>
    </div>
    <div className="mt-4 flex flex-wrap gap-2 text-xs"><Button className="bg-slate-100 text-slate-800" onClick={() => copy(call.phone)}><Phone size={14} /> {call.phone || "No phone"}</Button><Button className="bg-slate-100 text-slate-800" onClick={() => copy(call.alternate)}><Clipboard size={14} /> Copy alternate</Button><Button className="bg-slate-100 text-slate-800" onClick={() => copy(call.dx_mail)}><Clipboard size={14} /> Copy DX mail</Button></div>
    <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_170px_auto]"><select value={disposition} onChange={(event) => setDisposition(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm"><option value="">Select disposition</option>{dispositions.map((item) => <option key={item}>{item}</option>)}</select><input required={disposition === "OTHER"} value={remarks} onChange={(event) => setRemarks(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm" placeholder={disposition === "OTHER" ? "Required: enter other decision" : "Conversation remarks"} /><input type="date" value={callbackDate} onChange={(event) => setCallbackDate(event.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm" /><Button disabled={!disposition || (disposition === "OTHER" && !remarks.trim()) || saving} onClick={save}>{call.feedback ? <CheckCircle2 size={16} /> : null}{saving ? "Saving..." : call.feedback ? "Update call" : "Save call"}</Button></div>
  </Card>;
}

export function CallingPage() {
  const { user } = useAuth();
  const [data, setData] = useState<NdrCallsResponse | null>(null);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [error, setError] = useState("");
  async function load() { try { setError(""); const calls = await api<NdrCallsResponse>("/ndr/calls"); setData(calls); if (user?.role === "admin") { const summary = await api<{ agents: PerformanceRow[] }>("/ndr/calls/performance"); setPerformance(summary.agents); } } catch (exc) { setError(exc instanceof Error ? exc.message : "Unable to load calls"); } }
  useEffect(() => { load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer); }, []);
  const remaining = useMemo(() => (data?.total || 0) - (data?.completed || 0), [data]);
  return <section className="grid gap-6"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Manual NDR calling</p><h1 className="mt-1 text-3xl font-black">{user?.role === "admin" ? "Live team calling" : "My allocated calls"}</h1><p className="mt-1 text-sm text-slate-500">Only the current-date manual NDR upload is shown.</p></div><Button onClick={load}><RefreshCw size={16} /> Refresh</Button></div><div className="grid gap-4 sm:grid-cols-3"><Card><p className="text-xs text-slate-500">Allocated</p><p className="mt-1 text-3xl font-black">{data?.total ?? "—"}</p></Card><Card><p className="text-xs text-slate-500">Completed</p><p className="mt-1 text-3xl font-black text-emerald-600">{data?.completed ?? "—"}</p></Card><Card><p className="text-xs text-slate-500">Pending</p><p className="mt-1 text-3xl font-black text-amber-600">{data ? remaining : "—"}</p></Card></div>{user?.role === "admin" && <Card><h2 className="mb-3 font-bold">Agent performance</h2><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-border"><th className="p-2">Agent</th><th className="p-2">Allocated</th><th className="p-2">Completed</th><th className="p-2">Pending</th></tr></thead><tbody>{performance.map((row) => <tr key={row.agent} className="border-b border-border"><td className="p-2 font-semibold">{row.agent}</td><td className="p-2">{row.assigned}</td><td className="p-2 text-emerald-600">{row.completed}</td><td className="p-2 text-amber-600">{row.pending}</td></tr>)}</tbody></table></div></Card>}{error && <Card className="border-red-200 bg-red-50 text-red-700">{error}</Card>}<div className="grid gap-4">{data?.calls.map((call) => <CallCard key={call.id} call={call} onSaved={load} />)}{data && !data.calls.length && <Card className="text-center text-slate-500">No current-date calls assigned.</Card>}</div></section>;
}
