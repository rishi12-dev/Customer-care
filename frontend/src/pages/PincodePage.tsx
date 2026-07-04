import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";

const PINCODE_URL = "https://oms.indiashoppe.com/reports/Pincode";

export function PincodePage() {
  const [frameKey, setFrameKey] = useState(0);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Pincode</h1>
          <p className="text-sm text-slate-500">IndiaShoppe pincode report</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-accent" type="button" onClick={() => setFrameKey((value) => value + 1)}>
            <RefreshCw size={16} /> Reload
          </Button>
          <Button type="button" onClick={() => window.open(PINCODE_URL, "_blank", "noopener,noreferrer")}>
            <ExternalLink size={16} /> Open
          </Button>
        </div>
      </div>
      <div className="h-[calc(100vh-11rem)] min-h-[560px] overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <iframe key={frameKey} className="h-full w-full" title="IndiaShoppe pincode report" src={PINCODE_URL} />
      </div>
    </section>
  );
}
