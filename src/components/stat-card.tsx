import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "warning" | "success";
}) {
  const inner = (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm",
        tone === "warning" && "border-amber-200 bg-amber-50",
        tone === "success" && "border-emerald-200 bg-emerald-50",
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block transition hover:-translate-y-0.5 hover:shadow-md">
        {inner}
      </a>
    );
  }
  return inner;
}
