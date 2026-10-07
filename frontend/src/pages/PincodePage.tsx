import { FormEvent, useState } from "react";
import {
  Calculator,
  Check,
  CheckCircle2,
  Copy,
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
    s_no?: number | null;
    divided_by_10?: number | null;
    formula?: string | null;
    page_number?: number | null;
    wasDivided: boolean;
    services: PincodeService[];
  } | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<"wrong" | "empty" | null>(null);
  const [busy, setBusy] = useState(false);

  // Quick Standalone Serial Number /10 Calculator
  const [calcInput, setCalcInput] = useState("167");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

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

  // Helper calculation for quick standalone calculator
  const calcDigits = calcInput.replace(/\D/g, "");
  const calcNum = calcDigits ? parseInt(calcDigits, 10) : 0;
  const calcDivided = calcNum ? (calcNum / 10).toFixed(1) : "0.0";
  const calcPage = calcNum ? Math.ceil(calcNum / 10) : 0;

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedValue(label);
    setTimeout(() => setCopiedValue(null), 2500);
  }

  async function handleSingleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    const digits = trimmed.replace(/\D/g, "");

    if (!digits) {
      setSingleResult(null);
      setNotice("wrong");
      setMessage("Pincode ya Serial Number daalo (jaise 600013 ya 167).");
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

      // Extract or compute s_no and divided_by_10
      let s_no = data.s_no;
      let div_10 = data.divided_by_10;
      let formula = data.formula;
      let page_num = data.page_number;

      if (!s_no && data.results.length > 0) {
        const first = data.results[0];
        s_no = first.s_no ?? first.id;
        div_10 = first.divided_by_10 ?? parseFloat((s_no / 10).toFixed(1));
        formula = first.formula ?? `${s_no} ÷ 10 = ${div_10}`;
        page_num = first.page_number ?? Math.ceil(s_no / 10);
      } else if (!s_no && digits && digits.length < 6) {
        s_no = parseInt(digits, 10);
        div_10 = parseFloat((s_no / 10).toFixed(1));
        formula = `${s_no} ÷ 10 = ${div_10}`;
        page_num = Math.ceil(s_no / 10);
      }

      setSingleResult({
        query: data.query,
        pincode: data.pincode,
        s_no,
        divided_by_10: div_10,
        formula,
        page_number: page_num,
        wasDivided: data.was_divided_by_10,
        services: data.results,
      });

      // Also sync standalone calculator with this s_no if found
      if (s_no) {
        setCalcInput(String(s_no));
      }

      if (data.results.length === 0) {
        setNotice("empty");
        setMessage(
          `Pincode ${data.pincode || trimmed} database me nahi mila, par /10 value calculate ho gayi hai.`
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

      if (singleResult) {
        setSingleResult({
          ...singleResult,
          services: singleResult.services.map((s) => (s.id === serviceId ? updated : s)),
        });
      }

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

  const filteredBulkItems = (bulkData?.items || []).filter((item) => {
    if (bulkFilter === "all") return true;
    if (bulkFilter === "missing") return item.results.length === 0;
    if (bulkFilter === "active") return item.results.some((r) => r.active);
    if (bulkFilter === "inactive") return item.results.length > 0 && item.results.every((r) => !r.active);
    return true;
  });

  return (
    <section className="grid gap-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/40 p-5 shadow-sm sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Pincode & Serial Number /10 Finder
              </h1>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Pincode search karein → Serial No (sNo) milega → <strong>sNo ÷ 10</strong> value turant screen par dekhein!
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

      {/* QUICK INSTANT CALCULATOR BOX (Always available at a glance) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="col-span-1 md:col-span-3 border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-card to-card p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                <Calculator size={22} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground sm:text-base">
                  ⚡ Instant Serial Number ÷ 10 Calculator
                </h2>
                <p className="text-xs text-muted-foreground">
                  Agar aapke paas koi bhi Serial Number (sNo) hai, yahan daalein — turant <strong>/10 value</strong> aur <strong>Page number</strong> calculate hoga.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="quick-calc" className="text-xs font-semibold text-muted-foreground">
                  Serial No:
                </label>
                <input
                  id="quick-calc"
                  type="number"
                  value={calcInput}
                  onChange={(e) => setCalcInput(e.target.value)}
                  placeholder="e.g. 167"
                  className="h-10 w-28 rounded-lg border border-border bg-background px-3 text-center text-base font-bold font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2">
                <span className="text-xs text-amber-900 dark:text-amber-200 font-medium">Value (/10):</span>
                <span className="font-mono text-xl font-extrabold text-amber-900 dark:text-amber-100">
                  {calcDivided}
                </span>
                <span className="rounded bg-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-100">
                  Page {calcPage}
                </span>
              </div>

              <Button
                type="button"
                size="sm"
                className="bg-amber-600 text-white hover:bg-amber-700 shadow-sm"
                onClick={() => copyToClipboard(calcDivided, "calc")}
              >
                {copiedValue === "calc" ? <Check size={16} /> : <Copy size={16} />}
                {copiedValue === "calc" ? "Copied!" : `Copy ${calcDivided}`}
              </Button>
            </div>
          </div>
        </Card>
      </div>

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
          Pincode / Serial No Lookup
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
                    placeholder="Enter Pincode (e.g. 600013) or Serial Number (e.g. 167)"
                    className="pr-24 text-base font-mono"
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

                <Button disabled={busy} type="submit" className="min-w-[150px]">
                  <Search size={18} />
                  {busy ? "Searching..." : "Search & Calculate"}
                </Button>
              </div>

              {/* Quick Suggestion buttons */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Quick tests:</span>
                {["600013", "167", "361002", "110001", "742404"].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setQuery(sample);
                    }}
                    className="rounded border border-border bg-muted/60 px-2 py-0.5 font-mono font-medium hover:border-primary hover:text-primary transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </form>

            {message && !busy && (
              <p className="mt-3 text-sm text-muted-foreground">{message}</p>
            )}
          </Card>

          {busy && <PincodeDanceLoader label="Searching and calculating /10..." />}

          {!busy && notice && (
            <StickerNotice
              variant={notice}
              message={notice === "empty" ? "No record found in database." : message}
            />
          )}

          {/* PROMINENT /10 RESULT HERO BANNER */}
          {!busy && singleResult && (singleResult.divided_by_10 !== null || singleResult.services.length > 0) && (
            <div className="grid gap-6">
              {/* Highlight Hero Card with /10 Value */}
              <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-lg">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-lg bg-primary px-3 py-1 font-mono text-xl font-extrabold text-primary-foreground shadow-sm">
                        PIN: {singleResult.pincode || singleResult.query}
                      </span>

                      {singleResult.s_no && (
                        <span className="rounded-lg border border-border bg-muted px-3 py-1 font-mono text-sm font-bold text-foreground">
                          Serial No (sNo): {singleResult.s_no}
                        </span>
                      )}

                      {singleResult.wasDivided && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                          <Zap size={13} />
                          /10 Auto Applied
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {singleResult.services[0] ? (
                        <span>
                          {singleResult.services[0].city ?? "Unknown City"},{" "}
                          {singleResult.services[0].state ?? "Unknown State"} • Warehouse:{" "}
                          <strong>{singleResult.services[0].warehouse || "Default"}</strong>
                        </span>
                      ) : (
                        <span>Serial Number Calculation</span>
                      )}
                    </div>
                  </div>

                  {/* THE EXACT /10 VALUE PROMINENT DISPLAY */}
                  {singleResult.divided_by_10 !== null && (
                    <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 shadow-sm">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                          🎯 Value After /10 ({singleResult.formula || `${singleResult.s_no} ÷ 10`}):
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-3xl font-extrabold text-emerald-700 dark:text-emerald-300">
                            {singleResult.divided_by_10}
                          </span>
                          {singleResult.page_number && (
                            <span className="rounded-md bg-emerald-600/20 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                              Page {singleResult.page_number}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold shadow-md"
                          onClick={() =>
                            copyToClipboard(String(singleResult.divided_by_10), "hero-val")
                          }
                        >
                          {copiedValue === "hero-val" ? <Check size={16} /> : <Copy size={16} />}
                          {copiedValue === "hero-val" ? "Copied!" : `Copy ${singleResult.divided_by_10}`}
                        </Button>

                        {singleResult.s_no && (
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(String(singleResult.s_no), "hero-sno")
                            }
                            className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:underline"
                          >
                            {copiedValue === "hero-sno" ? "Copied sNo!" : `Copy sNo: ${singleResult.s_no}`}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bulk Actions for this Pincode if couriers found */}
                {singleResult.services.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="text-xs font-medium text-muted-foreground">
                      {singleResult.services.length} courier partners linked to this pincode.
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
                        disabled={actionBusyId === `all-${singleResult.pincode}`}
                        onClick={() => toggleAllCouriers(singleResult.pincode, true)}
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
                      >
                        <Power size={15} />
                        Deactivate All
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Courier Table */}
              {singleResult.services.length > 0 && (
                <Card className="overflow-hidden p-0 shadow-md">
                  <div className="overflow-auto">
                    <table className="w-full min-w-[820px] text-left text-sm">
                      <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="p-3.5">Courier Partner</th>
                          <th className="p-3.5">Serial No (sNo)</th>
                          <th className="p-3.5">sNo ÷ 10 Value</th>
                          <th className="p-3.5">Warehouse</th>
                          <th className="p-3.5">Status</th>
                          <th className="p-3.5 text-right">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {singleResult.services.map((item) => {
                          const isUpdating = actionBusyId === item.id;
                          const itemSno = item.s_no ?? item.id;
                          const itemDiv = item.divided_by_10 ?? parseFloat((itemSno / 10).toFixed(1));
                          return (
                            <tr
                              key={item.id}
                              className="transition-colors hover:bg-muted/30"
                            >
                              <td className="p-3.5 font-semibold text-foreground">
                                {item.courier}
                              </td>
                              <td className="p-3.5 font-mono font-bold text-foreground">
                                {itemSno}
                              </td>
                              <td className="p-3.5">
                                <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 font-mono font-extrabold text-emerald-800 dark:text-emerald-300">
                                  <span>{itemDiv}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(String(itemDiv), `row-${item.id}`)
                                    }
                                    className="opacity-70 hover:opacity-100"
                                    title="Copy this /10 value"
                                  >
                                    {copiedValue === `row-${item.id}` ? (
                                      <Check size={13} />
                                    ) : (
                                      <Copy size={13} />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="p-3.5 text-muted-foreground text-xs">
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
                  Paste Multiple Pincodes or Serial Numbers
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Paste pincodes (e.g. 600013, 361002) or serial numbers (e.g. 167, 168). Separated by commas, spaces, or newlines.
                </p>
                <textarea
                  id="bulk-pincode-input"
                  rows={4}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="Example:&#10;600013&#10;167&#10;361002&#10;742404"
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
                      setBulkInput("600013\n167\n361002\n742404");
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
                  {bulkBusy ? "Processing..." : "Calculate All /10"}
                </Button>
              </div>

              {bulkMessage && (
                <p className="text-sm font-medium text-muted-foreground">{bulkMessage}</p>
              )}
            </form>
          </Card>

          {bulkBusy && <PincodeDanceLoader label="Calculating multiple numbers..." />}

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
                  const firstSno = hasService ? (item.results[0].s_no ?? item.results[0].id) : null;
                  const divVal = firstSno ? (firstSno / 10).toFixed(1) : null;

                  return (
                    <Card key={`${item.query}-${idx}`} className="p-4 transition-all hover:border-primary/40">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                            Input: {item.query}
                          </span>

                          <span className="text-sm font-bold text-foreground">
                            → PIN: {item.resolved_pincode || "N/A"}
                          </span>

                          {firstSno && divVal && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-300">
                              <Zap size={13} />
                              sNo {firstSno} ÷ 10 = {divVal} (Page {Math.ceil(firstSno / 10)})
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
                              {activeCouriers.length}/{item.results.length} Active
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

                      {hasService && (
                        <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-border">
                          {item.results.map((c) => {
                            const cSno = c.s_no ?? c.id;
                            const cDiv = c.divided_by_10 ?? parseFloat((cSno / 10).toFixed(1));
                            return (
                              <div
                                key={c.id}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
                                  c.active
                                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-300"
                                    : "border-border bg-muted/40 text-muted-foreground"
                                }`}
                              >
                                <span className="font-semibold">{c.courier}</span>
                                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  (sNo {cSno} → {cDiv})
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
                            );
                          })}
                        </div>
                      )}
                    </Card>
                  );
                })}
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
