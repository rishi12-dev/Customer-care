import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Ban, Building2, Download, FileSpreadsheet, FileText, Gauge, ListChecks, PackageCheck, RotateCcw, Search, ShieldAlert, TrendingUp, Truck } from "lucide-react";
import { API_URL, api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { cn } from "../utils/cn";

type Kpis = {
  total_orders: number;
  delivered: number;
  delivered_percentage: number;
  cancelled: number;
  cancelled_percentage: number;
  refunded: number;
  refunded_percentage: number;
  pre_shipment: number;
  pre_shipment_percentage: number;
  shipped: number;
  shipped_percentage: number;
  pending: number;
  pending_percentage: number;
  edd_expired: number;
  edd_expired_percentage: number;
  edd_remaining: number;
  edd_remaining_percentage: number;
  delivery_percentage: number;
};

type NdrDashboard = {
  valid: boolean;
  message?: string;
  report_date: string;
  filters: { couriers: string[]; zones: string[]; statuses: string[] };
  kpis: Kpis;
  status_overview: Array<{ status: string; count: number; percentage: number }>;
  courier_performance: Array<PerformanceRow & { courier: string }>;
  zone_performance: Array<PerformanceRow & { zone: string }>;
  courier_scorecards: ScorecardRow[];
  warehouse_scorecards: ScorecardRow[];
  command_center: {
    health_score: number;
    health_label: string;
    health_tone: "green" | "amber" | "red";
    priority_actions: PriorityAction[];
    highest_risk_warehouse: ScorecardRow | null;
    highest_risk_courier: ScorecardRow | null;
  };
  pending_ageing: Array<PerformanceRow & { bucket: string }>;
  edd_performance: Array<{ name: string; value: number; percentage: number }>;
  pending_orders: PendingOrder[];
  insights: string[];
  alerts: Array<{ level: "critical" | "attention" | "monitor"; message: string }>;
  search_result: null | {
    order_no: string;
    courier: string;
    zone: string;
    current_status: string;
    our_edd: string | null;
    order_age: number;
    edd_status: string;
  };
};

type PerformanceRow = {
  total: number;
  delivered: number;
  shipped: number;
  not_shipped: number;
  pending: number;
  edd_expired: number;
  edd_remaining: number;
  delivery_percentage: number;
};

type ScorecardRow = PerformanceRow & { health_score: number; courier?: string; warehouse?: string };

type PriorityAction = {
  priority: "Critical" | "High" | "Medium";
  reason: string;
  order_no: string;
  courier: string;
  warehouse: string;
  zone: string;
  current_status: string;
  our_edd: string | null;
  pending_days: number;
};

type PendingOrder = {
  order_no: string;
  courier: string;
  zone: string;
  current_status: string;
  our_edd: string | null;
  edd_status: string;
  pending_days: number;
};

const dateFilters = [
  ["all", "All EDD"],
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["last7", "Last 7 Days"],
  ["last15", "Last 15 Days"],
  ["last30", "Last 30 Days"],
  ["custom", "Custom"],
];

export function NdrDashboardPage() {
  const [filters, setFilters] = useState({ date_filter: "all", start_date: "", end_date: "", courier: "all", zone: "all", status: "all", edd_status: "all", search: "", order_search: "" });
  const [pendingSearch, setPendingSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useMemo(() => buildQuery(filters), [filters]);
  const { data, isLoading, error } = useQuery({ queryKey: ["ndr-dashboard", query], queryFn: () => api<NdrDashboard>(`/ndr/dashboard?${query}`) });

  const pendingRows = useMemo(() => {
    const rows = data?.pending_orders ?? [];
    const needle = pendingSearch.trim().toLowerCase();
    const filtered = needle ? rows.filter((row) => row.order_no.toLowerCase().includes(needle) || row.courier.toLowerCase().includes(needle) || row.zone.toLowerCase().includes(needle)) : rows;
    return filtered;
  }, [data, pendingSearch]);
  const pageSize = 12;
  const totalPages = Math.max(Math.ceil(pendingRows.length / pageSize), 1);
  const visiblePending = pendingRows.slice((page - 1) * pageSize, page * pageSize);

  async function download(path: string, filename: string) {
    const raw = localStorage.getItem("courierops.tokens");
    const token = raw ? JSON.parse(raw).accessToken : "";
    const response = await fetch(`${API_URL}${path}?${query}`, { headers: { Authorization: `Bearer ${token}` }, credentials: "include" });
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) return <Card>NDR Dashboard could not be loaded.</Card>;
  if (!data.valid) return <Card><h1 className="text-xl font-bold">NDR Dashboard</h1><p className="mt-3 text-sm text-red-600">{data.message}</p></Card>;

  return (
    <section className="grid gap-6">
      <Card className="overflow-hidden bg-gradient-to-r from-slate-950 to-slate-800 text-white dark:from-black dark:to-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">Logistics Control Tower</p>
            <h1 className="mt-2 text-3xl font-bold">NDR Management Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-300">Courier Remarks drive shipment movement such as In Transit and Out for Delivery. OMS Current Status is used only when a courier remark is unavailable.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="bg-emerald-600" onClick={() => download("/ndr/export/md-report", "md-logistics-report.xlsx")}><Gauge size={17} /> MD Report</Button>
            <Button className="bg-white text-slate-950" onClick={() => download("/ndr/export/excel", "ndr-management-report.xlsx")}><FileSpreadsheet size={17} /> Download Excel</Button>
            <Button className="bg-sky-500" onClick={() => download("/ndr/export/pdf", "ndr-management-report.pdf")}><FileText size={17} /> Download PDF</Button>
          </div>
        </div>
        <div className="mt-6 text-sm text-slate-300">Report Date: {data.report_date}</div>
      </Card>

      <Card className="command-center overflow-hidden border-slate-300 bg-slate-950 text-white dark:border-slate-700">
        <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
          <HealthScore score={data.command_center.health_score} label={data.command_center.health_label} tone={data.command_center.health_tone} />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <CommandMetric label="Priority actions" value={data.command_center.priority_actions.length} detail="Orders needing an immediate owner" icon={ListChecks} />
            <CommandMetric label="Highest courier risk" value={data.command_center.highest_risk_courier?.courier ?? "N/A"} detail={data.command_center.highest_risk_courier ? `${data.command_center.highest_risk_courier.health_score}/100 health score` : "No active courier data"} icon={Truck} />
            <CommandMetric label="Highest warehouse risk" value={data.command_center.highest_risk_warehouse?.warehouse ?? "N/A"} detail={data.command_center.highest_risk_warehouse ? `${data.command_center.highest_risk_warehouse.edd_expired} EDD expired` : "No active warehouse data"} icon={Building2} />
          </div>
        </div>
      </Card>

      <Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select label="Date" value={filters.date_filter} onChange={(value) => setFilters({ ...filters, date_filter: value })} options={dateFilters} />
          <Select label="Courier" value={filters.courier} onChange={(value) => setFilters({ ...filters, courier: value })} options={[["all", "All Couriers"], ...data.filters.couriers.map((item) => [item, item])]} />
          <Select label="Zone" value={filters.zone} onChange={(value) => setFilters({ ...filters, zone: value })} options={[["all", "All Zones"], ...data.filters.zones.map((item) => [item, item])]} />
          <Select label="Status" value={filters.status} onChange={(value) => setFilters({ ...filters, status: value })} options={[["all", "All Status"], ...data.filters.statuses.map((item) => [item, item])]} />
          <Select label="EDD" value={filters.edd_status} onChange={(value) => setFilters({ ...filters, edd_status: value })} options={[["all", "All EDD"], ["Not Shipped", "Not Shipped"], ["EDD Expired", "EDD Expired"], ["EDD Remaining", "EDD Remaining"], ["Delivered", "Delivered"]]} />
        </div>
        {filters.date_filter === "custom" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Input type="date" value={filters.start_date} onChange={(event) => setFilters({ ...filters, start_date: event.target.value })} />
            <Input type="date" value={filters.end_date} onChange={(event) => setFilters({ ...filters, end_date: event.target.value })} />
          </div>
        )}
      </Card>

      <div className="kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi title="Total Orders" value={data.kpis.total_orders} percentage="Uploaded file rows" icon={Truck} tone="slate" />
        <Kpi title="Delivered" value={data.kpis.delivered} percentage={`${data.kpis.delivered_percentage}%`} icon={PackageCheck} tone="green" />
        <Kpi title="Shipped / In Transit" value={data.kpis.shipped} percentage={`${data.kpis.shipped_percentage}%`} icon={TrendingUp} tone="blue" />
        <Kpi title="Action Required" value={data.kpis.pending} percentage={`${data.kpis.pending_percentage}% active orders`} icon={AlertTriangle} tone="amber" />
        <Kpi title="EDD Expired" value={data.kpis.edd_expired} percentage={`${data.kpis.edd_expired_percentage}% of pending`} icon={ShieldAlert} tone="red" />
        <Kpi title="EDD Remaining" value={data.kpis.edd_remaining} percentage={`${data.kpis.edd_remaining_percentage}% of pending`} icon={PackageCheck} tone="cyan" />
        <Kpi title="Not Shipped" value={data.kpis.pre_shipment} percentage="Pending, packed or in progress" icon={Truck} tone="slate" />
        <Kpi title="Cancelled" value={data.kpis.cancelled} percentage={`${data.kpis.cancelled_percentage}% of total`} icon={Ban} tone="slate" />
        <Kpi title="Refunded" value={data.kpis.refunded} percentage={`${data.kpis.refunded_percentage}% of total`} icon={RotateCcw} tone="slate" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2"><SectionTitle title="Courier Status Overview" /><BarList data={data.status_overview.map((row) => ({ name: row.status, value: row.count, percentage: row.percentage }))} /></Card>
        <Card><SectionTitle title="Delivery Performance" /><Donut kpis={data.kpis} /><MiniBars data={data.edd_performance.map((row) => ({ name: row.name, value: row.value, percentage: row.percentage }))} /></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card><SectionTitle title="Courier Performance" /><PerformanceTable rows={data.courier_performance.slice(0, 8)} label="courier" /></Card>
        <Card><SectionTitle title="Shipped Order - Zone Analysis" /><PerformanceTable rows={data.zone_performance.slice(0, 8)} label="zone" /></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card><SectionTitle title="Courier Scorecard" /><ScorecardTable rows={data.courier_scorecards.slice(0, 8)} label="courier" /></Card>
        <Card><SectionTitle title="Warehouse Risk View" /><ScorecardTable rows={data.warehouse_scorecards.slice(0, 8)} label="warehouse" /></Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div><SectionTitle title="Priority Action Queue" /><p className="-mt-3 text-sm text-slate-500">EDD breaches and pre-shipment orders needing a decision today.</p></div>
          <Button className="bg-emerald-600" onClick={() => download("/ndr/export/md-report", "md-logistics-report.xlsx")}><Download size={16} /> Download MD Report</Button>
        </div>
        <PriorityActionTable rows={data.command_center.priority_actions} />
      </Card>

      <Card>
        <SectionHeader title="Pending Order Analysis" onDownload={() => download("/ndr/export/excel", "ndr-pending-order-analysis.xlsx")} />
        <AgeingTable rows={data.pending_ageing} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionHeader title="Critical Attention Required" onDownload={() => download("/ndr/export/excel", "ndr-critical-attention.xlsx")} />
          <AlertList alerts={data.alerts} />
        </Card>
        <Card><SectionTitle title="Management Insights" /><ul className="grid gap-3 text-sm">{data.insights.map((item) => <li key={item} className="rounded-md border border-border bg-muted/40 p-3">{item}</li>)}</ul></Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <SectionTitle title="Search Order" />
            <div className="mt-2 flex gap-2">
              <Input value={filters.order_search} onChange={(event) => setFilters({ ...filters, order_search: event.target.value })} placeholder="Search OrderNo" />
              <Button><Search size={16} /> Search</Button>
            </div>
          </div>
        </div>
        {data.search_result && (
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
            {Object.entries(data.search_result).map(([key, value]) => <Info key={key} label={titleCase(key)} value={String(value ?? "N/A")} />)}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Action Required Orders" />
          <div className="flex flex-wrap gap-2">
            <Input className="w-64" value={pendingSearch} onChange={(event) => { setPendingSearch(event.target.value); setPage(1); }} placeholder="Search pending table" />
            <Button className="bg-accent" onClick={() => download("/ndr/export/excel", "ndr-pending-report.xlsx")}><Download size={16} /> Export</Button>
          </div>
        </div>
        <PendingTable rows={visiblePending} />
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>{pendingRows.length.toLocaleString()} active rows</span>
          <div className="flex gap-2">
            <Button className="h-8 px-3" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</Button>
            <span className="grid place-items-center px-2">Page {page} / {totalPages}</span>
            <Button className="h-8 px-3" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

function buildQuery(filters: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== "all") params.set(key, value);
  }
  return params.toString();
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <label className="grid gap-1 text-xs font-semibold text-slate-500">{label}<select className="h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none dark:bg-muted" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function HealthScore({ score, label, tone }: { score: number; label: string; tone: "green" | "amber" | "red" }) {
  const colors = { green: "#10b981", amber: "#f59e0b", red: "#ef4444" };
  return <div className="health-score mx-auto grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(${colors[tone]} 0 ${score}%, rgba(255,255,255,.14) ${score}% 100%)` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-slate-950 text-center"><div><p className="text-4xl font-black">{score}</p><p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Health score</p><p className="mt-1 text-xs text-slate-400">{label}</p></div></div></div>;
}

function CommandMetric({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof Truck }) {
  return <div className="command-metric min-w-0 rounded-md border border-white/15 bg-white/5 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 break-words text-lg font-bold">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div><Icon className="shrink-0 text-sky-300" size={20} /></div></div>;
}

function Kpi({ title, value, percentage, icon: Icon, tone }: { title: string; value: number; percentage: string; icon: typeof Truck; tone: "slate" | "green" | "blue" | "amber" | "red" | "cyan" }) {
  const tones = { slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-700", blue: "bg-blue-100 text-blue-700", amber: "bg-amber-100 text-amber-700", red: "bg-red-100 text-red-700", cyan: "bg-cyan-100 text-cyan-700" };
  return <Card className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold">{value.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{percentage}</p></div><div className={cn("grid h-10 w-10 place-items-center rounded-md", tones[tone])}><Icon size={19} /></div></div></Card>;
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-4 text-lg font-bold">{title}</h2>;
}

function SectionHeader({ title, onDownload }: { title: string; onDownload: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-bold">{title}</h2>
      <Button className="h-9 bg-accent px-3 text-xs" onClick={onDownload}><FileSpreadsheet size={15} /> Download Excel</Button>
    </div>
  );
}

function BarList({ data }: { data: Array<{ name: string; value: number; percentage: number }> }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return <div className="grid gap-3">{data.map((item) => <div key={item.name}><div className="mb-1 flex justify-between text-sm"><span className="font-medium">{item.name}</span><span>{item.value.toLocaleString()} ({item.percentage}%)</span></div><div className="h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-primary" style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }} /></div></div>)}</div>;
}

function MiniBars({ data }: { data: Array<{ name: string; value: number; percentage: number }> }) {
  return <div className="mt-4 grid gap-2">{data.map((item) => <div key={item.name} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"><span>{item.name}</span><b>{item.value.toLocaleString()} ({item.percentage}%)</b></div>)}</div>;
}

function Donut({ kpis }: { kpis: Kpis }) {
  const delivered = kpis.delivered_percentage;
  const shipped = kpis.shipped_percentage;
  return <div className="mx-auto grid h-48 w-48 place-items-center rounded-full" style={{ background: `conic-gradient(#10b981 0 ${delivered}%, #3b82f6 ${delivered}% ${delivered + shipped}%, #f59e0b ${delivered + shipped}% 100%)` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-background text-center"><div><p className="text-2xl font-bold">{kpis.delivery_percentage}%</p><p className="text-xs text-slate-500">Delivery Rate</p></div></div></div>;
}

function PerformanceTable({ rows, label }: { rows: Array<PerformanceRow & Record<string, string | number>>; label: "courier" | "zone" }) {
  return <div className="overflow-hidden rounded-md border border-border"><table className="w-full text-left text-xs"><thead className="bg-muted"><tr><th className="p-2">{label === "courier" ? "Courier" : "Zone"}</th><th className="p-2">Total</th><th className="p-2">Delivered</th><th className="p-2">Shipped</th><th className="p-2">Pending</th><th className="p-2">EDD Expired</th><th className="p-2">Delivery %</th></tr></thead><tbody>{rows.map((row) => <tr key={String(row[label])} className="border-t border-border"><td className="p-2 font-semibold">{String(row[label])}</td><td className="p-2">{row.total}</td><td className="p-2">{row.delivered}</td><td className="p-2">{row.shipped}</td><td className="p-2">{row.pending}</td><td className="p-2 text-red-600">{row.edd_expired}</td><td className="p-2">{row.delivery_percentage}%</td></tr>)}</tbody></table></div>;
}

function ScorecardTable({ rows, label }: { rows: ScorecardRow[]; label: "courier" | "warehouse" }) {
  return <div className="overflow-x-auto rounded-md border border-border"><table className="min-w-[620px] w-full text-left text-xs"><thead className="bg-muted"><tr><th className="p-2">{label === "courier" ? "Courier" : "Warehouse"}</th><th className="p-2">Health</th><th className="p-2">Total</th><th className="p-2">Action</th><th className="p-2">EDD Expired</th><th className="p-2">Not Shipped</th><th className="p-2">Delivered</th></tr></thead><tbody>{rows.map((row) => { const name = label === "courier" ? row.courier : row.warehouse; return <tr key={name} className="border-t border-border"><td className="max-w-[160px] break-words p-2 font-semibold">{name ?? "Unknown"}</td><td className="p-2"><span className={cn("rounded-md px-2 py-1 font-bold", row.health_score >= 80 ? "bg-emerald-100 text-emerald-700" : row.health_score >= 55 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>{row.health_score}/100</span></td><td className="p-2">{row.total}</td><td className="p-2">{row.pending}</td><td className="p-2 text-red-600">{row.edd_expired}</td><td className="p-2">{row.not_shipped}</td><td className="p-2">{row.delivery_percentage}%</td></tr>; })}</tbody></table></div>;
}

function PriorityActionTable({ rows }: { rows: PriorityAction[] }) {
  if (!rows.length) return <div className="p-5 text-sm text-slate-500">No immediate action items for the selected filters.</div>;
  const tones = { Critical: "bg-red-100 text-red-700", High: "bg-amber-100 text-amber-700", Medium: "bg-sky-100 text-sky-700" };
  return <div className="overflow-x-auto"><table className="min-w-[820px] w-full text-left text-xs"><thead className="bg-muted"><tr>{["Priority", "Order No", "Reason", "Courier", "Warehouse", "Zone", "Courier Status", "OUR EDD", "Days"].map((header) => <th className="p-3" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={`${row.order_no}-${row.reason}`} className="border-t border-border align-top"><td className="p-3"><span className={cn("rounded-md px-2 py-1 font-bold", tones[row.priority])}>{row.priority}</span></td><td className="p-3 font-semibold">{row.order_no}</td><td className="p-3">{row.reason}</td><td className="p-3">{row.courier}</td><td className="p-3">{row.warehouse}</td><td className="p-3">{row.zone}</td><td className="p-3">{row.current_status}</td><td className="p-3">{row.our_edd ?? "N/A"}</td><td className="p-3">{row.pending_days}</td></tr>)}</tbody></table></div>;
}

function AgeingTable({ rows }: { rows: Array<PerformanceRow & { bucket: string }> }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">{rows.map((row) => <div key={row.bucket} className="rounded-md border border-border bg-muted/30 p-3"><p className="font-bold">{row.bucket}</p><p className="mt-2 text-2xl font-bold">{row.total.toLocaleString()}</p><p className="text-xs text-slate-500">ShippingDate range</p><div className="mt-3 grid gap-1 text-xs"><span>Total: {row.total}</span><span>Delivered: {row.delivered}</span><span>Shipped: {row.shipped}</span><span>Not Shipped: {row.not_shipped}</span><span className="text-red-600">EDD Expired: {row.edd_expired}</span><span>EDD Remaining: {row.edd_remaining}</span></div></div>)}</div>;
}

function AlertList({ alerts }: { alerts: NdrDashboard["alerts"] }) {
  const styles = { critical: "border-red-200 bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-200", attention: "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200", monitor: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-200" };
  return <div className="grid gap-3">{alerts.map((alert) => <div key={alert.message} className={cn("rounded-md border p-3 text-sm font-medium", styles[alert.level])}>{alert.message}</div>)}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-muted/30 p-3"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
}

function PendingTable({ rows }: { rows: PendingOrder[] }) {
  return <div className="mt-4 overflow-hidden rounded-md border border-border"><table className="w-full table-fixed text-left text-xs"><thead className="bg-muted"><tr>{["Order No", "Courier", "Zone", "Current Status", "OUR EDD", "EDD Status", "Pending Days"].map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.order_no} className={cn("border-t border-border", row.edd_status === "EDD Expired" && "bg-red-50/70 dark:bg-red-500/10")}><td className="break-words p-2 font-semibold">{row.order_no}</td><td className="break-words p-2">{row.courier}</td><td className="break-words p-2">{row.zone}</td><td className="break-words p-2">{row.current_status}</td><td className="p-2">{row.our_edd ?? "N/A"}</td><td className="p-2 font-semibold">{row.edd_status}</td><td className="p-2">{row.pending_days}</td></tr>)}</tbody></table></div>;
}

function DashboardSkeleton() {
  return <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 9 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-lg bg-muted" />)}</div>;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
