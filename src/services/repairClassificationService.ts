import type { HousingData, Renovation, UpcomingRepair } from "@/src/models/housingModel";
import { log } from "@/src/utils/logger";

const SERVICE = "repairClassification";

export type RepairCategory = "major" | "minor" | "unknown";

const MAJOR_KEYWORDS = [
  "putkiremontti", "linjasaneeraus", "julkisivu", "julkisivuremontti",
  "kattoremontti", "peruskorjaus", "katto",
];

const MINOR_KEYWORDS = [
  "vesikouru", "lämpöpumppu", "maalaus", "ikkuna", "piha",
  "antennivahistin", "antennivahvistin", "paisunta", "pumppu",
  "ilmanvaihto", "salaoja", "parkkipaikka",
];

export const REPAIR_WEIGHTS: Record<string, number> = {
  putkiremontti:    3.0,
  linjasaneeraus:   3.0,
  julkisivu:        2.0,
  julkisivuremontti: 2.0,
  kattoremontti:    2.0,
  katto:            2.0,
  peruskorjaus:     2.5,
  lämpöpumppu:      0.5,
  vesikouru:        0.2,
  maalaus:          0.2,
  ikkuna:           0.5,
  ilmanvaihto:      0.4,
  salaoja:          0.8,
};

function category(type: string): RepairCategory {
  const t = type.toLowerCase();
  if (MAJOR_KEYWORDS.some((kw) => t.includes(kw))) return "major";
  if (MINOR_KEYWORDS.some((kw) => t.includes(kw))) return "minor";
  return "unknown";
}

export function repairWeight(type: string): number {
  const t = type.toLowerCase();
  for (const [kw, w] of Object.entries(REPAIR_WEIGHTS)) {
    if (t.includes(kw)) return w;
  }
  return 1.0;
}

function classifyRenovations(repairs: Renovation[]): (Renovation & { category: RepairCategory })[] {
  return repairs.map((r) => ({ ...r, category: category(r.type) }));
}

function classifyUpcoming(repairs: UpcomingRepair[]): (UpcomingRepair & { category: RepairCategory })[] {
  return repairs.map((r) => ({ ...r, category: category(r.type) }));
}

export function classifyRepairs(data: HousingData): HousingData {
  const classified = {
    last_major: classifyRenovations(data.repairs.last_major),
    upcoming: classifyUpcoming(data.repairs.upcoming),
  };

  const majorDone = classified.last_major.filter((r) => r.category === "major").map((r) => r.type);
  const majorUpcoming = classified.upcoming.filter((r) => r.category === "major").map((r) => r.type);

  log(SERVICE, "Classification complete", {
    major_done: majorDone,
    major_upcoming: majorUpcoming,
    minor_done: classified.last_major.filter((r) => r.category === "minor").map((r) => r.type),
  });

  return { ...data, repairs: classified };
}
