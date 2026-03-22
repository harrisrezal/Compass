"use client";

import { useState, useCallback } from "react";
import type { UserProfile, ActionPlan } from "@/lib/types";
import HazardStatusGrid from "@/components/dashboard/HazardStatusGrid";
import HazardMap from "@/components/hazards/HazardMap";
import ActionPlanChecklist from "@/components/dashboard/ActionPlanChecklist";
import OrganisationsPanel from "@/components/dashboard/OrganisationsPanel";
import SubscribersPanel from "@/components/dashboard/SubscribersPanel";

type HazardLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

interface HazardSummary {
  level: HazardLevel;
  label: string;
  action?: string;
  reasoning?: string;
  data_sources?: string[];
}

interface MapData {
  user_lat_lng: [number, number];
  active_overlays: string[];
  evacuation_route?: { trigger: string } | null;
  nearby_resources?: Array<{ name: string; type: string; lat: number; lng: number }>;
}

interface SimData {
  hazards: Record<string, HazardSummary>;
  map_data: MapData;
  lastUpdated: string;
  plan: { items: Array<{ action: string; detail: string }>; summary?: string } | null;
  insights: Record<string, string>;
}

interface Props {
  initialData: SimData;
  profile: UserProfile;
  initialCondition: string;
  initialBackupHours: number;
  userId: string;
}

const CONDITIONS = [
  { key: "oxygen",           label: "🫁 Oxygen" },
  { key: "ventilator",       label: "🫀 Ventilator" },
  { key: "dialysis",         label: "💉 Dialysis" },
  { key: "wheelchair",       label: "♿ Wheelchair" },
  { key: "heat_vulnerable",  label: "🌡️ Heat Vulnerable" },
];

const LEVEL_ORDER = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;

const RISK_BADGE: Record<string, { dot: string; badge: string; label: string }> = {
  LOW:      { dot: "bg-green-500",  badge: "bg-green-100 text-green-700 border border-green-200",   label: "All Clear" },
  MODERATE: { dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border border-yellow-200", label: "Monitor" },
  HIGH:     { dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border border-red-300",          label: "High Risk" },
  CRITICAL: { dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border border-red-300",          label: "High Risk" },
};

export default function SimulationPanel({ initialData, profile, initialCondition, initialBackupHours, userId }: Props) {
  const [data, setData] = useState<SimData>(initialData);
  const [condition, setCondition] = useState(initialCondition);
  const [zip, setZip] = useState(profile.zip_code);
  const [zipInput, setZipInput] = useState(profile.zip_code);
  const [loading, setLoading] = useState(false);
  const [predictionLevels, setPredictionLevels] = useState<Record<string, string> | undefined>(undefined);
  const [actualLevels, setActualLevels] = useState<Record<string, string> | undefined>(undefined);
  const [simulationKey, setSimulationKey] = useState(0);

  const runSimulation = useCallback(async (newCondition: string, newZip?: string) => {
    setLoading(true);
    const effectiveZip = newZip ?? zip;
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip: effectiveZip,
          condition: newCondition,
          backupHours: initialBackupHours,
          name: profile.name,
          age: profile.age,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
        if (result.prediction) setPredictionLevels(result.prediction);
        if (result.actual) setActualLevels(result.actual);
        setSimulationKey(k => k + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [profile, initialBackupHours, zip]);

  const handleConditionChange = (newCondition: string) => {
    setCondition(newCondition);
  };

  const handleZipSubmit = (newZip: string) => {
    const trimmed = newZip.trim();
    if (!trimmed || trimmed === zip) return;
    setZip(trimmed);
    runSimulation(condition, trimmed);
  };

  // Derive overall risk level
  const hazardLevels = Object.fromEntries(
    Object.entries(data.hazards).map(([k, v]) => [k, v.level])
  ) as Record<string, HazardLevel>;

  const overallLevel = Object.values(hazardLevels).reduce<string>(
    (worst, lvl) =>
      LEVEL_ORDER.indexOf(lvl as typeof LEVEL_ORDER[number]) > LEVEL_ORDER.indexOf(worst as typeof LEVEL_ORDER[number])
        ? lvl : worst,
    "LOW"
  );
  const activeThreats = Object.values(hazardLevels).filter(l => l === "HIGH" || l === "CRITICAL").length;
  const risk = RISK_BADGE[overallLevel] ?? RISK_BADGE["LOW"];

  // Build ActionPlan for the checklist component
  const plan: ActionPlan = data.plan
    ? {
        plan_id: "sim",
        user_id: userId,
        generated_at: data.lastUpdated,
        action_items: data.plan.items.map((item, i) => ({
          order: i + 1,
          action: item.action,
          detail: item.detail,
          completed: false,
        })),
      }
    : { plan_id: "demo", user_id: userId, generated_at: data.lastUpdated, action_items: [] };

  return (
    <div className="space-y-6">

      {/* Patient header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{profile.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {condition.replace("_", " ")} · ZIP {zip} · {profile.utility}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${risk.badge}`}>
            <span className={`w-2 h-2 rounded-full ${risk.dot} ${!loading ? "animate-pulse" : ""}`} />
            {loading ? "Simulating…" : risk.label}
          </span>
          {activeThreats > 0 && !loading && (
            <span className="text-xs text-slate-500">
              {activeThreats} hazard{activeThreats !== 1 ? "s" : ""} require attention
            </span>
          )}
        </div>
      </div>

      {/* Condition / diagnosis selector + ZIP */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Simulate Diagnosis
          </p>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleConditionChange(key)}
                disabled={loading}
                className={`text-sm px-3 py-1.5 rounded-full font-medium transition disabled:opacity-50 ${
                  condition === key
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Simulate ZIP Code
          </p>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); handleZipSubmit(zipInput); }}
          >
            <input
              type="text"
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              onBlur={() => handleZipSubmit(zipInput)}
              maxLength={5}
              placeholder="e.g. 93720"
              disabled={loading}
              className="w-28 text-sm px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="text-sm px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition disabled:opacity-50"
            >
              Update
            </button>
          </form>
        </div>
      </div>

      {/* Hazard status — with refresh button */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Hazard Status</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1 rounded-full font-medium">
              🛡️ Monitoring next 72 hours
            </span>
            <button
              onClick={() => runSimulation(condition)}
              disabled={loading}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-full font-medium transition disabled:opacity-50 flex items-center gap-1"
            >
              {loading
                ? <><span className="inline-block animate-spin">⟳</span> Simulating…</>
                : <>🔄 Re-simulate</>
              }
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 h-32 animate-pulse">
                <div className="h-3 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <HazardStatusGrid
            hazards={data.hazards}
            lastUpdated={data.lastUpdated}
            hazardInsights={data.insights}
            predictionLevels={predictionLevels}
            actualLevels={actualLevels}
          />
        )}
      </div>

      {/* Map + Action Plan / sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <HazardMap key={simulationKey} mapData={data.map_data} hazardLevels={hazardLevels} />
          <ActionPlanChecklist plan={plan} summary={data.plan?.summary} />
        </div>
        <div className="space-y-4">
          <OrganisationsPanel profile={profile} />
          <SubscribersPanel profile={profile} />
        </div>
      </div>

    </div>
  );
}
