import Link from "next/link";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { UserProfile, ActionPlan, ActionItem } from "@/lib/types";
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
  last_updated?: string;
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

interface GeminiPlan {
  summary: string;
  items: Array<{ action: string; detail: string }>;
}

async function generateHazardInsights(
  hazards: Record<string, { level: string; label: string; reasoning?: string }>,
  profile: UserProfile,
): Promise<Record<string, string>> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return {};

  const nonLow = Object.entries(hazards).filter(([, h]) => h.level !== "LOW");
  if (nonLow.length === 0) return {};

  const eq = profile.equipment ?? {};
  const hazardLines = nonLow
    .map(([key, h]) => `${key.toUpperCase()} (${h.level}): "${h.reasoning ?? h.label}"`)
    .join("\n");

  const prompt = `You are Compass, an AI emergency assistant for medically vulnerable Californians.

Patient: ${profile.name}, condition: ${profile.condition ?? "unknown"}, equipment: ${eq.type ?? "none"}

For each active hazard below, rewrite the technical reasoning as ONE plain-English sentence that explains the risk to this specific patient. Be direct and patient-focused.

${hazardLines}

Return ONLY valid JSON with hazard keys in lowercase: ${JSON.stringify(Object.fromEntries(nonLow.map(([k]) => [k, "..."])))}`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().trim()) as Record<string, string>;
  } catch {
    return {};
  }
}

async function generateActionPlan(
  hazards: Record<string, { level: string; label: string }>,
  profile: UserProfile,
  lastUpdated: string,
): Promise<GeminiPlan | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const hazardLines = Object.entries(hazards)
    .map(([key, h]) => `- ${key.toUpperCase()}: ${h.level} — ${h.label}`)
    .join("\n");

  const eq = profile.equipment ?? {};
  const backupHours = eq.backup_hours != null ? `${eq.backup_hours}h backup` : "no backup specified";

  const prompt = `You are Compass, an AI emergency preparedness assistant for medically vulnerable Californians.

Patient profile:
- Name: ${profile.name}
- Condition: ${profile.condition ?? "unknown"}
- Equipment: ${eq.type ?? "none"} (${backupHours})
- ZIP: ${profile.zip_code}
- Utility: ${profile.utility ?? "unknown"}

Current hazard status (as of ${lastUpdated}):
${hazardLines}

Generate a personalised emergency action plan. Return ONLY valid JSON:
{
  "summary": "2–3 sentence plain-English overview of the current risk and the single most important thing this patient must do given their medical condition",
  "items": [
    { "action": "Short action title", "detail": "One specific sentence tailored to this patient's condition and equipment" }
  ]
}

Rules:
- 5–8 items ordered by urgency
- Focus on ${profile.condition ?? "the patient's condition"} and HIGH/CRITICAL hazards
- Reference specific equipment, backup hours, nearest hospital where relevant
- Skip actions for LOW hazards unless they affect the medical condition
- Return only the JSON object, no markdown`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().trim()) as GeminiPlan;
  } catch {
    return null;
  }
}

export default async function DashboardPage({ params }: Props) {
  const { userId } = await params;

  const profile: UserProfile = DEMO_PROFILES[userId] ?? { user_id: userId, name: "Patient", zip_code: "00000" };
  const medical = ["oxygen", "ventilator", "dialysis"].includes(profile.condition ?? "");

  const hazardResult = await fetchHazards(profile.zip_code, medical);
  const hazardData: HazardResponse =
    hazardResult ?? (DEMO_HAZARDS[userId] ?? DEMO_HAZARDS["demo-user-margaret-001"]);

  // Generate Gemini outputs in parallel
  const lastUpdated = hazardData.last_updated ?? new Date().toISOString();
  const [geminiPlan, hazardInsights] = await Promise.all([
    generateActionPlan(hazardData.hazards, profile, lastUpdated),
    generateHazardInsights(hazardData.hazards, profile),
  ]);

  // Build ActionPlan from Gemini output (or fall back to static demo plan)
  const plan: ActionPlan = geminiPlan
    ? {
        plan_id: "gemini",
        user_id: userId,
        generated_at: lastUpdated,
        action_items: geminiPlan.items.map((item, i): ActionItem => ({
          order: i + 1,
          action: item.action,
          detail: item.detail,
          completed: false,
        })),
      }
    : { ...DEMO_PLAN, user_id: userId };

  const hazardLevels = Object.fromEntries(
    Object.entries(hazardData.hazards).map(([k, v]) => [k, v.level])
  ) as Record<string, HazardLevel>;

  // Derive overall risk level from the worst individual hazard
  const LEVEL_ORDER = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;
  const overallLevel = Object.values(hazardLevels).reduce<string>(
    (worst, lvl) => LEVEL_ORDER.indexOf(lvl as typeof LEVEL_ORDER[number]) > LEVEL_ORDER.indexOf(worst as typeof LEVEL_ORDER[number]) ? lvl : worst,
    "LOW"
  );
  const criticalCount = Object.values(hazardLevels).filter(l => l === "CRITICAL").length;
  const highCount     = Object.values(hazardLevels).filter(l => l === "HIGH").length;
  const activeThreats = criticalCount + highCount;

  const RISK_BADGE: Record<string, { dot: string; badge: string; label: string; desc: string }> = {
    LOW:      { dot: "bg-green-500",  badge: "bg-green-100 text-green-700 border border-green-200",   label: "All Clear",  desc: "All hazards at low risk" },
    MODERATE: { dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border border-yellow-200", label: "Monitor",    desc: "Some hazards need monitoring" },
    HIGH:     { dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border border-red-300",          label: "High Risk",  desc: `${activeThreats} hazard${activeThreats !== 1 ? "s" : ""} require attention` },
    CRITICAL: { dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border border-red-300",          label: "High Risk",  desc: `${activeThreats} active threat${activeThreats !== 1 ? "s" : ""} — act now` },
  };
  const risk = RISK_BADGE[overallLevel] ?? RISK_BADGE["LOW"];

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {profile.condition} · ZIP {profile.zip_code} · {profile.utility}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${risk.badge}`}>
              <span className={`w-2 h-2 rounded-full ${risk.dot} animate-pulse`} />
              {risk.label}
            </span>
            <span className="text-xs text-slate-500">{risk.desc}</span>
          </div>
        </div>

        {/* Hazard status cards — full width */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Hazard Status</h2>
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full font-medium">
              🛡️ Monitoring next 72 hours
            </span>
          </div>
          <HazardStatusGrid hazards={hazardData.hazards} lastUpdated={lastUpdated} hazardInsights={hazardInsights} />
        </div>

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
            <ActionPlanChecklist plan={plan} summary={geminiPlan?.summary} />
          </div>
        </div>
      </main>
    </div>
  );
}
