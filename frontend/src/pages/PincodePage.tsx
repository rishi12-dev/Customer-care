import { FormEvent, useState } from "react";
import { Search, UploadCloud } from "lucide-react";
import { api } from "../api/client";
import { TruckLoader } from "../components/TruckLoader";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { useAuth } from "../context/AuthContext";
import type { PincodeService } from "../types";

interface UploadResult {
  records: number;
  duration_ms: number;
  errors: string[];
  warnings: string[];
  backup_id: number;
}

export function PincodePage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PincodeService[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const data = await api<{ pincode: string; results: PincodeService[] }>(`/pincodes/search?q=${encodeURIComponent(query)}`);
      setResults(data.results);
      setMessage(data.results.length ? `${data.results.length} courier service found for ${data.pincode}.` : `No service found for ${data.pincode || query}.`);
    } catch (exc) {
      setResults([]);
      setMessage(exc instanceof Error ? exc.message : "Pincode search failed");
    } finally {
      setBusy(false);
    }
  }

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
        setUploadMessage(data.valid ? `Preview valid: ${data.records} rows across ${files.length} files.` : "Preview failed. Pincode database was not changed.");
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

  return (
    <section className="grid gap-6">
      <Card>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submit}>
          <label className="sr-only" htmlFor="pincode-search">Search pincode</label>
          <Input id="pincode-search" value={query} onChange={(event) => setQuery(event.target.value)} inputMode="numeric" minLength={6} maxLength={6} placeholder="Enter pincode" required />
          <Button disabled={busy}><Search size={18} /> {busy ? "Searching" : "Search"}</Button>
        </form>
        {message && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </Card>
      {busy && <TruckLoader label="Checking pincode service..." brand="indiashoppe" />}

      {!busy && results.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="overflow-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-3">Courier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">City</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Zone</th>
                  <th className="p-3">Warehouse</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="p-3 font-semibold">{item.courier}</td>
                    <td className="p-3"><span className={item.active ? "rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700" : "rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700"}>{item.active ? "Active" : "Inactive"}</span></td>
                    <td className="p-3">{item.city ?? "N/A"}</td>
                    <td className="p-3">{item.state ?? "N/A"}</td>
                    <td className="p-3">{item.zone ?? "N/A"}</td>
                    <td className="p-3">{item.warehouse ?? "N/A"}</td>
                    <td className="p-3">{item.service_date ?? "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {user?.role === "admin" && (
        <Card>
          <label className="grid gap-3">
            <span className="font-semibold">Pincode Excel Merge</span>
            <input
              className="rounded-md border border-border p-3"
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
            <Button disabled={!files?.length || uploadBusy} onClick={() => upload("/pincodes/preview")}><UploadCloud size={18} /> Validate Files</Button>
            <Button className="bg-accent" disabled={!files?.length || uploadBusy || !preview?.valid} onClick={() => upload("/pincodes/import")}>Merge Into DB</Button>
          </div>
          {uploadMessage && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{uploadMessage}</p>}
        </Card>
      )}

      {preview && (
        <Card>
          <h2 className="mb-3 font-semibold">Validation Result</h2>
          <p className={preview.valid ? "text-emerald-600" : "text-red-600"}>{preview.valid ? "Files are valid. Click Merge Into DB to replace old pincode data." : "Validation failed. Database was not changed."}</p>
          <div className="mt-3 grid gap-2 text-sm">
            {preview.errors.map((error: string) => <p key={error} className="text-red-600">{error}</p>)}
            {preview.warnings.map((warning: string) => <p key={warning} className="text-amber-600">{warning}</p>)}
          </div>
          <div className="mt-4 overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead><tr>{preview.headers.map((header: string) => <th key={header} className="border-b border-border p-2">{header}</th>)}</tr></thead>
              <tbody>{preview.rows.map((row: any, index: number) => <tr key={index}>{preview.headers.map((header: string) => <td key={header} className="border-b border-border p-2">{String(row[header] ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
