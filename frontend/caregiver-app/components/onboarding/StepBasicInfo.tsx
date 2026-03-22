"use client";

import type { UserProfileCreate } from "@/lib/types";

interface Props {
  data: Partial<UserProfileCreate>;
  onChange: (updates: Partial<UserProfileCreate>) => void;
}

const UTILITIES = ["PGE", "SCE", "SDGE", "OTHER"] as const;
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "vi", label: "Vietnamese" },
  { code: "tl", label: "Tagalog" },
];

export default function StepBasicInfo({ data, onChange }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Patient basics</h2>
        <p className="text-slate-500 mt-1">Name, location, and utility provider.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Full name *</label>
          <input
            type="text"
            value={data.name ?? ""}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Margaret Rodriguez"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
          <input
            type="number"
            value={data.age ?? ""}
            onChange={(e) => onChange({ age: parseInt(e.target.value) || undefined })}
            placeholder="74"
            min={0}
            max={120}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">ZIP code *</label>
          <input
            type="text"
            value={data.zip_code ?? ""}
            onChange={(e) => onChange({ zip_code: e.target.value })}
            placeholder="93720"
            maxLength={5}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Electric utility</label>
          <select
            value={data.utility ?? ""}
            onChange={(e) => onChange({ utility: e.target.value as UserProfileCreate["utility"] })}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Select utility</option>
            {UTILITIES.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Preferred language</label>
          <select
            value={data.preferred_language ?? "en"}
            onChange={(e) => onChange({ preferred_language: e.target.value })}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>

        <div className="sm:col-span-2 flex items-center gap-3">
          <input
            type="checkbox"
            id="medical_baseline"
            checked={data.medical_baseline_enrolled ?? false}
            onChange={(e) => onChange({ medical_baseline_enrolled: e.target.checked })}
            className="w-4 h-4 rounded text-blue-600"
          />
          <label htmlFor="medical_baseline" className="text-sm text-slate-700">
            Enrolled in utility Medical Baseline program
          </label>
        </div>
      </div>
    </div>
  );
}
