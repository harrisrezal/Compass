"use client";

import type { Condition, UserProfileCreate } from "@/lib/types";

interface Props {
  data: Partial<UserProfileCreate>;
  onChange: (updates: Partial<UserProfileCreate>) => void;
}

const CONDITIONS: { value: Condition; label: string; icon: string; crisis: string }[] = [
  { value: "oxygen",         label: "Home oxygen",        icon: "🫁", crisis: "4–8 hrs" },
  { value: "ventilator",     label: "Ventilator / BiPAP", icon: "🩺", crisis: "Minutes" },
  { value: "dialysis",       label: "Dialysis",           icon: "💉", crisis: "48–72 hrs" },
  { value: "wheelchair",     label: "Power wheelchair",   icon: "♿", crisis: "8–16 hrs" },
  { value: "heat_vulnerable",label: "Heat vulnerable",    icon: "🌡️", crisis: "4–8 hrs" },
  { value: "insulin_dependent", label: "Insulin dependent", icon: "💊", crisis: "Hours" },
  { value: "other",          label: "Other",              icon: "🏥", crisis: "Varies" },
];

export default function StepCondition({ data, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Medical condition</h2>
        <p className="text-slate-500 mt-1">
          Select the primary condition that requires electricity to manage.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONDITIONS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange({ condition: c.value })}
            className={`border-2 rounded-xl p-4 text-left transition ${
              data.condition === c.value
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <span className="text-2xl">{c.icon}</span>
            <div className="font-medium text-slate-900 mt-1">{c.label}</div>
            <div className="text-xs text-slate-500">Crisis window: {c.crisis}</div>
          </button>
        ))}
      </div>

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
