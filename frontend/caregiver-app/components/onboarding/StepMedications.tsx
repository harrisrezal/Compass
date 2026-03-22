"use client";

import type { Medication, UserProfileCreate } from "@/lib/types";

interface Props {
  data: Partial<UserProfileCreate>;
  onChange: (updates: Partial<UserProfileCreate>) => void;
}

const EMPTY_MED: Medication = {
  name: "",
  requires_refrigeration: false,
  heat_sensitive: false,
  beta_blocker: false,
};

export default function StepMedications({ data, onChange }: Props) {
  const meds = data.medications ?? [];

  const update = (i: number, patch: Partial<Medication>) => {
    const updated = meds.map((m, idx) => (idx === i ? { ...m, ...patch } : m));
    onChange({ medications: updated });
  };

  const add = () => onChange({ medications: [...meds, { ...EMPTY_MED }] });

  const remove = (i: number) =>
    onChange({ medications: meds.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Medications</h2>
        <p className="text-slate-500 mt-1">
          Add medications that may be affected by power loss or heat.
        </p>
      </div>

      <div className="space-y-3">
        {meds.map((med, i) => (
          <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex gap-3 items-start">
              <input
                type="text"
                value={med.name ?? ""}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder="Medication name"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-slate-400 hover:text-red-500 transition text-lg leading-none pt-1"
              >
                ×
              </button>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["requires_refrigeration", "Requires refrigeration"],
                  ["heat_sensitive", "Heat sensitive"],
                  ["beta_blocker", "Beta blocker (impairs heat response)"],
                ] as [keyof Medication, string][]
              ).map(([field, label]) => (
                <label key={field} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!(med[field])}
                    onChange={(e) => update(i, { [field]: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-slate-600">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl py-3 text-slate-500 hover:text-blue-600 transition text-sm font-medium"
      >
        + Add medication
      </button>

      {meds.length === 0 && (
        <p className="text-slate-400 text-sm text-center">No medications added — skip if not applicable.</p>
      )}
    </div>
  );
}
