import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "gold" | "danger" | "ghost";
  size?: "md" | "sm";
}) {
  return (
    <button
      className={cn(
        "rounded-md border font-medium transition disabled:opacity-40 disabled:cursor-not-allowed",
        size === "md" ? "px-3.5 py-2 text-[12.5px]" : "px-2.5 py-1 text-[11.5px]",
        variant === "default" && "bg-surface3 text-text border-border hover:bg-[#333d49]",
        variant === "gold" &&
          "bg-gradient-to-b from-gold-bright to-gold text-[#211703] border-gold-bright font-bold hover:brightness-110",
        variant === "danger" && "bg-[#3A1E20] text-[#F4A9A9] border-[#5b2b2b] hover:bg-[#472326]",
        variant === "ghost" && "bg-transparent border-border",
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface border border-border rounded-xl p-4 md:p-[18px]", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, children, tag }: { className?: string; children: ReactNode; tag?: ReactNode }) {
  return (
    <h3 className={cn("text-[12.5px] uppercase tracking-wide text-text-dim font-bold mb-3 flex items-center gap-2", className)}>
      {children}
      {tag}
    </h3>
  );
}

export function Tag({ kind = "control", children }: { kind?: "must" | "control" | "config" | "example" | "block"; children: ReactNode }) {
  const styles: Record<string, string> = {
    must: "bg-[#2C2013] text-gold-bright border-[#4a3a1c]",
    control: "bg-[#132225] text-[#7FD1C8] border-[#1e3a3d]",
    config: "bg-[#1B2233] text-[#9BB4EE] border-[#2a3350]",
    example: "bg-[#182B1E] text-[#8FCB9F] border-[#24422e]",
    block: "bg-[#331717] text-[#F4A9A9] border-[#4d2222]",
  };
  return (
    <span className={cn("text-[9.5px] font-extrabold tracking-wide px-[7px] py-[2px] rounded uppercase border", styles[kind])}>
      {children}
    </span>
  );
}

export function Badge({ kind = "closed", children }: { kind?: "open" | "pending" | "closed" | "accepted" | "discrepancy" | "settled"; children: ReactNode }) {
  const styles: Record<string, string> = {
    open: "bg-[#132A22] text-[#68CDA0] border-[#1d4a37]",
    accepted: "bg-[#132A22] text-[#68CDA0] border-[#1d4a37]",
    pending: "bg-[#2E2311] text-amber border-[#4a3818]",
    closed: "bg-[#20242c] text-text-dim border-border",
    discrepancy: "bg-[#331717] text-[#F4A9A9] border-[#4d2222]",
    settled: "bg-[#1B2233] text-[#9BB4EE] border-[#2a3350]",
  };
  return (
    <span className={cn("text-[10.5px] font-bold px-2 py-[3px] rounded-full border inline-block", styles[kind])}>
      {children}
    </span>
  );
}

export function Callout({ kind = "control", children }: { kind?: "control" | "must" | "block" | "config"; children: ReactNode }) {
  const styles: Record<string, string> = {
    control: "bg-[#0F1E20] border-[#1e3a3d] text-[#B9E6E0]",
    must: "bg-[#1E1706] border-[#4a3a1c] text-[#E9D39E]",
    block: "bg-[#241010] border-[#4d2222] text-[#F4B9B9]",
    config: "bg-[#131A2B] border-[#2a3350] text-[#C4D2F5]",
  };
  const icon = kind === "block" ? "✕" : "◆";
  return (
    <div className={cn("rounded-lg p-3.5 text-[12.5px] leading-relaxed flex gap-2.5 border", styles[kind])}>
      <span className="flex-shrink-0">{icon}</span>
      <div>{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "gold" | "red" | "green";
}) {
  const valueColor =
    tone === "gold" ? "text-gold-bright" : tone === "red" ? "text-red" : tone === "green" ? "text-green" : "text-text";
  return (
    <div className="bg-surface border border-border rounded-xl p-3.5">
      <div className="text-[11px] text-text-dim uppercase tracking-wide mb-1.5">{label}</div>
      <div className={cn("font-mono text-[22px] font-bold", valueColor)}>{value}</div>
      {sub && <div className="text-[11px] text-text-faint mt-1">{sub}</div>}
    </div>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <pre className="font-mono bg-[#0E1116] border border-border rounded-lg p-3.5 text-[13px] text-gold-bright leading-8 whitespace-pre-wrap">
      {children}
    </pre>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <label className="block text-[11.5px] text-text-dim mb-1.5 font-semibold">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-text-faint mt-1">{hint}</div>}
    </div>
  );
}
