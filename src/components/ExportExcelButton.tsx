"use client";
import { useState } from "react";

export function ExportExcelButton({ data, filename }: { data: Record<string, unknown>[]; filename: string }) {
  const [pending, setPending] = useState(false);

  async function download() {
    if (!data || data.length === 0) return;
    setPending(true);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, filename);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={download}
      disabled={pending || !data || data.length === 0}
      className="bg-surface3 border border-border rounded-md px-3 py-1.5 text-[11.5px] font-medium hover:bg-[#333d49] disabled:opacity-40"
    >
      {pending ? "Preparing…" : "⭳ Export Excel"}
    </button>
  );
}