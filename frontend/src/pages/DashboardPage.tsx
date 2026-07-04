import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, CheckCircle2, Clock, Database, Package, RefreshCw, Truck } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../context/AuthContext";
import type { Dashboard } from "../types";

function Metric({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Package }) {
  return <Card><div className="flex items-center justify-between"><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></div><Icon className="text-primary" /></div></Card>;
}

function Bars({ data }: { data: Array<{ name: string; value: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="grid gap-3">{data.length === 0 ? <p className="text-sm text-slate-500">No data available.</p> : data.map((item) => <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span>{item.name}</span><span>{item.value}</span></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(item.value / max) * 100}%` }} /></div></div>)}</div>;
}

export function DashboardPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<Dashboard>("/dashboard") });
  const sync = useMutation({
    mutationFn: () => api<{ checked: number; updated: number; errors: string[]; duration_ms: number }>("/tracking/delhivery/sync?limit=500", { method: "POST" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["dashboard"] })
  });
  if (isLoading) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-muted" />)}</div>;
  if (error || !data) return <Card>Dashboard could not be loaded.</Card>;
  return (
    <section className="grid gap-6">
      {user?.role === "admin" && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Delhivery status sync</h2>
            <p className="text-sm text-slate-500">Fetch latest tracking status for Delhivery docket numbers.</p>
            {sync.data && <p className="mt-2 text-sm text-slate-500">Checked {sync.data.checked}, updated {sync.data.updated} in {sync.data.duration_ms} ms.</p>}
            {sync.error && <p className="mt-2 text-sm text-red-600">{sync.error.message}</p>}
          </div>
          <Button disabled={sync.isPending} onClick={() => sync.mutate()}><RefreshCw size={18} /> {sync.isPending ? "Syncing" : "Sync Delhivery"}</Button>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total Orders" value={data.total_orders} icon={Package} />
        <Metric label="Delivered" value={data.delivered} icon={CheckCircle2} />
        <Metric label="Pending" value={data.pending} icon={Clock} />
        <Metric label="In Transit" value={data.in_transit} icon={Truck} />
        <Metric label="OFD" value={data.ofd} icon={Activity} />
        <Metric label="NDR" value={data.ndr} icon={Activity} />
        <Metric label="RTO" value={data.rto} icon={Activity} />
        <Metric label="Delayed" value={data.delayed} icon={Clock} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card><h2 className="mb-4 font-semibold">Courier Wise</h2><Bars data={data.courier_wise} /></Card>
        <Card><h2 className="mb-4 font-semibold">Status Wise</h2><Bars data={data.status_wise} /></Card>
        <Card><h2 className="mb-4 flex items-center gap-2 font-semibold"><Database size={18} /> Database Status</h2><p className="text-sm text-slate-500">{data.database_status}</p><p className="mt-4 text-sm">Latest upload: {data.latest_upload ? `${data.latest_upload.records} records on ${new Date(data.latest_upload.date).toLocaleString()}` : "No upload yet"}</p></Card>
      </div>
    </section>
  );
}
