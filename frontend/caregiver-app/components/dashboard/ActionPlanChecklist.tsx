"use client";

import { useState } from "react";
import type { ActionPlan } from "@/lib/types";

interface Props {
  plan: ActionPlan;
  summary?: string;
}

export default function ActionPlanChecklist({ plan, summary }: Props) {
  const initial = plan.action_items ?? [];
  const [checked, setChecked] = useState<Record<number, boolean>>(
    () => Object.fromEntries(initial.map((item, i) => [i, item.completed ?? false]))
  );

  const items = [...initial].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const generated = new Date(plan.generated_at).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const toggle = (i: number) => setChecked((prev) => ({ ...prev, [i]: !prev[i] }));
  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold text-slate-900">Action Plan</h2>
          <p className="text-xs text-slate-400 mt-0.5">Generated {generated}</p>
        </div>
        {items.length > 0 && (
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {doneCount}/{items.length} done
          </span>
        )}
      </div>

      {/* Gemini summary */}
      {summary && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed">
          {summary}
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm">No active hazards — all clear in your area.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="w-full flex gap-3 p-3 rounded-xl hover:bg-slate-50 transition text-left"
            >
              <div
                className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                  checked[i] ? "bg-green-500 border-green-500" : "border-slate-300"
                }`}
              >
                {checked[i] && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div>
                <div className={`font-medium text-sm ${checked[i] ? "line-through text-slate-400" : "text-slate-900"}`}>
                  {item.action}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{item.detail}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
