"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Condition, ContactChannel, UserProfileCreate } from "@/lib/types";

// ── helpers ────────────────────────────────────────────────────────────────

function generateUserCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CM-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── constants ──────────────────────────────────────────────────────────────

const CONDITIONS: { value: Condition; label: string; icon: string }[] = [
  { value: "oxygen",            label: "Home oxygen",        icon: "🫁" },
  { value: "ventilator",        label: "Ventilator / BiPAP", icon: "🩺" },
  { value: "dialysis",          label: "Dialysis",           icon: "💉" },
  { value: "wheelchair",        label: "Power wheelchair",   icon: "♿" },
  { value: "heat_vulnerable",   label: "Heat vulnerable",    icon: "🌡️" },
  { value: "insulin_dependent", label: "Insulin dependent",  icon: "💊" },
  { value: "other",             label: "Other",              icon: "🏥" },
];

const CHANNELS: { value: ContactChannel; label: string }[] = [
  { value: "telegram",  label: "Telegram" },
  { value: "whatsapp",  label: "WhatsApp" },
  { value: "wechat",    label: "WeChat" },
  { value: "sms",       label: "SMS" },
];

// ── page ───────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  // form state
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");
  const [condition, setCondition] = useState<Condition | undefined>();
  const [otherCondition, setOtherCondition] = useState("");
  const [canEvacuate, setCanEvacuate] = useState(true);
  const [cgName, setCgName] = useState("");
  const [cgRel, setCgRel] = useState("");
  const [cgPhone, setCgPhone] = useState("");
  const [cgChannel, setCgChannel] = useState<ContactChannel>("sms");

  // submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("Please enter the patient's name.");
    if (!zip.trim()) return setError("Please enter a ZIP code.");
    if (!condition) return setError("Please select a medical condition.");
    if (condition === "other" && !otherCondition.trim())
      return setError("Please describe the condition.");

    const userCode = generateUserCode();

    const payload: UserProfileCreate = {
      user_id: userCode,
      name: name.trim(),
      zip_code: zip.trim(),
      condition,
      other_condition: condition === "other" ? otherCondition.trim() : undefined,
      can_self_evacuate: canEvacuate,
      caregiver: {
        name: cgName.trim() || undefined,
        relationship: cgRel.trim() || undefined,
        phone: cgPhone.trim() || undefined,
        contact_channel: cgChannel,
      },
    };

    setSubmitting(true);
    try {
      await api.createUser(payload);
      setSuccessCode(userCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── success screen ──────────────────────────────────────────────────────

  if (successCode) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center py-10 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl mx-auto">✅</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Patient registered!</h2>
            <p className="text-slate-500 mt-1 text-sm">Share this code with your local organisation so they can monitor {name}.</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-5">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">User code</p>
            <p className="text-4xl font-bold font-mono text-blue-700 tracking-widest">{successCode}</p>
          </div>
          <button
            onClick={() => router.push(`/dashboard/${successCode}`)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ── form ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-xl">

        {/* Header */}
        <div className="flex items-center gap-2 mb-8 text-blue-700 font-bold text-lg">
          🧭 Compass
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">

            <div>
              <h1 className="text-2xl font-bold text-slate-900">Register a patient</h1>
              <p className="text-slate-500 mt-1 text-sm">Takes about 1 minute · Your data is private</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {/* ── Patient details ── */}
            <section className="space-y-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Patient details</h2>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Margaret"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ZIP code</label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="e.g. 93720"
                  maxLength={10}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </section>

            {/* ── Medical condition ── */}
            <section className="space-y-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Medical condition</h2>
              <p className="text-sm text-slate-500 -mt-2">Select the primary condition that best fits the patient.</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CONDITIONS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => { setCondition(c.value); setOtherCondition(""); }}
                    className={`border-2 rounded-xl p-3 text-left transition ${
                      condition === c.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-xl">{c.icon}</span>
                    <div className="font-medium text-slate-900 text-sm mt-1">{c.label}</div>
                  </button>
                ))}
              </div>

              {condition === "other" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Please describe the condition <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={otherCondition}
                    onChange={(e) => setOtherCondition(e.target.value)}
                    placeholder="e.g. ALS, spinal cord injury…"
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canEvacuate}
                  onChange={(e) => setCanEvacuate(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span className="text-sm text-slate-700">Patient can self-evacuate without assistance</span>
              </label>
            </section>

            {/* ── Main contact ── */}
            <section className="space-y-4">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Main contact</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contact name</label>
                  <input
                    type="text"
                    value={cgName}
                    onChange={(e) => setCgName(e.target.value)}
                    placeholder="Maria Rodriguez"
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Relationship</label>
                  <input
                    type="text"
                    value={cgRel}
                    onChange={(e) => setCgRel(e.target.value)}
                    placeholder="Daughter"
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Phone number
                </label>
                <input
                  type="tel"
                  value={cgPhone}
                  onChange={(e) => setCgPhone(e.target.value)}
                  placeholder="+14155550182"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  ℹ️ Used for call alerts if the patient doesn&apos;t respond to automated notifications.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Preferred contact channel</label>
                <select
                  value={cgChannel}
                  onChange={(e) => setCgChannel(e.target.value as ContactChannel)}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {CHANNELS.map((ch) => (
                    <option key={ch.value} value={ch.value}>{ch.label}</option>
                  ))}
                </select>
              </div>
            </section>

          </div>

          {/* Submit */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition text-sm"
            >
              {submitting ? "Registering…" : "Register & Get Code →"}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
