"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { polishIssue, polishReturn, correctPolish, geruIssue, geruReturn, correctGeru } from "@/lib/actions/process";
import { Button } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { PolishRecord, GeruRecord } from "@/lib/types";

function karigarName(k: any): string {
  if (!k) return "—";
  if (Array.isArray(k)) return k[0]?.name ?? "—";
  return k.name ?? "—";
}
type JobPickerJob = { id: string; karigars?: any; wip: number };

export function JobPicker({ jobs, current }: { jobs: JobPickerJob[]; current: string | null }) {
  const router = useRouter();
  return (
    <select
      value={current ?? ""}
      onChange={(e) => router.push(`/polish-geru?job=${e.target.value}`)}
      className="max-w-[380px]"
    >
      {jobs.length === 0 && <option>No open Job Cards</option>}
      {jobs.map((j) => (
        <option key={j.id} value={j.id}>
          {j.id} — {karigarName(j.karigars)} (WIP {g(j.wip)})
        </option>
      ))}
    </select>
  );
}

export function PolishPanel({ jobId, records, wip, canEdit }: { jobId: string | null; records: PolishRecord[]; wip: number; canEdit: boolean }) {
  const [issueW, setIssueW] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function issue() {
    if (!jobId) return;
    setPending(true);
    try {
      const res = await polishIssue(jobId, parseFloat(issueW));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setIssueW("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {jobId ? (
        <>
          <div className="text-[11px] text-text-faint mb-2.5">
            Finished WIP available: <b className="text-text font-mono">{g(wip)}</b>
          </div>
          <div className="flex gap-2.5 mb-3.5">
            <input type="number" step="0.001" value={issueW} onChange={(e) => setIssueW(e.target.value)} placeholder="Gross to issue" />
            <Button variant="gold" disabled={pending} onClick={issue}>
              Issue
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[12px] text-text-faint mb-3">Select an open Job Card above.</p>
      )}
      <table>
        <thead>
          <tr>
            <th>Polish ID</th>
            <th className="text-right">Issued</th>
            <th>Return</th>
            <th className="text-right">Loss</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-text-faint italic py-4">
                No polish records for this job.
              </td>
            </tr>
          )}
          {records.map((r) => (
            <PolishRow key={r.id} r={r} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PolishRow({ r, canEdit }: { r: PolishRecord; canEdit: boolean }) {
  const [ret, setRet] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editIssued, setEditIssued] = useState(String(r.issued_gross));
  const [editReturned, setEditReturned] = useState(r.returned_gross != null ? String(r.returned_gross) : "");
  const toast = useToast();
  const router = useRouter();

  async function close() {
    setPending(true);
    try {
      const res = await polishReturn(r.id, parseFloat(ret));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function saveCorrection() {
    if (!window.confirm(`Correct ${r.id}?`)) return;
    setPending(true);
    try {
      const newReturned = r.status === "Closed" ? parseFloat(editReturned) : null;
      const res = await correctPolish(r.id, parseFloat(editIssued), newReturned);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <tr>
        <td className="font-mono">{r.id}</td>
        <td className="num-cell">{g(r.issued_gross)}</td>
        <td>
          {r.status === "Open" ? (
            <div className="flex gap-1.5">
              <input type="number" step="0.001" value={ret} onChange={(e) => setRet(e.target.value)} className="w-[100px]" />
              <Button size="sm" disabled={pending} onClick={close}>
                Close
              </Button>
            </div>
          ) : (
            <span className="text-[11px] text-text-faint">Closed</span>
          )}
        </td>
        <td className="num-cell">{r.loss != null ? g(r.loss) : "—"}</td>
        <td>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5} className="bg-surface2">
            <div className="p-2 flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-[11px] text-text-dim mb-1">Issued (g)</label>
                <input type="number" step="0.001" value={editIssued} onChange={(e) => setEditIssued(e.target.value)} className="max-w-[120px]" />
              </div>
              {r.status === "Closed" && (
                <div>
                  <label className="block text-[11px] text-text-dim mb-1">Returned (g)</label>
                  <input type="number" step="0.001" value={editReturned} onChange={(e) => setEditReturned(e.target.value)} className="max-w-[120px]" />
                </div>
              )}
              <Button variant="gold" size="sm" disabled={pending} onClick={saveCorrection}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function GeruPanel({ jobId, records, wip, canEdit }: { jobId: string | null; records: GeruRecord[]; wip: number; canEdit: boolean }) {
  const [issueW, setIssueW] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function issue() {
    if (!jobId) return;
    setPending(true);
    try {
      const res = await geruIssue(jobId, parseFloat(issueW));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setIssueW("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {jobId ? (
        <>
          <div className="text-[11px] text-text-faint mb-2.5">
            Finished WIP available: <b className="text-text font-mono">{g(wip)}</b>
          </div>
          <div className="flex gap-2.5 mb-3.5">
            <input type="number" step="0.001" value={issueW} onChange={(e) => setIssueW(e.target.value)} placeholder="Gross to issue" />
            <Button variant="gold" disabled={pending} onClick={issue}>
              Issue
            </Button>
          </div>
        </>
      ) : (
        <p className="text-[12px] text-text-faint mb-3">Select an open Job Card above.</p>
      )}
      <table>
        <thead>
          <tr>
            <th>Geru ID</th>
            <th className="text-right">Issued</th>
            <th>Return</th>
            <th>Direction</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-text-faint italic py-4">
                No Geru records for this job.
              </td>
            </tr>
          )}
          {records.map((r) => (
            <GeruRow key={r.id} r={r} canEdit={canEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GeruRow({ r, canEdit }: { r: GeruRecord; canEdit: boolean }) {
  const [ret, setRet] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editIssued, setEditIssued] = useState(String(r.issued_gross));
  const [editReturned, setEditReturned] = useState(r.returned_gross != null ? String(r.returned_gross) : "");
  const toast = useToast();
  const router = useRouter();

  async function close() {
    setPending(true);
    try {
      const res = await geruReturn(r.id, parseFloat(ret));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function saveCorrection() {
    if (!window.confirm(`Correct ${r.id}?`)) return;
    setPending(true);
    try {
      const newReturned = r.status === "Closed" ? parseFloat(editReturned) : null;
      const res = await correctGeru(r.id, parseFloat(editIssued), newReturned);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <tr>
        <td className="font-mono">{r.id}</td>
        <td className="num-cell">{g(r.issued_gross)}</td>
        <td>
          {r.status === "Open" ? (
            <div className="flex gap-1.5">
              <input type="number" step="0.001" value={ret} onChange={(e) => setRet(e.target.value)} className="w-[100px]" />
              <Button size="sm" disabled={pending} onClick={close}>
                Close
              </Button>
            </div>
          ) : (
            <span className="text-[11px] text-text-faint">Closed</span>
          )}
        </td>
        <td>
          {r.direction ? (
            <span className={r.direction === "Added" ? "text-amber" : "text-text-dim"}>
              {r.direction} {g(Math.abs(r.raw_variance ?? 0))}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={5} className="bg-surface2">
            <div className="p-2 flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-[11px] text-text-dim mb-1">Issued (g)</label>
                <input type="number" step="0.001" value={editIssued} onChange={(e) => setEditIssued(e.target.value)} className="max-w-[120px]" />
              </div>
              {r.status === "Closed" && (
                <div>
                  <label className="block text-[11px] text-text-dim mb-1">Returned (g)</label>
                  <input type="number" step="0.001" value={editReturned} onChange={(e) => setEditReturned(e.target.value)} className="max-w-[120px]" />
                </div>
              )}
              <Button variant="gold" size="sm" disabled={pending} onClick={saveCorrection}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}