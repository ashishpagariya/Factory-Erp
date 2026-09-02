import type { Material, Role } from "./types";

export const ROLES: Role[] = [
  "Owner / Admin",
  "Office Manager",
  "Factory Manager",
  "Supervisor",
  "Tagged Product Receiver",
];

// Mirrors the `materials` table seed in 0001_init.sql — used for dropdowns
// without an extra round trip where a static list is good enough. The
// database remains the source of truth (all inserts/validation happen there).
export const MATERIALS: Material[] = [
  { id: "BUL9990", name: "Bullion 99.90%", category: "Bullion", purity: 99.9, locked: false, wastage_applicable: false },
  { id: "BUL9950", name: "Bullion 99.50%", category: "Bullion", purity: 99.5, locked: false, wastage_applicable: false },
  { id: "EF", name: "EF", category: "SemiFinished", purity: 91.7, locked: true, wastage_applicable: false },
  { id: "GEJJE", name: "Gejje", category: "SemiFinished", purity: 91.7, locked: true, wastage_applicable: false },
  { id: "SCREW", name: "Screw", category: "SemiFinished", purity: 91.7, locked: true, wastage_applicable: false },
  { id: "REPAIR", name: "Repair", category: "SemiFinished", purity: 91.7, locked: true, wastage_applicable: false },
  { id: "MELTBAR", name: "Melt Bar", category: "Manufacturing", purity: 91.7, locked: true, wastage_applicable: true },
  { id: "DYE", name: "Dye", category: "Manufacturing", purity: 91.7, locked: true, wastage_applicable: true },
  { id: "KDM", name: "KDM", category: "Manufacturing", purity: 91.7, locked: true, wastage_applicable: true },
  { id: "BALLS", name: "Balls", category: "Manufacturing", purity: 91.7, locked: true, wastage_applicable: true },
  { id: "CHAIN", name: "Chain", category: "Manufacturing", purity: 91.7, locked: true, wastage_applicable: true },
  { id: "STONE", name: "Stone", category: "NonGold", purity: null, locked: false, wastage_applicable: false },
  { id: "ALLOY", name: "Alloy", category: "NonGold", purity: null, locked: false, wastage_applicable: false },
];
export const MAT = (id: string) => MATERIALS.find((m) => m.id === id);
export const OFFICE_DISPATCHABLE: Material["category"][] = ["Bullion", "SemiFinished", "NonGold"];
export const KARIGAR_ISSUABLE = ["MELTBAR", "DYE", "KDM", "BALLS", "CHAIN", "EF", "GEJJE", "SCREW", "REPAIR"];

// What each role can open — same model as the prototype's ROLE_ACCESS map.
export const ROLE_ACCESS: Record<Role, "ALL" | string[]> = {
  "Owner / Admin": "ALL",
  "Office Manager": ["/", "/office-flow", "/dispatch"],
  "Factory Manager": [
    "/",
    "/factory-inward",
    "/melting",
    "/karigar-job",
    "/polish-geru",
    "/beads-stones",
    "/settlement",
    "/tagging",
    "/dispatch",
  ],
  Supervisor: [
    "/",
    "/factory-inward",
    "/melting",
    "/karigar-job",
    "/polish-geru",
    "/beads-stones",
    "/settlement",
    "/tagging",
    "/dispatch",
    "/reports",
  ],
  "Tagged Product Receiver": ["/", "/tagging", "/reports"],
};
export function canAccess(role: Role, path: string) {
  const allowed = ROLE_ACCESS[role];
  return allowed === "ALL" || allowed.includes(path);
}