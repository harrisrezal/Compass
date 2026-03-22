"use client";

interface Props {
  onSelect: (mode: "caregiver" | "self") => void;
}

export default function StepWho({ onSelect }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Who is filling this in?</h2>
        <p className="text-slate-500 mt-1">
          We'll tailor the questions based on your role.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onSelect("caregiver")}
          className="border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-6 text-left transition group"
        >
          <div className="text-3xl mb-3">👩‍⚕️</div>
          <div className="font-semibold text-slate-900 group-hover:text-blue-600">I'm a caregiver</div>
          <div className="text-sm text-slate-500 mt-1">
            Setting this up on behalf of a patient or family member.
          </div>
        </button>
        <button
          onClick={() => onSelect("self")}
          className="border-2 border-slate-200 hover:border-blue-500 rounded-2xl p-6 text-left transition group"
        >
          <div className="text-3xl mb-3">🧑‍🦳</div>
          <div className="font-semibold text-slate-900 group-hover:text-blue-600">I'm the patient</div>
          <div className="text-sm text-slate-500 mt-1">
            Setting up my own profile to receive alerts and action plans.
          </div>
        </button>
      </div>
    </div>
  );
}
