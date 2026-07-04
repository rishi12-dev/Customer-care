import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/Button";

const PINCODE_URL = "https://oms.indiashoppe.com/reports/Pincode";

export function PincodePage() {
  const [frameKey, setFrameKey] = useState(0);
  const [compactView, setCompactView] = useState(true);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Pincode</h1>
          <p className="text-sm text-slate-500">IndiaShoppe pincode report</p>
        </div>
        <div className="flex gap-2">
          <Button className={compactView ? "bg-primary" : "bg-accent"} type="button" onClick={() => setCompactView((value) => !value)}>
            {compactView ? "Report view" : "Full view"}
          </Button>
          <Button className="bg-accent" type="button" onClick={() => setFrameKey((value) => value + 1)}>
            <RefreshCw size={16} /> Reload
          </Button>
          <Button type="button" onClick={() => window.open(PINCODE_URL, "_blank", "noopener,noreferrer")}>
            <ExternalLink size={16} /> Open
          </Button>
        </div>
      </div>
      <div className="relative h-[calc(100vh-11rem)] min-h-[560px] overflow-hidden rounded-lg border border-border bg-white shadow-sm">
        <iframe
          key={frameKey}
          className={compactView ? "absolute left-[-250px] top-[-72px] h-[calc(100%+72px)] w-[calc(100%+250px)] max-w-none bg-white" : "h-full w-full bg-white"}
          title="IndiaShoppe pincode report"
          src={PINCODE_URL}
        />
      </div>
    </section>
  );
}
