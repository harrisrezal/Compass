import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Fallback demo data if backend is unreachable
const FALLBACK_HAZARDS = {
  psps:       { level: "CRITICAL", label: "Active PSPS Alert",  action: "Use backup power now",   reasoning: "An active public safety power shutoff is confirmed in effect for this address." },
  wildfire:   { level: "HIGH",     label: "Red Flag Warning",   action: "Prepare to evacuate",    reasoning: "NWS Red Flag Warning active with high winds and critically low humidity." },
  flood:      { level: "LOW",      label: "No flood risk",      action: "No action needed",       reasoning: "No flood warnings or watches active for this location." },
  heat:       { level: "HIGH",     label: "Heat Advisory",      action: "Stay indoors",           reasoning: "NWS heat advisory active — heat index reaching 108°F." },
  earthquake: { level: "LOW",      label: "No seismic activity", action: "No action needed",      reasoning: "No earthquakes M2.5+ detected within 50km in the past 24 hours." },
};

const FALLBACK_MAP = {
  user_lat_lng: [36.8034, -119.7195] as [number, number],
  active_overlays: ["psps", "wildfire", "heat"],
  evacuation_route: null,
};

async function fetchHazards(zip: string, medical: boolean) {
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

async function generateActionPlan(
  hazards: Record<string, { level: string; label: string }>,
  profile: { name: string; condition: string; backupHours: number; zip_code: string },
  lastUpdated: string,
) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const hazardLines = Object.entries(hazards)
    .map(([key, h]) => `- ${key.toUpperCase()}: ${h.level} — ${h.label}`)
    .join("\n");

  const backupStr = profile.backupHours > 0 ? `${profile.backupHours}h backup power` : "no backup power";

  const prompt = `You are Guardian Angel.AI, an AI emergency preparedness assistant for medically vulnerable Californians.

Patient profile:
- Name: ${profile.name}
- Condition: ${profile.condition}
- Equipment backup: ${backupStr}
- ZIP: ${profile.zip_code}

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
- Focus on ${profile.condition} and HIGH/CRITICAL hazards
- Reference backup hours and specific condition needs where relevant
- Skip actions for LOW hazards unless they affect the medical condition
- Return only the JSON object, no markdown`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text().trim());
  } catch {
    return null;
  }
}

async function generateHazardInsights(
  hazards: Record<string, { level: string; label: string; reasoning?: string }>,
  profile: { name: string; condition: string; backupHours: number },
) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return {};

  const nonLow = Object.entries(hazards).filter(([, h]) => h.level !== "LOW");
  if (nonLow.length === 0) return {};

  const hazardLines = nonLow
    .map(([key, h]) => `${key.toUpperCase()} (${h.level}): "${h.reasoning ?? h.label}"`)
    .join("\n");

  const backupStr = profile.backupHours > 0 ? `${profile.backupHours}h backup` : "no backup";
  const prompt = `You are Guardian Angel.AI, an AI emergency assistant for medically vulnerable Californians.

Patient: ${profile.name}, condition: ${profile.condition}, backup power: ${backupStr}

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

type HazardEntry = { level: string; label: string; action?: string; reasoning?: string; data_sources?: string[] };

const LEVELS = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;

/** Keep only the top-2 non-LOW hazards; force the rest to LOW. */
function capToTwoActiveHazards(hazards: Record<string, HazardEntry>): Record<string, HazardEntry> {
  const entries = Object.entries(hazards);
  const nonLow = entries
    .filter(([, h]) => h.level !== "LOW")
    .sort(([, a], [, b]) =>
      LEVELS.indexOf(b.level as typeof LEVELS[number]) -
      LEVELS.indexOf(a.level as typeof LEVELS[number])
    );
  const keep = new Set(nonLow.slice(0, 2).map(([k]) => k));
  const result: Record<string, HazardEntry> = {};
  for (const [key, h] of entries) {
    result[key] = keep.has(key) ? h : { ...h, level: "LOW" };
  }
  return result;
}

function randomiseHazards(hazards: Record<string, { level: string }>) {
  const actual: Record<string, string> = {};
  const prediction: Record<string, string> = {};

  for (const [key, h] of Object.entries(hazards)) {
    const idx = LEVELS.indexOf(h.level as typeof LEVELS[number]);
    // Actual: base level, occasionally shift ±1 (30% chance)
    const actualShift = Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    const actualIdx = Math.max(0, Math.min(3, idx + actualShift));
    actual[key] = LEVELS[actualIdx];
    // Prediction: always ≥ actual (forecast is worst-case), shift 0 or +1
    const predShift = Math.floor(Math.random() * 2);
    prediction[key] = LEVELS[Math.min(3, actualIdx + predShift)];
  }
  return { actual, prediction };
}

export async function POST(req: NextRequest) {
  try {
    const { zip, condition, backupHours, name, age } = await req.json();

    const medical = ["oxygen", "ventilator", "dialysis"].includes(condition ?? "");
    const hazardResult = await fetchHazards(zip, medical);
    const hazardData = hazardResult ?? {
      hazards: FALLBACK_HAZARDS,
      map_data: FALLBACK_MAP,
      last_updated: new Date().toISOString(),
    };

    const lastUpdated = hazardData.last_updated ?? new Date().toISOString();
    const profile = { name: name ?? "Patient", condition: condition ?? "other", backupHours: backupHours ?? 0, zip_code: zip ?? "00000", age };

    // Cap to max 2 active hazards; remaining are forced to LOW
    const cappedHazards = capToTwoActiveHazards(hazardData.hazards as Record<string, HazardEntry>);

    const { actual, prediction } = randomiseHazards(cappedHazards);

    // Derive active_overlays from non-LOW hazards so the map always matches
    const activeOverlays = Object.entries(cappedHazards)
      .filter(([, h]) => h.level !== "LOW")
      .map(([k]) => k);
    const mapData = { ...hazardData.map_data, active_overlays: activeOverlays };

    const [plan, insights] = await Promise.all([
      generateActionPlan(cappedHazards, profile, lastUpdated),
      generateHazardInsights(cappedHazards, profile),
    ]);

    return NextResponse.json({
      hazards: cappedHazards,
      map_data: mapData,
      lastUpdated,
      plan,
      insights,
      actual,
      prediction,
    });
  } catch {
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}
