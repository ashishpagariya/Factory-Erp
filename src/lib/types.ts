export type MaterialCategory = "Bullion" | "SemiFinished" | "Manufacturing" | "NonGold";

export type Role =
  | "Owner / Admin"
  | "Office Manager"
  | "Factory Manager"
  | "Supervisor"
  | "Tagged Product Receiver";

export interface Material {
  id: string;
  name: string;
  category: MaterialCategory;
  purity: number | null;
  locked: boolean;
  wastage_applicable: boolean;
}

export interface Karigar {
  id: string;
  name: string;
  wastage_pct: number;
  active: boolean;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
}

export interface OfficeDispatch {
  id: string;
  material_id: string;
  gross: number;
  purity: number | null;
  fine: number | null;
  status: "Pending" | "Accepted" | "Discrepancy";
  received_gross: number | null;
  discrepancy_reason: string | null;
  created_at: string;
}

export interface Melt {
  id: string;
  melt_type: string;
  input_material: string;
  input_weight: number;
  input_purity: number;
  expected_output: number;
  auto_alloy: number;
  actual_output: number;
  melt_loss: number;
  created_at: string;
}

export interface Settlement {
  totalIssued: number;
  totalReceived: number;
  dhodiNet: number;
  materialReturns: number;
  usedSemiFinished: number;
  wastageBase: number;
  allowedWastage: number;
  variance: number;
  saving: number;
  loss: number;
}

export interface JobCard {
  id: string;
  karigar_id: string;
  wastage_pct: number;
  status: "Open" | "Settled";
  opening_type: "Issue" | "Receipt" | null;
  opening_amount: number | null;
  opening_note: string | null;
  description: string | null;
  settlement: Settlement | null;
  created_at: string;
  settled_at: string | null;
  karigars?: { name: string };
}

export interface PolishRecord {
  id: string;
  job_id: string;
  issued_gross: number;
  returned_gross: number | null;
  loss: number | null;
  status: "Open" | "Closed";
}

export interface GeruRecord {
  id: string;
  job_id: string;
  issued_gross: number;
  returned_gross: number | null;
  raw_variance: number | null;
  direction: string | null;
  status: "Open" | "Closed";
}

export interface SettingRecord {
  id: string;
  job_id: string;
  product_gross: number;
  stones_issued: number;
  other_material_issued: number;
  final_product_gross: number | null;
  unused_stones_returned: number | null;
  unused_material_returned: number | null;
  mismatch: number | null;
  status: "Open" | "Closed";
}

export interface Tag {
  tag_no: string;
  job_id: string;
  pieces: number | null;
  gross: number;
  net: number | null;
  purity: number | null;
  synced: boolean;
  dispatch_status: "InFactory" | "Transit" | "Delivered";
  created_at: string;
}

export interface FactoryDispatch {
  id: string;
  category: string;
  status: "Pending" | "Accepted";
  created_at: string;
}

export interface StockTake {
  id: string;
  material_id: string;
  system_weight: number;
  physical_weight: number;
  variance: number;
  status: "Pending" | "Approved";
  reason: string | null;
}

export interface LedgerRow {
  id: number;
  ts: string;
  type: string;
  ref: string | null;
  material: string | null;
  gross: number | null;
  purity: number | null;
  fine: number | null;
  from_location: string | null;
  to_location: string | null;
  user_id: string | null;
}

export interface DashboardSnapshot {
  bullionFine: number;
  semiFine: number;
  mfgFine: number;
  karigarWipFine: number;
  processWipFine: number;
  finishedTaggedFine: number;
  transitO2F: number;
  transitF2O: number;
  currentAccountableFine: number;
  officeInvestmentFine: number;
  officeReceivedFine: number;
  authorisedLossFine: number;
  unreconciledFine: number;
}

export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string };