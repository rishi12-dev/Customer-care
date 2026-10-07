import { FormEvent, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  MapPin,
  Power,
  RotateCcw,
  Search,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  UploadCloud,
  XCircle,
  Zap,
} from "lucide-react";
import { api, downloadFile } from "../api/client";
import { PincodeDanceLoader } from "../components/PincodeDanceLoader";
import { StickerNotice } from "../components/StickerNotice";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useAuth } from "../context/AuthContext";
import type {
  PincodeBulkSearchResponse,
  PincodeBulkSearchResultItem,
  PincodeSearchResponse,
  PincodeService,
} from "../types";

interface UploadResult {
  records: number;
  duration_ms: number;
  errors: string[];
  warnings: string[];
  backup_id: number;
}

export function PincodePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");

  // Single Search State
  const [query, setQuery] = useState("");
  const [singleResult, setSingleResult] = useState<{
    query: string;
    pincode: string;
    wasDivided: boolean;
    services: PincodeService[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<"wrong" | "empty" | null>(null);
  const [busy, setBusy] = useState(false);

  // Bulk Search State
  const [bulkInput, setBulkInput] = useState("");
  const [bulkData, setBulkData] = useState<PincodeBulkSearchResponse | null>(null);
  const [bulkFilter, setBulkFilter] = useState<"all" | "active" | "inactive" | "missing">("all");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  // Action status / feedback
  const [actionBusyId, setActionBusyId] = useState<number | string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Export State
  const [exportBusy, setExportBusy] = useState(false);

  // Admin Upload State
  const [showUploader, setShowUploader] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  // Helper to preview live what will happen to the entered query
  const cleanQueryDigits = query.replace(/\D/g, "");
  const isQueryAutoDivided = cleanQueryDigits.length === 7;
  const livePreviewPincode =
    cleanQueryDigits.length >= 7
      ? cleanQueryDigits.slice(0, 6)
      : cleanQueryDigits.length === 6
      ? cleanQueryDigits
      : "";

  async function handleSingleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    const digits = trimmed.replace(/\D/g, "");

    if (digits.length < 6 || digits.length > 8) {
      setSingleResult(null);
      setNotice("wrong");
      setMessage("Pincode ya 7-digit customer care number daalo (jaise 1100010 ya 110001).");
      return;
    }

    setBusy(true);
    setMessage("");
    setNotice(null);
    setActionNotice(null);

    try {
      const data = await api<PincodeSearchResponse>(
        `/pincodes/search?q=${encodeURIComponent(trimmed)}`
      );
      setSingleResult({
        query: data.query,
        pincode: data.pincode,
        wasDivided: data.was_divided_by_10,
        services: data.results,
      });

      if (data.results.length === 0) {
        setNotice("empty");
        setMessage(
          `Pincode ${data.pincode} database me nahi mila${
            data.was_divided_by_10 ? ` (raw: ${trimmed} se /10 karke dhoonda)` : ""
          }.`
        );
      } else {
        const activeCount = data.results.filter((s) => s.active).length;
        setMessage(
          `${data.results.length} courier service mili (${activeCount} Active, ${
            data.results.length - activeCount
          } Inactive).`
        );
      }
    } catch (exc) {
      setSingleResult(null);
      setMessage(exc instanceof Error ? exc.message : "Pincode search failed");
      setNotice("wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkSubmit(event: FormEvent) {
    event.preventDefault();
    const tokens = bulkInput
      .split(/[\n\r,;\t ]+/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tokens.length === 0) {
      setBulkMessage("Kripya kam se kam ek number paste karein.");
      return;
    }

    setBulkBusy(true);
    setBulkMessage("");
    setActionNotice(null);

    try {
      const data = await api<PincodeBulkSearchResponse>("/pincodes/bulk-search", {
        method: "POST",
        body: JSON.stringify({ queries: tokens }),
      });
      setBulkData(data);
      setBulkMessage(
        `${data.total_queries} numbers check kiye: ${data.matched_queries} database me mile, ${
          data.total_queries - data.matched_queries
        } nahi mile.`
      );
    } catch (exc) {
      setBulkMessage(exc instanceof Error ? exc.message : "Bulk search failed");
    } finally {
      setBulkBusy(false);
    }
  }

  // Toggle active status for an individual courier row
  async function toggleCourierActive(serviceId: number, currentActive: boolean) {
    setActionBusyId(serviceId);
    try {
      const updated = await api<PincodeService>(`/pincodes/${serviceId}/toggle-active`, {
        method: "PATCH",
        body: JSON.stringify({ active: !currentActive }),
      });

      // Update Single Result if active
      if (singleResult) {
        setSingleResult({
          ...singleResult,
          services: singleResult.services.map((s) => (s.id === serviceId ? updated : s)),
        });
      }

      // Update Bulk Results if active
      if (bulkData) {
        setBulkData({
          ...bulkData,
          items: bulkData.items.map((item) => ({
            ...item,
            results: item.results.map((s) => (s.id === serviceId ? updated : s)),
          })),
        });
      }

      setActionNotice(
        `✓ Courier ${updated.courier} for pincode ${updated.pincode} marked ${
          updated.active ? "ACTIVE" : "INACTIVE"
        }!`
      );
    } catch (exc) {
      setActionNotice(exc instanceof Error ? exc.message : "Status update failed");
    } finally {
      setActionBusyId(null);
    }
  }

  // Bulk toggle active status for ALL couriers of a pincode
  async function toggleAllCouriers(pincode: string, targetActive: boolean) {
    setActionBusyId(`all-${pincode}`);
    try {
      const updatedList = await api<PincodeService[]>("/pincodes/bulk-toggle", {
        method: "POST",
        body: JSON.stringify({ pincode, active: targetActive }),
      });

      const updatedMap = new Map(updatedList.map((item) => [item.id, item]));

      if (singleResult && singleResult.pincode === pincode) {
        setSingleResult({
          ...singleResult,
          services: singleResult.services.map((s) => updatedMap.get(s.id) || s),
        });
      }

      if (bulkData) {
        setBulkData({
          ...bulkData,
          items: bulkData.items.map((item) =>
            item.resolved_pincode === pincode
              ? {
                  ...item,
                  results: item.results.map((s) => updatedMap.get(s.id) || s),
                }
              : item
          ),
        });
      }

      setActionNotice(
        `✓ Pincode ${pincode}: All ${updatedList.length} couriers marked ${
          targetActive ? "ACTIVE" : "INACTIVE"
        }!`
      );
    } catch (exc) {
      setActionNotice(exc instanceof Error ? exc.message : "Bulk status update failed");
    } finally {
      setActionBusyId(null);
    }
  }

  // Export updated pincodes to Excel
  async function handleExport() {
    setExportBusy(true);
    try {
      await downloadFile("/pincodes/export", "PincodeServices_Updated.xlsx");
      setActionNotice("✓ Pincode database exported successfully!");
    } catch (exc) {
      setActionNotice(exc instanceof Error ? exc.message : "Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  // Upload handlers for Admin
  async function upload(path: "/pincodes/preview" | "/pincodes/import") {
    if (!files?.length) return;
    const body = new FormData();
    Array.from(files).forEach((file) => body.append("files", file));
    setUploadBusy(true);
    setUploadMessage("");
    try {
      const data = await api<any>(path, { method: "POST", body });
      if (path.includes("preview")) {
        setPreview(data);
        setUploadMessage(
          data.valid
            ? `Preview valid: ${data.records} rows across ${files.length} files.`
            : "Preview failed. Pincode database was not changed."
        );
      } else {
        const result = data as UploadResult;
        setPreview(null);
        setUploadMessage(`Pincode database updated: ${result.records} rows merged in ${result.duration_ms} ms.`);
      }
    } catch (exc) {
      setUploadMessage(exc instanceof Error ? exc.message : "Pincode upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  // Filtered items for bulk view
  const filteredBulkItems = (bulkData?.items || []).filter((item) => {
    if (bulkFilter === "all") return true;
    if (bulkFilter === "missing") return item.results.length === 0;
    if (bulkFilter === "active") return item.results.some((r) => r.active);
    if (bulkFilter === "inactive") return item.results.length > 0 && item.results.every((r) => !r.active);
    return true;
  });

  return (
    <section className="grid gap-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/40 p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Pincode Number Finder & Activation
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Customer care raw numbers auto-resolve with <strong>/10</strong> • Check couriers • One-click Activate / Inactive
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-primary/30 hover:bg-primary/5"
            disabled={exportBusy}
            onClick={handleExport}
            title="Download current pincode database as Excel"
          >
            <Download size={16} className={exportBusy ? "animate-bounce" : ""} />
            {exportBusy ? "Exporting Excel..." : "Export Excel (.xlsx)"}
          </Button>

          {user?.role === "admin" && (
            <Button
              type="button"
              variant="outline"
              className={showUploader ? "bg-muted font-medium" : ""}
              onClick={() => setShowUploader(!showUploader)}
            >
              <UploadCloud size={16} />
              {showUploader ? "Hide Upload" : "Upload Excel"}
            </Button>
          )}
        </div>
      </div>

      {/* Action Notification Toast/Banner */}
      {actionNotice && (
        <div
          className={`flex items-center justify-between rounded-lg border p-3 text-sm font-medium ${
            actionNotice.startsWith("✓")
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionNotice.startsWith("✓") ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <span>{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("single")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "single"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search size={16} />
          Single Number Finder
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("bulk")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors ${
            activeTab === "bulk"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers size={16} />
          Bulk Numbers Finder (Paste List)
        </button>
      </div>

      {/* ================= SINGLE FINDER TAB ================= */}
      {activeTab === "single" && (
        <div className="grid gap-6">
          <Card className="relative overflow-hidden">
            <form onSubmit={handleSingleSubmit} className="grid gap-4" noValidate>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Input
                    id="pincode-search-input"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      if (notice) setNotice(null);
                      if (message) setMessage("");
                    }}
                    inputMode="numeric"
                    placeholder="Enter customer care number (e.g. 1100010 or 110001)"
                    className="pr-28 text-base"
                    required
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setSingleResult(null);
                        setMessage("");
                        setNotice(null);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <Button disabled={busy} type="submit" className="min-w-[130px]">
                  <Search size={18} />
                  {busy ? "Searching..." : "Find Pincode"}
                </Button>
              </div>

              {/* Dynamic Helper / Real-time Resolution Pill */}
              {query && cleanQueryDigits.length >= 6 && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {isQueryAutoDivided ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-semibold text-amber-700 dark:text-amber-400">
                      <Zap size={14} className="animate-pulse" />
                      Auto /10 Detected: Input <strong>{query}</strong> will find 6-digit Pincode{" "}
                      <strong className="underline underline-offset-2">{livePreviewPincode}</strong>
                    </span>
                  ) : cleanQueryDigits.length === 6 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-medium text-blue-700 dark:text-blue-400">
                      <CheckCircle2 size={14} />
                      Standard 6-digit Pincode: <strong>{cleanQueryDigits}</strong>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Searching first 6 digits: <strong>{livePreviewPincode}</strong>
                    </span>
                  )}
                </div>
              )}
            </form>

            {message && !busy && (
              <p className="mt-3 text-sm text-muted-foreground">{message}</p>
            )}
          </Card>

          {busy && <PincodeDanceLoader label="Searching pincode services..." />}

          {!busy && notice && (
            <StickerNotice
              variant={notice}
              message={notice === "empty" ? "No pincode record found in database." : message}
            />
          )}

          {/* Single Result Table */}
          {!busy && singleResult && singleResult.services.length > 0 && (
            <Card className="overflow-hidden p-0 shadow-md">
              {/* Result Meta Banner */}
              <div className="flex flex-col justify-between gap-4 border-b border-border bg-muted/40 p-4 sm:flex-row sm:items-center">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-lg bg-primary px-3 py-1.5 text-lg font-bold text-primary-foreground shadow-sm">
                    PIN: {singleResult.pincode}
                  </div>

                  {singleResult.wasDivided && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                      <Zap size={13} />
                      /10 Auto Applied (Received: {singleResult.query})
                    </span>
                  )}

                  <div className="text-xs text-muted-foreground">
                    <span>
                      {singleResult.services[0]?.city ?? "Unknown City"},{" "}
                      {singleResult.services[0]?.state ?? "Unknown State"}
                    </span>
                    {singleResult.services[0]?.zone && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-medium">
                        Zone: {singleResult.services[0].zone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bulk Actions for this Pincode */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                    disabled={actionBusyId === `all-${singleResult.pincode}`}
                    onClick={() => toggleAllCouriers(singleResult.pincode, true)}
                    title="Activate all couriers for this pincode"
                  >
                    <CheckCircle2 size={15} />
                    Activate All Couriers
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/40 text-red-700 hover:bg-red-500/10 dark:text-red-400"
                    disabled={actionBusyId === `all-${singleResult.pincode}`}
                    onClick={() => toggleAllCouriers(singleResult.pincode, false)}
                    title="Deactivate all couriers for this pincode"
                  >
                    <Power size={15} />
                    Deactivate All
                  </Button>
                </div>
              </div>

              {/* Courier Table */}
              <div className="overflow-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="p-3.5">Courier Partner</th>
                      <th className="p-3.5">Warehouse</th>
                      <th className="p-3.5">Service Status</th>
                      <th className="p-3.5">City / State</th>
                      <th className="p-3.5 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {singleResult.services.map((item) => {
                      const isUpdating = actionBusyId === item.id;
                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="p-3.5 font-semibold text-foreground">
                            {item.courier}
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {item.warehouse || "Default Warehouse"}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                                item.active
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  item.active ? "bg-emerald-500" : "bg-red-500"
                                }`}
                              />
                              {item.active ? "ACTIVE" : "INACTIVE"}
                            </span>
                          </td>
                          <td className="p-3.5 text-xs text-muted-foreground">
                            {item.city}, {item.state}
                          </td>
                          <td className="p-3.5 text-right">
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              variant={item.active ? "outline" : "default"}
                              className={
                                item.active
                                  ? "border-red-500/30 text-red-600 hover:bg-red-500/10 dark:text-red-400"
                                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                              }
                              onClick={() => toggleCourierActive(item.id, item.active)}
                            >
                              {isUpdating ? (
                                "Updating..."
                              ) : item.active ? (
                                <>
                                  <ToggleRight size={16} /> Mark Inactive
                                </>
                              ) : (
                                <>
                                  <ToggleLeft size={16} /> Activate Now
                                </>
                              )}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ================= BULK FINDER TAB ================= */}
      {activeTab === "bulk" && (
        <div className="grid gap-6">
          <Card>
            <form onSubmit={handleBulkSubmit} className="grid gap-4">
              <div>
                <label
                  htmlFor="bulk-pincode-input"
                  className="mb-1 block text-sm font-semibold text-foreground"
                >
                  Paste Multiple Numbers / Pincodes
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Paste raw 7-digit numbers (e.g. 1100010, 3610020) or 6-digit pincodes. Separated by commas, spaces, or newlines.
                </p>
                <textarea
                  id="bulk-pincode-input"
                  rows={4}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="Example:&#10;1100010&#10;3610020&#10;396375&#10;7424040, 742402"
                  className="w-full rounded-md border border-border bg-background p-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkInput("3610020\n396375\n7424040\n742402\n999999");
                    }}
                  >
                    <Sparkles size={14} /> Paste Sample
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkInput("");
                      setBulkData(null);
                      setBulkMessage("");
                    }}
                  >
                    <RotateCcw size={14} /> Clear
                  </Button>
                </div>

                <Button type="submit" disabled={bulkBusy} className="min-w-[140px]">
                  <Layers size={18} />
                  {bulkBusy ? "Processing..." : "Find All Pincodes"}
                </Button>
              </div>

              {bulkMessage && (
                <p className="text-sm font-medium text-muted-foreground">{bulkMessage}</p>
              )}
            </form>
          </Card>

          {bulkBusy && <PincodeDanceLoader label="Searching multiple pincodes..." />}

          {/* Bulk Results Summary & Filter */}
          {!bulkBusy && bulkData && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                  <span className="rounded bg-primary/10 px-2 py-0.5 text-primary font-bold">
                    Total: {bulkData.total_queries}
                  </span>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-400 font-bold">
                    Found: {bulkData.matched_queries}
                  </span>
                  <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-700 dark:text-red-400 font-bold">
                    Missing: {bulkData.total_queries - bulkData.matched_queries}
                  </span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 text-xs">
                  <Filter size={14} className="text-muted-foreground mr-1" />
                  {(["all", "active", "inactive", "missing"] as const).map((filterKey) => (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setBulkFilter(filterKey)}
                      className={`rounded px-2.5 py-1 font-semibold capitalize transition-colors ${
                        bulkFilter === filterKey
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {filterKey}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items List */}
              <div className="grid gap-3">
                {filteredBulkItems.map((item, idx) => {
                  const hasService = item.results.length > 0;
                  const activeCouriers = item.results.filter((r) => r.active);
                  const isAllActive = hasService && activeCouriers.length === item.results.length;

                  return (
                    <Card key={`${item.query}-${idx}`} className="p-4 transition-all hover:border-primary/40">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            Input: {item.query}
                          </span>

                          <span className="text-sm font-bold text-foreground">
                            → PIN: {item.resolved_pincode || "Invalid"}
                          </span>

                          {item.was_divided_by_10 && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              <Zap size={11} /> /10 Auto
                            </span>
                          )}

                          {hasService ? (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                activeCouriers.length > 0
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300"
                              }`}
                            >
                              {activeCouriers.length}/{item.results.length} Active Couriers
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              No Service Found
                            </span>
                          )}
                        </div>

                        {hasService && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className={
                                isAllActive
                                  ? "border-red-500/30 text-red-600 hover:bg-red-500/10 text-xs"
                                  : "border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 text-xs"
                              }
                              disabled={actionBusyId === `all-${item.resolved_pincode}`}
                              onClick={() => toggleAllCouriers(item.resolved_pincode, !isAllActive)}
                            >
                              {isAllActive ? "Deactivate All" : "Activate All"}
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Couriers Grid for this Pincode */}
                      {hasService && (
                        <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-border">
                          {item.results.map((c) => (
                            <div
                              key={c.id}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                                c.active
                                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-300"
                                  : "border-border bg-muted/40 text-muted-foreground"
                              }`}
                            >
                              <span className="font-semibold">{c.courier}</span>
                              <span className="text-[11px] opacity-75">
                                ({c.warehouse || "Warehouse"})
                              </span>
                              <button
                                type="button"
                                disabled={actionBusyId === c.id}
                                onClick={() => toggleCourierActive(c.id, c.active)}
                                className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                                  c.active
                                    ? "bg-emerald-600 text-white hover:bg-red-600"
                                    : "bg-muted-foreground/20 hover:bg-emerald-600 hover:text-white"
                                }`}
                                title={c.active ? "Click to Deactivate" : "Click to Activate"}
                              >
                                {actionBusyId === c.id ? "..." : c.active ? "Active" : "Activate"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}

                {filteredBulkItems.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">
                    Is filter ke sath koi record nahi mila.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= ADMIN EXCEL MERGE / UPLOAD SECTION ================= */}
      {user?.role === "admin" && showUploader && (
        <Card className="border-dashed border-primary/40 bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold">
              <FileSpreadsheet size={18} className="text-primary" />
              <span>Admin: Pincode Excel Data Import & Merge</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Required headers: sNo, date, pincode, state, city, zone, active, warehouse, courier
            </span>
          </div>

          <label className="grid gap-3">
            <input
              className="rounded-md border border-border bg-background p-3 text-sm"
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={(event) => {
                setFiles(event.target.files);
                setPreview(null);
                setUploadMessage("");
              }}
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={!files?.length || uploadBusy}
              onClick={() => upload("/pincodes/preview")}
            >
              <UploadCloud size={18} /> Validate Files
            </Button>
            <Button
              className="bg-accent"
              disabled={!files?.length || uploadBusy || !preview?.valid}
              onClick={() => upload("/pincodes/import")}
            >
              Merge Into DB
            </Button>
          </div>

          {uploadMessage && (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{uploadMessage}</p>
          )}

          {preview && (
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h2 className="mb-2 font-semibold text-sm">Validation Preview Result</h2>
              <p className={`text-xs ${preview.valid ? "text-emerald-600" : "text-red-600"}`}>
                {preview.valid
                  ? "Files are valid. Click Merge Into DB to update pincode database."
                  : "Validation failed. Database was not changed."}
              </p>
              <div className="mt-2 grid gap-1 text-xs">
                {preview.errors.map((error: string) => (
                  <p key={error} className="text-red-600">
                    {error}
                  </p>
                ))}
                {preview.warnings.map((warning: string) => (
                  <p key={warning} className="text-amber-600">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
