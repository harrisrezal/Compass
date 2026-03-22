"use client";

import type { Condition, UserProfileCreate } from "@/lib/types";

interface Props {
  data: Partial<UserProfileCreate>;
  onChange: (updates: Partial<UserProfileCreate>) => void;
}

const CONDITIONS: { value: Condition; label: string; icon: string }[] = [
  { value: "oxygen",            label: "Home oxygen",        icon: "🫁" },
  { value: "ventilator",        label: "Ventilator / BiPAP", icon: "🩺" },
  { value: "dialysis",          label: "Dialysis",           icon: "💉" },
  { value: "wheelchair",        label: "Power wheelchair",   icon: "♿" },
  { value: "heat_vulnerable",   label: "Heat vulnerable",    icon: "🌡️" },
  { value: "insulin_dependent", label: "Insulin dependent",  icon: "💊" },
  { value: "other",             label: "Other",              icon: "🏥" },
];

export default function StepCondition({ data, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Medical condition</h2>
        <p className="text-slate-500 mt-1">
          Select the primary condition that best fits the client.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONDITIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange({ condition: c.value, other_condition: undefined })}
            className={`border-2 rounded-xl p-4 text-left transition ${
              data.condition === c.value
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="text-2xl">{c.icon}</span>
            <div className="font-medium text-slate-900 mt-1">{c.label}</div>
          </button>
        ))}
      </div>

      {data.condition === "other" && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Please describe the condition <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.other_condition ?? ""}
            onChange={(e) => onChange({ other_condition: e.target.value })}
            placeholder="e.g. ALS, muscular dystrophy, spinal cord injury…"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <input
          type="checkbox"
          id="can_evacuate"
          checked={data.can_self_evacuate ?? true}
          onChange={(e) => onChange({ can_self_evacuate: e.target.checked })}
          className="w-4 h-4 rounded text-blue-600"
        />
        <label htmlFor="can_evacuate" className="text-sm text-slate-700">
          Patient can self-evacuate without assistance
        </label>
      </div>
    </div>
  );
}
