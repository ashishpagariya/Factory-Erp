"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { correctJobIssue, correctMaterialReturn, correctDhodiReceipt } from "@/lib/actions/jobcard";
import { MAT } from "@/lib/constants";
import { Button } from "@/components/ui/primitives";
import { g } from "@/lib/format";

type IssueRow = { id: string; material_id: string; weight: number; created_at: string };
type MaterialReturnRow = { id: string; material_id: string; weight: number; created_at: string };
type DhodiRow = { id: string; pieces: number; gross: number; net: number; created_at: string };

export function RecentTransactions({
  jobId,
  canEdit,
  issues,
  materialReturns,
  dhodiReturns,
}: {
  jobId: string;
  canEdit: boolean;
  issues: IssueRow[];
  materialReturns: MaterialReturnRow[];
  dhodiReturns: DhodiRow[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
      <div>
        <div className="text-[11.5px] text-text-dim font-semibold mb-2">Issues</div>
        <table>
          <tbody>
            {issues.length === 0 && <tr className="empty-row"><td className="text-text-faint italic text-[11px] py-3">None yet.</td></tr>}
            {issues.map((r) => (
              <IssueRowItem key={r.id} row={r} jobId={jobId} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="text-[11.5px] text-text-dim font-semibold mb-2">Material Returns</div>
        <table>
          <tbody>
            {materialReturns.length === 0 && <tr className="empty-row"><td className="text-text-faint italic text-[11px] py-3">None yet.</td></tr>}
            {materialReturns.map((r) => (
              <MaterialReturnRowItem key={r.id} row={r} jobId={jobId} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="text-[11.5px] text-text-dim font-semibold mb-2">Dhodi Receipts</div>
        <table>
          <tbody>
            {dhodiReturns.length === 0 && <tr className="empty-row"><td className="text-text-faint italic text-[11px] py-3">None yet.</td></tr>}
            {dhodiReturns.map((r) => (
              <DhodiRowItem key={r.id} row={r} jobId={jobId} canEdit={canEdit} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IssueRowItem({ row, jobId, canEdit }: { row: IssueRow; jobId: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(String(row.weight));
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function save() {
    if (!window.confirm(`Correct this issue?`)) return;
    setPending(true);
    try {
      const res = await correctJobIssue(row.id, jobId, parseFloat(weight));
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
        <td className="text-[12px]">{MAT(row.material_id)?.name ?? row.material_id}</td>
        <td className="num-cell">{g(row.weight)}</td>
        <td>{canEdit && <Button size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel" : "Edit"}</Button>}</td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={3} className="bg-surface2">
            <div className="p-2 flex gap-2 items-end">
              <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} className="max-w-[130px]" />
              <Button variant="gold" size="sm" disabled={pending} onClick={save}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function MaterialReturnRowItem({ row, jobId, canEdit }: { row: MaterialReturnRow; jobId: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(String(row.weight));
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function save() {
    if (!window.confirm(`Correct this return?`)) return;
    setPending(true);
    try {
      const res = await correctMaterialReturn(row.id, jobId, parseFloat(weight));
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
        <td className="text-[12px]">{MAT(row.material_id)?.name ?? row.material_id}</td>
        <td className="num-cell">{g(row.weight)}</td>
        <td>{canEdit && <Button size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel" : "Edit"}</Button>}</td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={3} className="bg-surface2">
            <div className="p-2 flex gap-2 items-end">
              <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} className="max-w-[130px]" />
              <Button variant="gold" size="sm" disabled={pending} onClick={save}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DhodiRowItem({ row, jobId, canEdit }: { row: DhodiRow; jobId: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pieces, setPieces] = useState(String(row.pieces));
  const [gross, setGross] = useState(String(row.gross));
  const [net, setNet] = useState(String(row.net));
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function save() {
    if (!window.confirm(`Correct this Dhodi receipt?`)) return;
    setPending(true);
    try {
      const res = await correctDhodiReceipt(row.id, jobId, parseInt(pieces || "0"), parseFloat(gross), parseFloat(net));
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
        <td className="text-[12px]">{row.pieces} pcs</td>
        <td className="num-cell">{g(row.gross)} / {g(row.net)}</td>
        <td>{canEdit && <Button size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel" : "Edit"}</Button>}</td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={3} className="bg-surface2">
            <div className="p-2 flex gap-2 items-end flex-wrap">
              <input type="number" value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="Pieces" className="max-w-[80px]" />
              <input type="number" step="0.001" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="Gross" className="max-w-[110px]" />
              <input type="number" step="0.001" value={net} onChange={(e) => setNet(e.target.value)} placeholder="Net" className="max-w-[110px]" />
              <Button variant="gold" size="sm" disabled={pending} onClick={save}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}