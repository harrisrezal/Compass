import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { hazards, profile, lastUpdated } = await req.json();

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const hazardLines = Object.entries(hazards as Record<string, { level: string; label: string }>)
    .map(([key, h]) => `- ${key.toUpperCase()}: ${h.level} — ${h.label}`)
    .join("\n");

  const eq = profile.equipment ?? {};
  const condition = profile.condition ?? "unknown";
  const backupHours = eq.backup_hours != null ? `${eq.backup_hours}h backup` : "no backup specified";

  const prompt = `You are Compass, an AI emergency preparedness assistant for medically vulnerable Californians.

Patient profile:
- Name: ${profile.name ?? "Patient"}
- Condition: ${condition}
- Equipment: ${eq.type ?? "none"} (${backupHours})
- ZIP: ${profile.zip_code}
- Utility: ${profile.utility ?? "unknown"}

Current hazard status (as of ${lastUpdated ?? "now"}):
${hazardLines}

Generate a personalised emergency action plan. Return ONLY valid JSON with this exact shape:
{
  "summary": "2–3 sentence plain-English overview of the current risk level and the single most important thing this patient must do given their medical condition",
  "items": [
    { "action": "Short action title", "detail": "One sentence of specific, actionable detail tailored to this patient's condition and equipment" }
  ]
}

Rules:
- 5–8 items, ordered by urgency
- Focus on actions relevant to ${condition} and current HIGH/CRITICAL hazards
- Be specific: reference the patient's equipment, backup hours, nearest hospital if relevant
- Items for LOW hazards should be omitted unless they directly affect the medical condition
- No markdown, no code fences, no extra text — just the JSON object`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = JSON.parse(text);
    return NextResponse.json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Action plan generation failed:", message);
    return NextResponse.json({ error: `Generation failed: ${message}` }, { status: 500 });
  }
}
