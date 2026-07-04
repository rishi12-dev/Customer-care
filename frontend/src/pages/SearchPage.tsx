import { FormEvent, useState } from "react";
import { Copy, ExternalLink, Phone, Printer, Search, X } from "lucide-react";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import type { Order } from "../types";
import { buildStatusMessage } from "../utils/copyStatus";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);

  const trackingUrl = trackingOrder ? buildDelhiveryTrackingUrl(trackingOrder.docket_number) : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ results: Order[]; duration_ms: number; detected_type: string }>(`/search?q=${encodeURIComponent(query)}`);
      setOrders(data.results);
      setMessage(`${data.results.length} result${data.results.length === 1 ? "" : "s"} in ${data.duration_ms} ms`);
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : "Search failed");
      setOrders([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6">
      <form className="flex gap-3" onSubmit={submit}>
        <label className="sr-only" htmlFor="universal-search">Search by order, docket, phone, alternate phone</label>
        <Input id="universal-search" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} required />
        <Button disabled={busy}><Search size={18} /> {busy ? "Searching" : "Search"}</Button>
      </form>
      {message && <p className="text-sm text-slate-500">{message}</p>}
      <div className="grid gap-4">
        {orders.map((order) => (
          <Card key={order.id} className="grid select-none gap-4 xl:grid-cols-3">
            <div>
              <h2 className="font-semibold">Customer</h2>
              <p className="mt-2 text-lg">{order.customer_name}</p>
              <p className="text-sm text-slate-500">{order.customer_phone_number}</p>
              <p className="text-sm text-slate-500">{order.alt_no ?? "No alternate number"}</p>
            </div>
            <div>
              <h2 className="font-semibold">Shipment</h2>
              <p className="mt-2">{order.order_no}</p>
              <p className="text-sm text-slate-500">{order.shipment} - {order.docket_number}</p>
              <div className="mt-3"><StatusBadge status={order.current_status} /></div>
              <p className="mt-2 text-sm">Expected: {order.expected_delivery ?? "N/A"} - Delivered: {order.delivery_date ?? "N/A"}</p>
            </div>
            <div>
              <h2 className="font-semibold">Tracking</h2>
              <p className="mt-2 min-h-12 text-sm text-slate-600 dark:text-slate-300">{order.remark ?? "No remark recorded"}</p>
              <div className="mt-4 flex flex-wrap gap-2 no-print">
                {isDelhivery(order) && (
                  <Button className="bg-emerald-600" type="button" onClick={() => setTrackingOrder(order)}>
                    <ExternalLink size={16} /> Track
                  </Button>
                )}
                <Button className="bg-accent" type="button" onClick={() => navigator.clipboard.writeText(order.customer_phone_number)}>
                  <Phone size={16} /> Copy Phone
                </Button>
                <Button type="button" onClick={() => navigator.clipboard.writeText(buildStatusMessage(order))}>
                  <Copy size={16} /> Copy Status
                </Button>
                <Button className="bg-slate-900 dark:bg-white dark:text-slate-950" type="button" onClick={() => window.print()}>
                  <Printer size={16} /> Print
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      {trackingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 no-print" role="dialog" aria-modal="true" aria-label="Delhivery tracking">
          <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Delhivery tracking</p>
                <p className="truncate text-xs text-slate-500">{trackingOrder.docket_number}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" className="h-9 bg-slate-900 px-3 dark:bg-white dark:text-slate-950" onClick={() => window.open(trackingUrl, "_blank", "noopener,noreferrer")}>
                  <ExternalLink size={16} /> Open
                </Button>
                <Button type="button" className="h-9 w-9 bg-transparent px-0 text-slate-700 shadow-none hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => setTrackingOrder(null)} aria-label="Close tracking">
                  <X size={18} />
                </Button>
              </div>
            </div>
            <iframe className="h-full w-full bg-white" title={`Delhivery tracking ${trackingOrder.docket_number}`} src={trackingUrl} />
          </div>
        </div>
      )}
    </section>
  );
}

function isDelhivery(order: Order) {
  return order.shipment.toLowerCase().includes("delhivery") && Boolean(order.docket_number);
}

function buildDelhiveryTrackingUrl(docketNumber: string) {
  void docketNumber;
  return "https://one.delhivery.com/orders/forward/all";
}
