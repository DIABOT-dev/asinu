import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function ChartCard({ title, subtitle, children, footer, className }: Props) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>
      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{subtitle}</p>
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      <div className="relative min-h-[220px]">{children}</div>
      {footer && <div className="text-sm text-slate-500 dark:text-slate-400">{footer}</div>}
    </div>
  );
}
