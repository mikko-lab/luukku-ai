export interface Renovation {
  type: string;
  year: number | null;
}

export interface UpcomingRepair {
  type: string;
  planned_year: number | null;
  confidence: "high" | "medium" | "low";
  cost_estimate_eur?: number | null;
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
  owns_land: boolean | null;
  ground_rent_monthly: number | null;
  lease_end_year: number | null;
  last_major_renovations: Renovation[];
  upcoming_repairs: UpcomingRepair[];
  red_flags_detected: RedFlag[];
}

export interface ScoringFactor {
  label: string;
  impact: number;
  reason: string;
}

export interface AnalysisResult {
  verdict: "ÄLÄ OSTA" | "HARKITSE TARKKAAN" | "HYVÄ KOHDE";
  risk_score: number;
  monthly_cost: number;
  market_position: "overpriced" | "fair" | "undervalued";
  confidence: number;
  factors: ScoringFactor[];
  upcoming_repairs: UpcomingRepair[];
  red_flags: string[];
  extracted: ExtractedData & {
    confidence_percent?: number;
    confidence_level?: "low" | "medium" | "high";
    missing_fields?: string[];
  };
}
