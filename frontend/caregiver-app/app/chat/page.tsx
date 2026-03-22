import Link from "next/link";
import { api } from "@/lib/api";
import ChatInterface from "@/components/chat/ChatInterface";

interface Props {
  searchParams: Promise<{ userId?: string }>;
}

// Build a rich system prompt from patient context
function buildSystemPrompt(profile: Record<string, unknown>, score: Record<string, unknown> | null): string {
  const eq = profile.equipment as Record<string, unknown> | undefined;
  const nr = profile.nearest_resources as Record<string, unknown> | undefined;
  const meds = (profile.medications as Array<Record<string, unknown>> | undefined) ?? [];

  return `You are Guardian Angel.AI, an AI emergency preparedness advisor for medically vulnerable Californians.
You are speaking directly with the caregiver or patient of the following person.

## Patient
- Name: ${profile.name}
- Age: ${profile.age}
- Condition: ${profile.condition}
- Equipment: ${eq?.type ?? "unknown"} (${eq?.power_watts ?? "?"}W, ${eq?.backup_hours ?? 0}h backup)
- Medications: ${meds.map((m) => m.name).join(", ") || "None listed"}
- Can self-evacuate: ${profile.can_self_evacuate ? "Yes" : "No"}

## Current Risk
- Score: ${score?.composite_score ?? "unknown"}/100
- Level: ${score?.risk_level ?? "unknown"}
- Primary threat: ${score?.primary_threat ?? "unknown"}
- Hours to action: ${score?.hours_to_action ?? "unknown"}
- Red Flag Warning: ${score?.has_red_flag_warning ? "YES" : "No"}
- PSPS active: ${score?.active_psps ? "YES" : "No"}

## Nearest Resources
- Hospital: ${nr?.hospital_name ?? "unknown"} (${nr?.hospital_miles ?? "?"}mi)
- Cooling center: ${nr?.cooling_center ?? "unknown"}
- Pharmacy: ${nr?.pharmacy_name ?? "unknown"}

## Your role
- Be direct, calm, and specific. This may be an emergency.
- Reference the patient's actual equipment, backup hours, and nearby resources by name.
- Give numbered steps when asked what to do.
- If the situation sounds life-threatening, tell them to call 911 first.
- Keep responses concise — under 150 words unless more detail is needed.
`;
}

export default async function ChatPage({ searchParams }: Props) {
  const { userId } = await searchParams;

  // Try to fetch live score for context — silently ignore if unavailable
  let score = null;
  if (userId) {
    try { score = await api.getScore(userId); } catch { /* no score yet */ }
  }

  // Demo profile fallback
  const profile = {
    name: "Margaret Rodriguez",
    age: 74,
    condition: "oxygen",
    equipment: { type: "Oxygen concentrator (5L/min)", power_watts: 300, backup_hours: 4 },
    medications: [{ name: "Albuterol inhaler" }, { name: "Prednisone" }],
    can_self_evacuate: false,
    nearest_resources: {
      hospital_name: "Fresno Community Hospital",
      hospital_miles: 1.8,
      cooling_center: "Fresno City Hall",
      pharmacy_name: "CVS Pharmacy",
    },
  };

  const systemPrompt = buildSystemPrompt(profile, score as Record<string, unknown> | null);
  const patientName = String(profile.name);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <Link href="/" className="text-blue-700 font-bold text-lg">🛡️ Guardian Angel.AI</Link>
        {userId && (
          <Link
            href={`/dashboard/${userId}`}
            className="text-sm text-slate-500 hover:text-slate-700 transition"
          >
            ← Back to dashboard
          </Link>
        )}
      </header>

      {/* Chat title */}
      <div className="bg-white border-b border-slate-100 px-6 py-3 flex-shrink-0">
        <p className="text-sm font-medium text-slate-700">
          Guardian Angel.AI · {patientName}
        </p>
        <p className="text-xs text-slate-400">
          Ask about risks, actions, equipment, or emergency resources
        </p>
      </div>

      {/* Chat — fills remaining height */}
      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto bg-slate-50 min-h-0">
        <ChatInterface systemPrompt={systemPrompt} patientName={patientName} />
      </div>
    </div>
  );
}
