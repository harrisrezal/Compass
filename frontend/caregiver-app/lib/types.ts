// Shared types matching the Pydantic models in api/models/

export type Utility = "PGE" | "SCE" | "SDGE" | "OTHER";
export type Condition =
  | "oxygen"
  | "dialysis"
  | "wheelchair"
  | "ventilator"
  | "heat_vulnerable"
  | "insulin_dependent"
  | "other";
export type NotifyThreshold = "ELEVATED" | "HIGH" | "CRITICAL";
export type RiskLevel = "LOW" | "MODERATE" | "ELEVATED" | "HIGH" | "CRITICAL";
export type PrimaryThreat = "grid" | "heat" | "wildfire" | "flood" | "none";
export type Urgency = "NOW" | "TODAY" | "BEFORE_EVENT" | "DURING" | "AFTER";

export interface Equipment {
  type?: string;
  power_watts?: number;
  backup_hours?: number;
  supplier_name?: string;
  supplier_phone?: string;
}

export interface Medication {
  name?: string;
  requires_refrigeration?: boolean;
  heat_sensitive?: boolean;
  beta_blocker?: boolean;
}

export interface Caregiver {
  name?: string;
  relationship?: string;
  phone?: string;
  email?: string;
  notify_threshold?: NotifyThreshold;
}

export interface NearestResources {
  hospital_name?: string;
  hospital_miles?: number;
  cooling_center?: string;
  pharmacy_name?: string;
}

export interface UserProfile {
  user_id: string;
  name: string;
  age?: number;
  zip_code: string;
  utility?: Utility;
  medical_baseline_enrolled?: boolean;
  condition?: Condition;
  other_condition?: string;
  equipment?: Equipment;
  medications?: Medication[];
  can_self_evacuate?: boolean;
  preferred_language?: string;
  caregiver?: Caregiver;
  nearest_resources?: NearestResources;
  created_at?: string;
  updated_at?: string;
}

export type UserProfileCreate = Omit<UserProfile, "user_id" | "created_at" | "updated_at">;

export interface RiskScore {
  score_id: string;
  user_id: string;
  timestamp: string;
  forecast_window_hrs?: number;
  composite_score: number;
  risk_level: RiskLevel;
  primary_threat?: PrimaryThreat;
  hours_to_action?: number;
  grid_stress_score?: number;
  heat_index_score?: number;
  wildfire_psps_score?: number;
  flood_risk_score?: number;
  historical_risk_score?: number;
  caiso_stress_pct?: number;
  temp_forecast_f?: number;
  heat_index_f?: number;
  has_red_flag_warning?: boolean;
  active_psps?: boolean;
  fema_flood_zone?: string;
  historical_outage_count?: number;
  persona_multiplier?: number;
  vertex_ai_prediction?: number;
  alert_triggered?: boolean;
}

export interface ActionItem {
  order?: number;
  urgency?: Urgency;
  action?: string;
  detail?: string;
  completed?: boolean;
}

export interface ActionPlan {
  plan_id: string;
  user_id: string;
  score_id?: string;
  generated_at: string;
  risk_level?: string;
  primary_threat?: string;
  action_items?: ActionItem[];
  gemini_raw_output?: string;
  language?: string;
  caregiver_notified?: boolean;
}
