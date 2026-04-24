export interface Renovation {
  type: string;
  year: number | null;
}

export interface UpcomingRepair {
  type: string;
  planned_year: number | null;
  confidence: "high" | "medium" | "low";
}

export interface RedFlag {
  issue: string;
  confidence: "high" | "medium" | "low";
}

export interface ExtractedData {
  apartment_size_m2: number | null;
  building_year: number | null;
  maintenance_fee_monthly: number | null;
  financing_fee_monthly: number | null;
  loan_per_share: number | null;
  loan_per_m2: number | null;
  housing_company_debt_total: number | null;
  repair_fund: number | null;
  last_major_renovations: Renovation[];
  upcoming_repairs: UpcomingRepair[];
  red_flags_detected: RedFlag[];
}

export interface AnalysisResult {
  risk_score: number;
  monthly_cost: number;
  upcoming_repairs: UpcomingRepair[];
  red_flags: string[];
  extracted: ExtractedData;
}
