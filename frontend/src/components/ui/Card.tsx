import { HTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-border bg-white/78 p-5 shadow-soft backdrop-blur dark:bg-white/6", className)} {...props} />;
}
