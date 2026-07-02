import { InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-primary/30 dark:bg-muted", className)} {...props} />;
}
