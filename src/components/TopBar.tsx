"use client";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import type { Role } from "@/lib/types";

export function TopBar({ role, fullName }: { role: Role; fullName: string | null }) {
  return (
    <div className="flex items-center gap-3.5 px-4 md:px-[18px] py-2.5 bg-gradient-to-b from-[#171B21] to-bg border-b border-border sticky top-0 z-50 flex-wrap">
      <Link href="/" className="flex items-center gap-2.5 select-none">
        <div className="w-[30px] h-[30px] rounded-md bg-gradient-to-br from-gold-dim via-gold-bright to-gold-dim flex items-center justify-center text-[13px] font-bold text-[#191305] font-mono">
          AT
        </div>
        <div className="leading-tight">
          <div className="font-bold text-[14.5px] tracking-tight">AurumTemple</div>
          <div className="text-[10.5px] text-text-faint uppercase tracking-wide">JJJ Factory ERP</div>
        </div>
      </Link>
      <div className="flex-1" />
      <div className="flex items-center gap-2 bg-surface2 border border-border rounded-full pl-3 pr-1.5 py-[5px] text-[12px] text-text-dim">
        <span>{fullName || "Signed in"}</span>
        <span className="bg-surface3 border border-border rounded-full px-2.5 py-1 text-[11.5px] text-text">{role}</span>
      </div>
      <form action={signOut}>
        <button className="bg-surface3 border border-border rounded-md px-3 py-[7px] text-[12.5px] font-medium hover:bg-[#333d49]">
          Sign out
        </button>
      </form>
    </div>
  );
}
