import { Fragment, FormEvent, useState } from "react";
import { Copy, ExternalLink, Eye, History, MapPin, MoreVertical, Phone, Printer, Search } from "lucide-react";
import { api } from "../api/client";
import { PincodeDanceLoader } from "../components/PincodeDanceLoader";
import { StickerNotice } from "../components/StickerNotice";
import { StatusBadge } from "../components/StatusBadge";
import { TruckLoader } from "../components/TruckLoader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import type { NdrTrackingRecord, Order, PincodeService } from "../types";
import { cn } from "../utils/cn";
import { buildStatusMessage } from "../utils/copyStatus";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [orderNotice, setOrderNotice] = useState<"wrong" | "empty" | null>(null);
  const [busy, setBusy] = useState(false);
  const [pincodeQuery, setPincodeQuery] = useState("");
  const [pincodeResults, setPincodeResults] = useState<PincodeService[]>([]);
  const [pincodeMessage, setPincodeMessage] = useState("");
  const [pincodeNotice, setPincodeNotice] = useState<"wrong" | "empty" | null>(null);
  const [pincodeBusy, setPincodeBusy] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [historyByOrder, setHistoryByOrder] = useState<Record<number, NdrTrackingRecord[]>>({});
  const [historyMessage, setHistoryMessage] = useState("");
  const [globalTrackingRows, setGlobalTrackingRows] = useState<NdrTrackingRecord[]>([]);
  const [globalTrackingMessage, setGlobalTrackingMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!isValidShipmentSearch(query)) {
      setOrders([]);
      setGlobalTrackingRows([]);
      setGlobalTrackingMessage("");
      setOrderNotice("wrong");
      setMessage("Order, docket ya mobile number ka length sahi nahi hai.");
      return;
    }
    setBusy(true);
    setMessage("");
    setOrderNotice(null);
    setGlobalTrackingRows([]);
    setGlobalTrackingMessage("");
    try {
      const [orderData, trackingData] = await Promise.all([
        api<{ results: Order[]; duration_ms: number; detected_type: string }>(`/search?q=${encodeURIComponent(query)}`),
        api<{ query: string; results: NdrTrackingRecord[] }>(`/ndr/search?q=${encodeURIComponent(query)}`),
      ]);
      setOrders(orderData.results);
      setGlobalTrackingRows(trackingData.results);
      setGlobalTrackingMessage(trackingData.results.length ? `${trackingData.results.length} NDR tracking record found.` : "");
      setMessage(`${orderData.results.length} order result${orderData.results.length === 1 ? "" : "s"} in ${orderData.duration_ms} ms`);
      setOrderNotice(orderData.results.length || trackingData.results.length ? null : "empty");
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : "Search failed");
      setOrders([]);
      setGlobalTrackingRows([]);
      setGlobalTrackingMessage("");
      setOrderNotice("wrong");
    } finally {
      setBusy(false);
    }
  }

  async function submitPincode(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(pincodeQuery.trim())) {
      setPincodeResults([]);
      setPincodeNotice("wrong");
      setPincodeMessage("6 digit ka valid pincode daalo.");
      return;
    }
    setPincodeBusy(true);
    setPincodeMessage("");
    setPincodeNotice(null);
    try {
      const data = await api<{ pincode: string; results: PincodeService[] }>(`/pincodes/search?q=${encodeURIComponent(pincodeQuery)}`);
      setPincodeResults(data.results);
      setPincodeMessage(data.results.length ? `${data.results.length} courier service found for ${data.pincode}.` : `No service found for ${data.pincode || pincodeQuery}.`);
      setPincodeNotice(data.results.length ? null : "empty");
    } catch (exc) {
      setPincodeResults([]);
      setPincodeMessage(exc instanceof Error ? exc.message : "Pincode search failed");
      setPincodeNotice("wrong");
    } finally {
      setPincodeBusy(false);
    }
  }

  async function toggleTrackingHistory(order: Order) {
    if (expandedHistoryId === order.id) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(order.id);
    setHistoryMessage("");
    if (historyByOrder[order.id]) {
      return;
    }
    try {
      const data = await api<{ order_id: number; results: NdrTrackingRecord[] }>(`/orders/${order.id}/tracking-history`);
      setHistoryByOrder((current) => ({ ...current, [order.id]: data.results }));
      if (!data.results.length) {
        setHistoryMessage("No tracking history found for this order.");
      }
    } catch (exc) {
      setHistoryMessage(exc instanceof Error ? exc.message : "Tracking history failed");
    }
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit} noValidate>
            <label className="sr-only" htmlFor="universal-search">Search by order, docket, phone, alternate phone</label>
            <Input id="universal-search" value={query} onChange={(event) => setQuery(event.target.value)} minLength={2} placeholder="Order, docket, phone" required />
            <Button disabled={busy}><Search size={18} /> {busy ? "Searching" : "Search"}</Button>
          </form>
          {message && <p className="mt-4 text-sm text-slate-500">{message}</p>}
        </Card>
        <Card>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submitPincode} noValidate>
            <label className="sr-only" htmlFor="quick-pincode-search">Check pincode service</label>
            <Input id="quick-pincode-search" value={pincodeQuery} onChange={(event) => setPincodeQuery(event.target.value)} inputMode="numeric" minLength={6} maxLength={6} placeholder="Check pincode" required />
            <Button className="bg-accent" disabled={pincodeBusy}><MapPin size={18} /> {pincodeBusy ? "Checking" : "Check"}</Button>
          </form>
          {pincodeMessage && <p className="mt-4 text-sm text-slate-500">{pincodeMessage}</p>}
        </Card>
      </div>
      {busy && <TruckLoader label="Searching shipment..." brand={inferCourierBrand(query)} />}
      {pincodeBusy && <PincodeDanceLoader label="Checking pincode service..." />}
      {!busy && orderNotice && <StickerNotice variant={orderNotice} message={orderNotice === "empty" ? "No order ya NDR record found." : message} />}
      {!pincodeBusy && pincodeNotice && <StickerNotice variant={pincodeNotice} message={pincodeNotice === "empty" ? "No pincode record found." : pincodeMessage} />}
      {!busy && globalTrackingRows.length > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">NDR Tracking History</h2>
              {globalTrackingMessage && <p className="mt-1 text-sm text-slate-500">{globalTrackingMessage}</p>}
            </div>
          </div>
          <TrackingHistoryTable rows={globalTrackingRows} />
        </Card>
      )}
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
                <Button type="button" onClick={() => toggleTrackingHistory(order)}>
                  <History size={16} /> Tracking History
                </Button>
              </div>
            </div>
            {expandedHistoryId === order.id && (
              <div className="xl:col-span-3">
                {historyMessage && !historyByOrder[order.id]?.length && <p className="text-sm text-slate-500">{historyMessage}</p>}
                {historyByOrder[order.id]?.length > 0 && <TrackingHistoryTable rows={historyByOrder[order.id]} />}
              </div>
            )}
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

function isValidShipmentSearch(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9]/g, "");
  const validLengths = new Set([5, 7, 8, 9, 10, 11, 12]);
  return validLengths.has(normalized.length);
}

function TrackingHistoryTable({ rows }: { rows: NdrTrackingRecord[] }) {
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-border">
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left text-[11px] xl:text-xs">
          <thead className="bg-muted">
            <tr>
              {NDR_SUMMARY_COLUMNS.map((column) => <th key={column.label} className={cn("p-2 font-semibold", column.className)}>{column.label}</th>)}
              <th className="w-12 p-2 text-right font-semibold">Menu</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-t border-border align-top hover:bg-muted/50">
                  {NDR_SUMMARY_COLUMNS.map((column) => (
                    <td key={column.label} className={cn("break-words p-2 leading-relaxed", column.className)}>
                      {formatCellValue(readTrackingValue(row, column))}
                    </td>
                  ))}
                  <td className="relative p-2 text-right">
                    <button className="inline-grid h-8 w-8 place-items-center rounded-md hover:bg-muted" type="button" onClick={() => setActionMenuId(actionMenuId === row.id ? null : row.id)} aria-label="Open row menu">
                      <MoreVertical size={16} />
                    </button>
                    {actionMenuId === row.id && (
                      <div className="absolute right-2 top-10 z-20 w-44 rounded-md border border-border bg-background p-1 text-left shadow-xl">
                        <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold hover:bg-muted" type="button" onClick={() => { setExpandedRowId(expandedRowId === row.id ? null : row.id); setActionMenuId(null); }}>
                          <Eye size={14} /> Get full details
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {expandedRowId === row.id && (
                  <tr className="border-t border-border bg-muted/30">
                    <td colSpan={NDR_SUMMARY_COLUMNS.length + 1} className="p-4">
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(row.raw_data || {}).map(([key, value]) => (
                          <div key={key} className="rounded-md border border-border bg-background p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{key}</p>
                            <p className="mt-1 break-words text-sm">{formatCellValue(value)}</p>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const NDR_SUMMARY_COLUMNS = [
  { label: "Time", primary: "event_time", className: "w-[7%]" },
  { label: "Status", primary: "status", className: "w-[9%]" },
  { label: "Agent", primary: "agent", className: "hidden w-[7%] md:table-cell" },
  { label: "Remark", primary: "remark", className: "w-[13%]" },
  { label: "Warehouse", raw: ["Warehouse"], className: "hidden w-[8%] lg:table-cell" },
  { label: "OrderNo", raw: ["OrderNo", "Order No", "Order"], className: "w-[7%]" },
  { label: "Order Date", raw: ["Order Date", "OrderDate"], className: "hidden w-[7%] xl:table-cell" },
  { label: "Cx Name", raw: ["Cx Name", "Customer Name", "Customer"], className: "w-[10%]" },
  { label: "Mobile No", raw: ["Mobile No", "Mobile", "Phone"], className: "hidden w-[8%] sm:table-cell" },
  { label: "Alt No", raw: ["Alt No", "Alternate No", "Alternate Number"], className: "hidden w-[7%] 2xl:table-cell" },
  { label: "ShippingDate", raw: ["ShippingDate", "Shipping Date"], className: "hidden w-[8%] xl:table-cell" },
  { label: "Shipment", raw: ["Shipment", "Courier"], className: "hidden w-[8%] lg:table-cell" },
  { label: "PincodeZone", raw: ["PincodeZone", "Pincode Zone", "Zone"], className: "hidden w-[7%] 2xl:table-cell" },
  { label: "Docketno", raw: ["Docketno", "Docket No", "Docket", "AWB"], className: "hidden w-[8%] md:table-cell" },
  { label: "OUR EDD", raw: ["OUR EDD", "Our EDD"], className: "hidden w-[7%] 2xl:table-cell" },
  { label: "PDD", raw: ["PDD"], className: "hidden w-[6%] 2xl:table-cell" },
  { label: "OMS STATUS", raw: ["OMS STATUS", "OMS Status"], className: "hidden w-[8%] 2xl:table-cell" },
  { label: "Current status", raw: ["Current status", "Current Status"], className: "hidden w-[8%] xl:table-cell" },
  { label: "Attempts", raw: ["Attempts", "Attempt"], className: "hidden w-[5%] xl:table-cell" },
] as const;

type NdrSummaryColumn = (typeof NDR_SUMMARY_COLUMNS)[number];

function readTrackingValue(row: NdrTrackingRecord, column: NdrSummaryColumn) {
  if ("primary" in column) {
    return row[column.primary as keyof NdrTrackingRecord];
  }
  return findRawValue(row.raw_data || {}, column.raw);
}

function findRawValue(raw: Record<string, string | number | boolean | null>, labels: readonly string[]) {
  for (const label of labels) {
    if (raw[label] !== undefined && raw[label] !== null && raw[label] !== "") {
      return raw[label];
    }
  }
  const normalized = Object.entries(raw).map(([key, value]) => ({ key, value, clean: normalizeHeader(key) }));
  for (const label of labels) {
    const cleanLabel = normalizeHeader(label);
    const exact = normalized.find((item) => item.clean === cleanLabel);
    if (exact?.value !== undefined && exact.value !== null && exact.value !== "") return exact.value;
    const partial = normalized.find((item) => item.clean.includes(cleanLabel) || cleanLabel.includes(item.clean));
    if (partial?.value !== undefined && partial.value !== null && partial.value !== "") return partial.value;
  }
  return null;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatCellValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "N/A";
  return String(value);
}
