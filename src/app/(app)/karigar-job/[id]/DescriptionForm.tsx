"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { updateJobDescription } from "@/lib/actions/jobcard";
import { Button } from "@/components/ui/primitives";

export function DescriptionForm({ jobId, initial }: { jobId: string; initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function save() {
    setPending(true);
    try {
      const res = await updateJobDescription(jobId, value);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder="Describe what was given to the karigar on this job — e.g. 100g Melt Bar for a bangle set, 20g EF for repair work…"
        className="w-full bg-surface2 border border-border rounded-md p-3 text-[13px] mb-2"
      />
      <Button size="sm" disabled={pending} onClick={save}>
        Save Description
      </Button>
    </div>
  );
}