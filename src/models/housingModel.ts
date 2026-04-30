// Internal data model that flows through all services

export interface LocationData {
  city: string | null;
  address: string | null;
  coordinates: [number, number] | null;
  area_type: "urban" | "suburban" | "rural" | null;
}

export interface FinancialData {
  maintenance_fee_monthly: number | null;
  financing_fee_monthly: number | null;
  loan_per_share: number | null;
  loan_per_m2: number | null;
  housing_company_debt_total: number | null;
  repair_fund: number | null;
}

export interface BuildingData {
  year: number | null;
  size_m2: number | null;
  energy_class: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null;
  heating_system: string | null;
}

export interface Renovation {
  type: string;
  year: number | null;
  category?: "major" | "minor" | "unknown";
  evidence?: string | null;
  extraction_confidence?: number | null; // 0–1 from LLM
}

export interface UpcomingRepair {
  type: string;
  planned_year: number | null;
  confidence: "high" | "medium" | "low";
  category?: "major" | "minor" | "unknown";
  evidence?: string | null;
  extraction_confidence?: number | null; // 0–1 from LLM
}

export interface RepairData {
  last_major: Renovation[];
  upcoming: UpcomingRepair[];
}

export interface MarketData {
  avg_price_m2: number | null;
  deviation_percent: number | null;
}

export interface LandData {
  owns_land: boolean | null;       // true = oma tontti, false = vuokratontti
  ground_rent_monthly: number | null;
  lease_end_year: number | null;
}

export interface PopulationData {
  trend_5y: number | null;         // % väestönmuutos 5 vuodessa (negatiivinen = vähenevä)
  is_declining: boolean | null;    // true jos lasku > 2%
  municipality: string | null;
}

export interface HousingData {
  location: LocationData;
  financials: FinancialData;
  building: BuildingData;
  repairs: RepairData;
  market: MarketData;
  land: LandData;
  population: PopulationData;
}

export interface ScoringFactor {
  label: string;
  impact: number;
  reason: string;
}

export interface AnalysisOutput {
  verdict: "ÄLÄ OSTA" | "HARKITSE TARKKAAN" | "HYVÄ KOHDE";
  risk_score: number;
  monthly_cost: number;
  market_position: "overpriced" | "fair" | "undervalued";
  confidence: number;
  red_flags: string[];
  scoring_factors: ScoringFactor[];
}

// API response shape (consumed by frontend)
export interface ApiResponse extends AnalysisOutput {
  upcoming_repairs: UpcomingRepair[];
  extracted: {
    apartment_size_m2: number | null;
    building_year: number | null;
    maintenance_fee_monthly: number | null;
    financing_fee_monthly: number | null;
    loan_per_share: number | null;
    loan_per_m2: number | null;
    housing_company_debt_total: number | null;
    repair_fund: number | null;
    energy_class: string | null;
    heating_system: string | null;
    owns_land: boolean | null;
    ground_rent_monthly: number | null;
    lease_end_year: number | null;
    last_major_renovations: Renovation[];
    upcoming_repairs: UpcomingRepair[];
    red_flags_detected: never[];
  };
}
