import { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Minimize2, Send, X } from "lucide-react";
import { api } from "../api/client";
import { cn } from "../utils/cn";

type AssistantReply = { found: boolean; message: string; details?: Record<string, string> };
type ChatMessage = { id: number; from: "rishi" | "user"; text: string; details?: Record<string, string> };

const welcome: ChatMessage = {
  id: 1,
  from: "rishi",
  text: "Hi, I'm Rishi. Share an order number or docket number for the latest uploaded shipment details. Type Summary for overall counts, or 1-5 Summary for the ShippingDate 1-5 range.",
};

export function RishiAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const query = input.trim();
    if (query.length < 2 || loading) return;
    setMessages((current) => [...current, { id: Date.now(), from: "user", text: query }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await api<AssistantReply>(`/assistant?q=${encodeURIComponent(query)}`);
      setMessages((current) => [...current, { id: Date.now() + 1, from: "rishi", text: reply.message, details: reply.details }]);
    } catch (error) {
      setMessages((current) => [...current, { id: Date.now() + 1, from: "rishi", text: error instanceof Error ? error.message : "I could not check the uploaded records right now. Please try again shortly." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-30 print:hidden">
      {open && (
        <section className="rishi-chat mb-3 flex w-[min(24rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
          <header className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <div className="flex items-center gap-3"><span className="rishi-avatar grid h-9 w-9 place-items-center rounded-full bg-white/15"><Bot size={21} /></span><div><h2 className="font-bold">Rishi</h2><p className="text-xs text-white/80">Shipment Assistant</p></div></div>
            <div className="flex gap-1"><button className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/15" onClick={() => setOpen(false)} aria-label="Minimize Rishi"><Minimize2 size={17} /></button><button className="grid h-8 w-8 place-items-center rounded-md hover:bg-white/15" onClick={() => setOpen(false)} aria-label="Close Rishi"><X size={17} /></button></div>
          </header>
          <div className="max-h-[min(31rem,62vh)] min-h-72 space-y-3 overflow-y-auto bg-slate-950/5 p-4 dark:bg-black/20">
            {messages.map((message) => <ChatBubble key={message.id} message={message} />)}
            {loading && <div className="rishi-typing w-fit rounded-md border border-border bg-background px-3 py-2 text-sm text-slate-500">Rishi is checking uploaded records<span>.</span><span>.</span><span>.</span></div>}
            <div ref={endRef} />
          </div>
          <form className="flex gap-2 border-t border-border p-3" onSubmit={submit}>
            <input className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Order no., docket no., or Summary" aria-label="Ask Rishi" />
            <button className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-white transition hover:brightness-105 disabled:opacity-60" disabled={!input.trim() || loading} aria-label="Send message"><Send size={17} /></button>
          </form>
        </section>
      )}
      <button className={cn("rishi-launcher grid h-14 w-14 place-items-center rounded-full bg-primary text-white shadow-xl transition hover:scale-105", open && "bg-slate-800")} onClick={() => setOpen((value) => !value)} aria-label="Open Rishi shipment assistant">
        {open ? <X size={23} /> : <><Bot size={25} /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" /></>}
      </button>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  return <div className={cn("max-w-[92%] rounded-lg p-3 text-sm leading-relaxed", message.from === "user" ? "ml-auto bg-primary text-white" : "border border-border bg-background text-foreground")}><p>{message.text}</p>{message.details && <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">{Object.entries(message.details).map(([label, value]) => <div key={label} className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="break-words font-medium">{value}</p></div>)}</div>}</div>;
}
