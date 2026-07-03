import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { api } from "../api/client";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";

interface UploadResult {
  records: number;
  duration_ms: number;
  errors: string[];
  warnings: string[];
  backup_id: number;
  job_id?: string | null;
  status?: "processing" | "completed" | "failed";
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const uploadMessage = (data: UploadResult) => `Upload complete: ${data.records} records replaced working data in ${data.duration_ms} ms.`;

export function UploadPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function waitForUpload(jobId: string) {
    for (let attempt = 1; attempt <= 180; attempt += 1) {
      await wait(2000);
      const data = await api<UploadResult>(`/upload/jobs/${jobId}`);
      if (data.status === "completed") {
        setMessage(uploadMessage(data));
        setPreview(null);
        queryClient.invalidateQueries();
        return;
      }
      if (data.status === "failed") {
        throw new Error(data.errors?.[0] || "Upload failed");
      }
      setMessage(`Upload processing... ${attempt * 2}s elapsed. Please keep this page open.`);
    }
    throw new Error("Upload is still processing. Please check Upload History after a few minutes.");
  }

  async function send(path: string) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    setBusy(true);
    setMessage("");
    try {
      const data = await api<any>(path, { method: "POST", body });
      if (path.includes("preview")) {
        setPreview(data);
        setMessage(data.valid ? `Preview valid: ${data.records} rows checked. Click Replace Working Data to delete old orders and save this file.` : "Preview failed. Working data was not changed.");
      } else {
        if (data.status === "processing" && data.job_id) {
          setMessage("Upload processing... Please keep this page open.");
          await waitForUpload(data.job_id);
        } else {
          setMessage(uploadMessage(data));
          setPreview(null);
          queryClient.invalidateQueries();
        }
      }
    } catch (exc) {
      setMessage(exc instanceof Error ? exc.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-6">
      <Card>
        <label className="grid gap-3">
          <span className="font-semibold">Daily Excel Upload</span>
          <input
            className="rounded-md border border-border p-3"
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setMessage("");
            }}
          />
        </label>
        <div className="mt-4 flex gap-3">
          <Button disabled={!file || busy} onClick={() => send("/upload/preview")}><UploadCloud size={18} /> Step 1: Validate Preview</Button>
          <Button className="bg-accent" disabled={!file || busy || !preview?.valid} onClick={() => send("/upload")}>Step 2: Save Orders</Button>
        </div>
        {message && <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{message}</p>}
      </Card>
      {preview && <Card><h2 className="mb-3 font-semibold">Validation Result</h2><p className={preview.valid ? "text-emerald-600" : "text-red-600"}>{preview.valid ? "Headers and rows are valid. Orders are not saved until Step 2 is clicked." : "Validation failed. Current working data was not changed."}</p><div className="mt-3 grid gap-2 text-sm">{preview.errors.map((error: string) => <p key={error} className="text-red-600">{error}</p>)}{preview.warnings.map((warning: string) => <p key={warning} className="text-amber-600">{warning}</p>)}</div><div className="mt-4 overflow-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr>{preview.headers.map((header: string) => <th key={header} className="border-b border-border p-2">{header}</th>)}</tr></thead><tbody>{preview.rows.map((row: any, index: number) => <tr key={index}>{preview.headers.map((header: string) => <td key={header} className="border-b border-border p-2">{String(row[header] ?? "")}</td>)}</tr>)}</tbody></table></div></Card>}
    </section>
  );
}
