import { cn } from "../utils/cn";

const statusClass: Record<string, string> = {
  Delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "In Transit": "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "Out For Delivery": "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  NDR: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
  RTO: "bg-zinc-200 text-zinc-950 dark:bg-zinc-700 dark:text-white",
  Delayed: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200"
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", statusClass[status] ?? "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100")}>{status}</span>;
}
