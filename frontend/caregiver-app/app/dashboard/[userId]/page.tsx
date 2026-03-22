import Link from "next/link";
import { api } from "@/lib/api";
import type { UserProfile, RiskScore, ActionPlan } from "@/lib/types";
import RiskScoreCard from "@/components/dashboard/RiskScoreCard";
import ActionPlanChecklist from "@/components/dashboard/ActionPlanChecklist";
import OrganisationsPanel from "@/components/dashboard/OrganisationsPanel";
import SubscribersPanel from "@/components/dashboard/SubscribersPanel";

interface Props {
  params: Promise<{ userId: string }>;
}

// Demo user profiles for fallback when BQ has no profile record
const DEMO_PROFILES: Record<string, UserProfile> = {
  "demo-user-margaret-001": {
    user_id: "demo-user-margaret-001",
    name: "Margaret Rodriguez",
    age: 74,
    zip_code: "93720",
    utility: "PGE",
    condition: "oxygen",
    equipment: { type: "Oxygen concentrator (5L/min)", power_watts: 300, backup_hours: 4, supplier_name: "AeroCare Medical", supplier_phone: "1-800-232-7263" },
    caregiver: { name: "Maria Rodriguez", relationship: "daughter", phone: "+14155550182", notify_threshold: "HIGH" },
    nearest_resources: { hospital_name: "Fresno Community Hospital", hospital_miles: 1.8, cooling_center: "Fresno City Hall", pharmacy_name: "CVS Pharmacy" },
  },
  "demo-user-james-002": {
    user_id: "demo-user-james-002",
    name: "James Thornton",
    age: 68,
    zip_code: "95969",
    utility: "PGE",
    condition: "ventilator",
    equipment: { type: "Home mechanical ventilator (BiPAP)", power_watts: 250, backup_hours: 8, supplier_name: "Lincare Holdings", supplier_phone: "1-800-284-2006" },
    caregiver: { name: "Sandra Thornton", relationship: "spouse", phone: "+15305550294", notify_threshold: "ELEVATED" },
    nearest_resources: { hospital_name: "Adventist Health Feather River", hospital_miles: 3.2, cooling_center: "Paradise Community Center", pharmacy_name: "Rite Aid" },
  },
  "demo-user-dorothy-003": {
    user_id: "demo-user-dorothy-003",
    name: "Dorothy Kim",
    age: 81,
    zip_code: "90034",
    utility: "SCE",
    condition: "heat_vulnerable",
    equipment: { type: "Air conditioner (window unit)", power_watts: 1200, backup_hours: 0 },
    caregiver: { name: "David Kim", relationship: "son", phone: "+13105550471", notify_threshold: "HIGH" },
    nearest_resources: { hospital_name: "Cedars-Sinai Medical Center", hospital_miles: 2.1, cooling_center: "Culver City Senior Center", pharmacy_name: "Walgreens" },
  },
};

// Demo score for when no score exists in BQ yet
function demoScore(userId: string): RiskScore {
  const scores: Record<string, Partial<RiskScore>> = {
    "demo-user-margaret-001": { composite_score: 91, risk_level: "CRITICAL", primary_threat: "grid", hours_to_action: 4, has_red_flag_warning: true, active_psps: true },
    "demo-user-james-002":    { composite_score: 74, risk_level: "HIGH",     primary_threat: "wildfire", hours_to_action: 0, active_psps: true },
    "demo-user-dorothy-003":  { composite_score: 58, risk_level: "ELEVATED", primary_threat: "heat", hours_to_action: 6 },
  };
  return {
    score_id: "demo",
    user_id: userId,
    timestamp: new Date().toISOString(),
    forecast_window_hrs: 72,
    composite_score: 45,
    risk_level: "MODERATE",
    ...scores[userId],
  };
}

const DEMO_PLAN: ActionPlan = {
  plan_id: "demo",
  user_id: "",
  generated_at: new Date().toISOString(),
  risk_level: "CRITICAL",
  primary_threat: "grid",
  action_items: [
    { order: 1, urgency: "NOW",          action: "Charge backup battery",      detail: "Plug in your oxygen concentrator battery pack immediately — you have 4 hours of backup.",      completed: false },
    { order: 2, urgency: "NOW",          action: "Call AeroCare Medical",      detail: "Notify your supplier (1-800-232-7263) that a PSPS event is expected in your ZIP.",             completed: false },
    { order: 3, urgency: "TODAY",        action: "Pick up medications",        detail: "Collect a 7-day supply from CVS Pharmacy before the outage window.",                            completed: false },
    { order: 4, urgency: "BEFORE_EVENT", action: "Pre-position at hospital",   detail: "Fresno Community Hospital (1.8 miles) has backup power — consider relocating before 4PM.",   completed: false },
    { order: 5, urgency: "BEFORE_EVENT", action: "Alert caregiver",           detail: "Maria Rodriguez has been notified. Confirm she can reach you within 30 minutes.",               completed: true  },
    { order: 6, urgency: "DURING",       action: "Conserve oxygen supply",    detail: "Reduce activity level to extend backup battery life. Stay seated and calm.",                  completed: false },
    { order: 7, urgency: "DURING",       action: "Call 211 if battery below 1h", detail: "211 California can coordinate emergency power for medical equipment.",                   completed: false },
  ],
};

export default async function DashboardPage({ params }: Props) {
  const { userId } = await params;

  // Fetch score and plan in parallel — fall back to demo data if not found
  const [scoreResult, planResult] = await Promise.allSettled([
    api.getScore(userId),
    api.getPlan(userId),
  ]);

  const score: RiskScore = scoreResult.status === "fulfilled" ? scoreResult.value : demoScore(userId);
  const plan: ActionPlan = planResult.status === "fulfilled" ? planResult.value : { ...DEMO_PLAN, user_id: userId };
  const profile: UserProfile = DEMO_PROFILES[userId] ?? { user_id: userId, name: "Patient", zip_code: "00000" };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-blue-700 font-bold text-lg">🧭 Compass</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{profile.name}</span>
          <Link
            href={`/chat?userId=${userId}`}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            💬 Chat with Compass
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Patient header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {profile.condition} · ZIP {profile.zip_code} · {profile.utility}
          </p>
        </div>

        {/* 3-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left — Risk score */}
          <div>
            <RiskScoreCard score={score} />
          </div>

          {/* Centre — Action plan */}
          <div>
            <ActionPlanChecklist plan={plan} />
          </div>

          {/* Right — Orgs + subscribers */}
          <div className="space-y-4">
            <OrganisationsPanel profile={profile} />
            <SubscribersPanel profile={profile} />
          </div>
        </div>
      </main>
    </div>
  );
}
