import { VertexAI } from "@google-cloud/vertexai";
import { NextRequest, NextResponse } from "next/server";

const PURPOSE_PROMPTS: Record<string, string> = {
  welfare_check: `You are placing a friendly routine welfare check call. Tone: warm, conversational, unhurried.
Cover: (1) greet and check how they are feeling, (2) briefly mention the current risk level and what it means for them, (3) remind them of their nearest support organisations, (4) ask if they want you to connect them to 911.`,

  risk_alert: `You are placing an urgent risk alert call. Tone: calm but direct — this is serious.
Cover: (1) state their risk score and the primary threat clearly, (2) give exactly 3 numbered action steps tailored to their condition and equipment, (3) name their connected organisations with contact details, (4) ask if they want you to connect them to 911 right now.`,

  evacuation_warning: `You are placing an emergency evacuation warning call. Tone: urgent, clear, directive.
Cover: (1) state there is an active emergency (Red Flag / PSPS / flood warning), (2) instruct them to prepare to leave now and what to bring (equipment, medications), (3) give the address of their nearest shelter or cooling centre by name, (4) tell them their equipment supplier's emergency line, (5) ask if they want you to connect them to 911 immediately.`,
};

export async function POST(req: NextRequest) {
  const { purpose, customNote, patient, score } = await req.json();

  const project = process.env.GCP_PROJECT_ID?.trim();
  if (!project) {
    return NextResponse.json({ error: "GCP_PROJECT_ID not configured" }, { status: 500 });
  }

  const purposePrompt = PURPOSE_PROMPTS[purpose];
  if (!purposePrompt) {
    return NextResponse.json({ error: "Invalid call purpose" }, { status: 400 });
  }

  const eq = patient.equipment ?? {};
  const nr = patient.nearest_resources ?? {};
  const meds = (patient.medications ?? []).map((m: { name?: string }) => m.name).join(", ") || "None";

  const systemPrompt = `You are Compass, an AI emergency preparedness agent. You are calling ${patient.name} directly.
${purposePrompt}

## Patient context
- Name: ${patient.name} (address them by first name only)
- Age: ${patient.age ?? "unknown"}
- Condition: ${patient.condition}
- Equipment: ${eq.type ?? "unknown"} drawing ${eq.power_watts ?? "?"}W
- Medications: ${meds}
- Can self-evacuate: ${patient.can_self_evacuate ? "Yes" : "No — needs assistance"}

## Current risk
- Risk score: ${score?.composite_score ?? "unknown"}/100
- Level: ${score?.risk_level ?? "unknown"}
- Primary threat: ${score?.primary_threat ?? "unknown"}
- Hours to action: ${score?.hours_to_action ?? "unknown"}

## Connected organisations
- Hospital: ${nr.hospital_name ?? "unknown"} (${nr.hospital_miles ?? "?"}mi away)
- Cooling centre: ${nr.cooling_center ?? "unknown"}
- Equipment supplier: ${eq.supplier_name ?? "unknown"} — ${eq.supplier_phone ?? "contact your provider"}
- Pharmacy: ${nr.pharmacy_name ?? "unknown"}

${customNote ? `## Additional instruction from caregiver\n${customNote}` : ""}

## Rules
- Speak naturally as if on a phone call — no markdown, no bullet points in the output
- Keep the script under 200 words
- End by asking: "Would you like me to connect you to 911 emergency services right now?"
- Do NOT include stage directions or labels like "Agent:" — just the spoken words`;

  try {
    const vertexAI = new VertexAI({ project, location: "us-central1" });
    const model = vertexAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

    const result = await model.generateContent({
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: "Generate the call script now." }] }],
    });

    const script = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "Unable to generate script.";
    return NextResponse.json({ script });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Vertex AI error:", message);
    return NextResponse.json({ error: `Script generation failed: ${message}` }, { status: 500 });
  }
}
