"use client";

import type { UserProfileCreate } from "@/lib/types";

interface Props {
  data: Partial<UserProfileCreate>;
  mode: "caregiver" | "self";
  onSubmit: () => void;
  submitting: boolean;
  error?: string;
}

function Row({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{String(value)}</span>
    </div>
  );
}

export default function StepReview({ data, mode, onSubmit, submitting, error }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Review & confirm</h2>
        <p className="text-slate-500 mt-1">Check everything looks right before submitting.</p>
      </div>

      <div className="bg-slate-50 rounded-2xl p-5 space-y-1">
        <Row label="Name" value={data.name} />
        <Row label="Age" value={data.age} />
        <Row label="ZIP code" value={data.zip_code} />
        <Row label="Utility" value={data.utility} />
        <Row label="Condition" value={data.condition} />
        <Row label="Equipment" value={data.equipment?.type} />
        <Row label="Backup power" value={data.equipment?.backup_hours != null ? `${data.equipment.backup_hours} hrs` : undefined} />
        <Row label="Medications" value={data.medications?.length ? `${data.medications.length} listed` : "None"} />
        <Row label="Can self-evacuate" value={data.can_self_evacuate ? "Yes" : "No"} />
        <Row label="Language" value={data.preferred_language} />
        {mode === "caregiver" && (
          <>
            <Row label="Caregiver" value={data.caregiver?.name} />
            <Row label="Alert threshold" value={data.caregiver?.notify_threshold} />
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-semibold py-3 rounded-xl transition"
      >
        {submitting ? "Enrolling…" : "Enrol patient →"}
      </button>
    </div>
  );
}
