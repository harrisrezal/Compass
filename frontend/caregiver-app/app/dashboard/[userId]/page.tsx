import Link from "next/link";
import { api } from "@/lib/api";
import type { UserProfile, ActionPlan } from "@/lib/types";
import ActionPlanChecklist from "@/components/dashboard/ActionPlanChecklist";
import OrganisationsPanel from "@/components/dashboard/OrganisationsPanel";
import SubscribersPanel from "@/components/dashboard/SubscribersPanel";
import CallButton from "@/components/dashboard/CallButton";
import HazardStatusGrid from "@/components/dashboard/HazardStatusGrid";
import HazardMap from "@/components/hazards/HazardMap";

interface Props {
  params: Promise<{ userId: string }>;
}

type HazardLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

interface HazardSummary {
  level: HazardLevel;
  label: string;
  action: string;
}

interface HazardMapData {
  user_lat_lng: [number, number];
  active_overlays: string[];
  evacuation_route?: { trigger: string } | null;
  nearby_resources?: Array<{ name: string; type: string; lat: number; lng: number }>;
}

interface HazardResponse {
  hazards: Record<string, HazardSummary>;
  map_data: HazardMapData;
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

const DEMO_HAZARDS: Record<string, HazardResponse> = {
  "demo-user-margaret-001": {
    hazards: {
      psps:       { level: "CRITICAL", label: "PSPS Alert",        action: "Charge backup immediately" },
      wildfire:   { level: "HIGH",     label: "Red Flag Warning",   action: "Prepare to evacuate" },
      flood:      { level: "LOW",      label: "No flood risk",      action: "No action needed" },
      heat:       { level: "HIGH",     label: "Heat Advisory",      action: "Stay indoors" },
      earthquake: { level: "LOW",      label: "Normal seismic",     action: "No action needed" },
    },
    map_data: { user_lat_lng: [36.8034, -119.7195], active_overlays: ["psps", "wildfire", "heat"], evacuation_route: null },
  },
  "demo-user-james-002": {
    hazards: {
      psps:       { level: "HIGH",     label: "PSPS Risk",          action: "Activate generator plan" },
      wildfire:   { level: "CRITICAL", label: "Active Fire Nearby", action: "Evacuate now" },
      flood:      { level: "LOW",      label: "No flood risk",      action: "No action needed" },
      heat:       { level: "MODERATE", label: "Warm conditions",    action: "Monitor temperature" },
      earthquake: { level: "LOW",      label: "Normal seismic",     action: "No action needed" },
    },
    map_data: { user_lat_lng: [39.7596, -121.6219], active_overlays: ["psps", "wildfire", "heat"], evacuation_route: { trigger: "wildfire" } },
  },
  "demo-user-dorothy-003": {
    hazards: {
      psps:       { level: "LOW",      label: "No PSPS risk",       action: "No action needed" },
      wildfire:   { level: "LOW",      label: "No wildfire risk",   action: "No action needed" },
      flood:      { level: "MODERATE", label: "Flood Watch",        action: "Monitor alerts" },
      heat:       { level: "HIGH",     label: "Excessive Heat",     action: "Go to cooling center" },
      earthquake: { level: "MODERATE", label: "Seismic Zone",       action: "Secure heavy furniture" },
    },
    map_data: { user_lat_lng: [34.0211, -118.4001], active_overlays: ["flood", "heat", "earthquake"], evacuation_route: null },
  },
};

const DEMO_PLAN: ActionPlan = {
  plan_id: "demo",
  user_id: "",
  generated_at: new Date().toISOString(),
  risk_level: "CRITICAL",
  primary_threat: "grid",
  action_items: [
    { order: 1, urgency: "NOW",          action: "Charge backup battery",         detail: "Plug in your oxygen concentrator battery pack immediately — you have 4 hours of backup.",    completed: false },
    { order: 2, urgency: "NOW",          action: "Call AeroCare Medical",          detail: "Notify your supplier (1-800-232-7263) that a PSPS event is expected in your ZIP.",           completed: false },
    { order: 3, urgency: "TODAY",        action: "Pick up medications",            detail: "Collect a 7-day supply from CVS Pharmacy before the outage window.",                          completed: false },
    { order: 4, urgency: "BEFORE_EVENT", action: "Pre-position at hospital",       detail: "Fresno Community Hospital (1.8 miles) has backup power — consider relocating before 4PM.",  completed: false },
    { order: 5, urgency: "BEFORE_EVENT", action: "Alert caregiver",                detail: "Maria Rodriguez has been notified. Confirm she can reach you within 30 minutes.",             completed: true  },
    { order: 6, urgency: "DURING",       action: "Conserve oxygen supply",         detail: "Reduce activity level to extend backup battery life. Stay seated and calm.",                 completed: false },
    { order: 7, urgency: "DURING",       action: "Call 211 if battery below 1h",   detail: "211 California can coordinate emergency power for medical equipment.",                        completed: false },
  ],
};

async function fetchHazards(zip: string, medical: boolean): Promise<HazardResponse | null> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(
      `${base}/hazards?address=${encodeURIComponent(zip)}&simulate=true&medical=${medical}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DashboardPage({ params }: Props) {
  const { userId } = await params;

  const profile: UserProfile = DEMO_PROFILES[userId] ?? { user_id: userId, name: "Patient", zip_code: "00000" };
  const medical = ["oxygen", "ventilator", "dialysis"].includes(profile.condition ?? "");

  const [planResult, hazardResult] = await Promise.allSettled([
    api.getPlan(userId),
    fetchHazards(profile.zip_code, medical),
  ]);

  const plan: ActionPlan = planResult.status === "fulfilled" ? planResult.value : { ...DEMO_PLAN, user_id: userId };
  const hazardData: HazardResponse =
    (hazardResult.status === "fulfilled" && hazardResult.value)
      ? hazardResult.value
      : (DEMO_HAZARDS[userId] ?? DEMO_HAZARDS["demo-user-margaret-001"]);

  const hazardLevels = Object.fromEntries(
    Object.entries(hazardData.hazards).map(([k, v]) => [k, v.level])
  ) as Record<string, HazardLevel>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-blue-700 font-bold text-lg">🧭 Compass</Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{profile.name}</span>
          <CallButton
            patient={profile as unknown as Record<string, unknown>}
            score={{} as unknown as Record<string, unknown>}
          />
          <Link
            href={`/chat?userId=${userId}`}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            💬 Chat with Compass
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Patient header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {profile.condition} · ZIP {profile.zip_code} · {profile.utility}
          </p>
        </div>

        {/* Hazard status cards — full width */}
        <HazardStatusGrid hazards={hazardData.hazards} />

        {/* Map + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <HazardMap mapData={hazardData.map_data} hazardLevels={hazardLevels} />
          </div>
          <div className="space-y-4">
            <OrganisationsPanel profile={profile} />
            <SubscribersPanel profile={profile} />
          </div>
        </div>

        {/* Action plan */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ActionPlanChecklist plan={plan} />
          </div>
        </div>
      </main>
    </div>
  );
}
