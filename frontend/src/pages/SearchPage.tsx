import { FormEvent, useState } from "react";
import { Copy, ExternalLink, MapPin, Phone, Printer, Search } from "lucide-react";
import { api } from "../api/client";
import { StatusBadge } from "../components/StatusBadge";
import { TruckLoader } from "../components/TruckLoader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import type { Order, PincodeService } from "../types";
import { buildStatusMessage } from "../utils/copyStatus";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pincodeQuery, setPincodeQuery] = useState("");
  const [pincodeResults, setPincodeResults] = useState<PincodeService[]>([]);
  const [pincodeMessage, setPincodeMessage] = useState("");
  const [pincodeBusy, setPincodeBusy] = useState(false);

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

  async function submitPincode(event: FormEvent) {
    event.preventDefault();
    setPincodeBusy(true);
    setPincodeMessage("");
    try {
      const data = await api<{ pincode: string; results: PincodeService[] }>(`/pincodes/search?q=${encodeURIComponent(pincodeQuery)}`);
      setPincodeResults(data.results);
      setPincodeMessage(data.results.length ? `${data.results.length} courier service found for ${data.pincode}.` : `No service found for ${data.pincode || pincodeQuery}.`);
    } catch (exc) {
      setPincodeResults([]);
      setPincodeMessage(exc instanceof Error ? exc.message : "Pincode search failed");
    } finally {
      setPincodeBusy(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
            <label className="sr-only" htmlFor="universal-search">Search by order, docket, phone, alternate phone</label>
            <Input id="universal-search" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} placeholder="Order, docket, phone" required />
            <Button disabled={busy}><Search size={18} /> {busy ? "Searching" : "Search"}</Button>
          </form>
          {message && <p className="mt-4 text-sm text-slate-500">{message}</p>}
        </Card>
        <Card>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submitPincode}>
            <label className="sr-only" htmlFor="quick-pincode-search">Check pincode service</label>
            <Input id="quick-pincode-search" value={pincodeQuery} onChange={(event) => setPincodeQuery(event.target.value)} inputMode="numeric" minLength={6} maxLength={6} placeholder="Check pincode" required />
            <Button className="bg-accent" disabled={pincodeBusy}><MapPin size={18} /> {pincodeBusy ? "Checking" : "Check"}</Button>
          </form>
          {pincodeMessage && <p className="mt-4 text-sm text-slate-500">{pincodeMessage}</p>}
        </Card>
      </div>
      {busy && <TruckLoader label="Searching shipment..." brand={inferCourierBrand(query)} />}
      {pincodeBusy && <TruckLoader label="Checking pincode service..." brand="indiashoppe" />}
      {!pincodeBusy && pincodeResults.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3">Courier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">City</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Zone</th>
                  <th className="p-3">Warehouse</th>
                </tr>
              </thead>
              <tbody>
                {pincodeResults.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{item.courier}</td>
                    <td className="p-3"><span className={item.active ? "rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700" : "rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700"}>{item.active ? "Active" : "Inactive"}</span></td>
                    <td className="p-3">{item.city ?? "N/A"}</td>
                    <td className="p-3">{item.state ?? "N/A"}</td>
                    <td className="p-3">{item.zone ?? "N/A"}</td>
                    <td className="p-3">{item.warehouse ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <div className={busy ? "hidden" : "grid gap-4"}>
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
                  <Button className="bg-emerald-600" type="button" onClick={() => window.open(buildDelhiveryTrackingUrl(), "_blank", "noopener,noreferrer")}>
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
    </section>
  );
}

function isDelhivery(order: Order) {
  return order.shipment.toLowerCase().includes("delhivery") && Boolean(order.docket_number);
}

function buildDelhiveryTrackingUrl() {
  return "https://one.delhivery.com/orders/forward/all";
}

function inferCourierBrand(value: string): "delhivery" | "indiashoppe" | "generic" {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("9")) {
    return "delhivery";
  }
  return "indiashoppe";
}
