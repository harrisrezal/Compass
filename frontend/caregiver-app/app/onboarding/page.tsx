"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { UserProfileCreate } from "@/lib/types";
import StepWho from "@/components/onboarding/StepWho";
import StepBasicInfo from "@/components/onboarding/StepBasicInfo";
import StepCondition from "@/components/onboarding/StepCondition";
import StepEquipment from "@/components/onboarding/StepEquipment";
import StepMedications from "@/components/onboarding/StepMedications";
import StepCaregiverDetails from "@/components/onboarding/StepCaregiverDetails";
import StepReview from "@/components/onboarding/StepReview";

type Mode = "caregiver" | "self";

const STEPS = ["Who", "Basics", "Condition", "Equipment", "Medications", "Caregiver", "Review"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>("caregiver");
  const [data, setData] = useState<Partial<UserProfileCreate>>({ medications: [] });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const update = (patch: Partial<UserProfileCreate>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const handleWho = (m: Mode) => {
    setMode(m);
    next();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(undefined);
    try {
      const user = await api.createUser(data as UserProfileCreate);
      router.push(`/dashboard/${user.user_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  // Skip caregiver step if patient is filling in themselves
  const visibleSteps = STEPS.filter((s) => !(s === "Caregiver" && mode === "self"));
  const totalSteps = visibleSteps.length;
  const progress = Math.round((step / (totalSteps - 1)) * 100);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-8 text-blue-700 font-bold text-lg">
          🧭 Compass
        </div>

        {/* Progress bar */}
        {step > 0 && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Step {step} of {totalSteps - 1}</span>
              <span>{visibleSteps[step]}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {step === 0 && <StepWho onSelect={handleWho} />}
          {step === 1 && <StepBasicInfo data={data} onChange={update} />}
          {step === 2 && <StepCondition data={data} onChange={update} />}
          {step === 3 && <StepEquipment data={data} onChange={update} />}
          {step === 4 && <StepMedications data={data} onChange={update} />}
          {step === 5 && mode === "caregiver" && (
            <StepCaregiverDetails data={data} onChange={update} mode={mode} />
          )}
          {(step === 6 || (step === 5 && mode === "self")) && (
            <StepReview
              data={data}
              mode={mode}
              onSubmit={handleSubmit}
              submitting={submitting}
              error={error}
            />
          )}
        </div>

        {/* Nav buttons */}
        {step > 0 && step < totalSteps - 1 && (
          <div className="flex justify-between mt-6">
            <button
              onClick={back}
              className="text-slate-500 hover:text-slate-800 text-sm font-medium transition"
            >
              ← Back
            </button>
            <button
              onClick={next}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
            >
              Continue →
            </button>
          </div>
        )}
        {step === 0 && (
          <p className="text-center text-xs text-slate-400 mt-6">
            Takes about 3 minutes · Your data is private
          </p>
        )}
      </div>
    </div>
  );
}
