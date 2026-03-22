"use client";

import type { NotifyThreshold, UserProfileCreate } from "@/lib/types";

interface Props {
  data: Partial<UserProfileCreate>;
  onChange: (updates: Partial<UserProfileCreate>) => void;
  mode: "caregiver" | "self";
}

const THRESHOLDS: { value: NotifyThreshold; label: string; desc: string }[] = [
  { value: "ELEVATED", label: "Elevated (60+)",  desc: "Notify early — best for hands-on caregivers" },
  { value: "HIGH",     label: "High (80+)",      desc: "Notify when situation is serious" },
  { value: "CRITICAL", label: "Critical (95+)",  desc: "Notify only in emergencies" },
];

export default function StepCaregiverDetails({ data, onChange, mode }: Props) {
  const cg = data.caregiver ?? {};
  const update = (field: string, value: string) =>
    onChange({ caregiver: { ...cg, [field]: value } });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {mode === "caregiver" ? "Your contact details" : "Emergency contact"}
        </h2>
        <p className="text-slate-500 mt-1">
          {mode === "caregiver"
            ? "You'll receive alerts when the patient's risk crosses the threshold you set."
            : "Who should be notified if your risk score rises?"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
          <input
            type="text"
            value={cg.name ?? ""}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Maria Rodriguez"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Relationship</label>
          <input
            type="text"
            value={cg.relationship ?? ""}
            onChange={(e) => update("relationship", e.target.value)}
            placeholder="Daughter"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone number</label>
          <input
            type="tel"
            value={cg.phone ?? ""}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+14155550182"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
          <input
            type="email"
            value={cg.email ?? ""}
            onChange={(e) => update("email", e.target.value)}
            placeholder="maria@email.com"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Alert threshold</label>
        <div className="space-y-2">
          {THRESHOLDS.map((t) => (
            <label
              key={t.value}
              className={`flex items-start gap-3 border-2 rounded-xl px-4 py-3 cursor-pointer transition ${
                cg.notify_threshold === t.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="threshold"
                value={t.value}
                checked={cg.notify_threshold === t.value}
                onChange={() => update("notify_threshold", t.value)}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-slate-900 text-sm">{t.label}</div>
                <div className="text-xs text-slate-500">{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
