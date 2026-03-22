import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { patient, score, caregiver } = await req.json();

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const eq = patient.equipment ?? {};
  const nr = patient.nearest_resources ?? {};

  const THREAT_LABELS: Record<string, string> = {
    grid: "power grid outage",
    heat: "extreme heat event",
    wildfire: "wildfire and smoke",
    flood: "flooding",
    none: "environmental hazard",
  };
  const threatLabel = THREAT_LABELS[score?.primary_threat ?? "none"] ?? "environmental hazard";

  const systemPrompt = `You are Compass, an AI emergency preparedness assistant. You are making an urgent outbound call to ${caregiver.name}, the registered emergency contact for ${patient.name}.

## Situation
${patient.name} has NOT responded to an automated risk alert sent by Compass. Their current risk score is ${score?.composite_score ?? "unknown"}/100 (${score?.risk_level ?? "unknown"}) due to an upcoming ${threatLabel} in their area (ZIP ${patient.zip_code}).

## Your goal
Inform the caregiver clearly and calmly about:
1. That ${patient.name} has not responded to the alert
2. The nature and urgency of the upcoming ${threatLabel} — estimated ${score?.hours_to_action ?? "unknown"} hours until action is needed
3. Why this is specifically dangerous for ${patient.name} given their condition (${patient.condition}) and equipment (${eq.type ?? "unknown"})
4. Two immediate actions the caregiver should take right now
5. Key contacts: ${nr.hospital_name ?? "nearest hospital"} (${nr.hospital_miles ?? "?"}mi) and equipment supplier ${eq.supplier_name ?? "their supplier"} at ${eq.supplier_phone ?? "their listed number"}

## Script rules
- Open with: "Hi ${caregiver.name}, this is Compass, ${patient.name}'s emergency preparedness assistant."
- Speak naturally — no markdown, no bullet points, no stage directions
- Keep under 200 words
- End by asking: "Would you like me to connect you to 911 emergency services right now?"`;

  try {
    const genai = new GoogleGenerativeAI(apiKey);
    const model = genai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent("Generate the call script now.");
    const script = result.response.text();
    return NextResponse.json({ script });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Gemini error:", message);
    return NextResponse.json({ error: `Script generation failed: ${message}` }, { status: 500 });
  }
}
