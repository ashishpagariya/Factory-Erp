"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { addKarigar, updateUserRole } from "@/lib/actions/misc";
import { Button, Field } from "@/components/ui/primitives";
import { ROLES } from "@/lib/constants";
import type { Role } from "@/lib/types";

export function AddKarigarForm() {
  const [name, setName] = useState("");
  const [wastage, setWastage] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    if (!name) {
      toast("Enter a name.", "err");
      return;
    }
    setPending(true);
    try {
      const res = await addKarigar(name, parseFloat(wastage || "1"));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setName("");
        setWastage("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2.5 flex-wrap items-end">
      <div className="min-w-[180px]">
        <Field label="New karigar name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
      <div className="min-w-[120px]">
        <Field label="Wastage %">
          <input type="number" step="0.01" value={wastage} onChange={(e) => setWastage(e.target.value)} />
        </Field>
      </div>
      <Button disabled={pending} onClick={submit} className="mb-3">
        Add
      </Button>
    </div>
  );
}

export function RoleSelect({ userId, currentRole }: { userId: string; currentRole: Role }) {
  const [role, setRole] = useState(currentRole);
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function change(newRole: string) {
    setRole(newRole as Role);
    setPending(true);
    try {
      const res = await updateUserRole(userId, newRole);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <select value={role} disabled={pending} onChange={(e) => change(e.target.value)} className="max-w-[220px]">
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}
