"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import HazardCard, { HazardLevel, HazardResult } from "@/components/hazards/HazardCard";
import HazardInputForm, { HazardFormValues } from "@/components/hazards/HazardInputForm";
import MockCallModal from "@/components/dashboard/MockCallModal";

// Load map client-side only (uses browser APIs)
const HazardMap = dynamic(() => import("@/components/hazards/HazardMap"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 bg-slate-100 h-96 flex items-center justify-center text-slate-400 text-sm">
      Loading map…
    </div>
  ),
});

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const HAZARD_ORDER = ["psps", "wildfire", "flood", "heat", "earthquake"];

interface HazardResponse {
  address: string;
  last_updated: string;
  hazards: Record<string, HazardResult>;
  map_data: {
    user_lat_lng: [number, number];
    active_overlays: string[];
    evacuation_route?: { trigger: string } | null;
    nearby_resources?: Array<{ name: string; type: string; lat: number; lng: number }>;
  };
}

export default function HazardsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<HazardResponse | null>(null);
  const [simulateMode, setSimulateMode] = useState(false);

  // Call dispatch state — for the existing MockCallModal
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [dispatchingHazard, setDispatchingHazard] = useState<string | null>(null);

  const handleSubmit = async (values: HazardFormValues) => {
    setLoading(true);
    setError("");
    setResponse(null);
    setSimulateMode(values.simulate);

    try {
      const params = new URLSearchParams({
        address: values.address,
        simulate: String(values.simulate),
        medical: String(values.medical),
        pets: String(values.pets),
        age_group: values.ageGroup,
      });
      const res = await fetch(`${BASE_URL}/hazards?${params}`);
      if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        throw new Error(`API ${res.status}: ${detail}`);
      }
      setResponse(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch hazard data.");
    } finally {
      setLoading(false);
    }
  };

  const handleCallDispatch = (hazardKey: string) => {
    setDispatchingHazard(hazardKey);
    setCallModalOpen(true);
  };

  const hazardLevels: Record<string, HazardLevel> = response
    ? Object.fromEntries(Object.entries(response.hazards).map(([k, v]) => [k, v.level]))
    : {};

  // Build a synthetic patient/score for the MockCallModal
  const mockPatient = {
    name: response?.address ?? "the resident",
    zip_code: "",
    condition: "other",
    can_self_evacuate: false,
    caregiver: {
      name: "Emergency Contact",
      phone: "—",
      relationship: "Contact",
    },
  };

  const mockScore = dispatchingHazard && response
    ? {
        risk_level: response.hazards[dispatchingHazard]?.level ?? "HIGH",
        composite_score: 85,
        primary_threat: dispatchingHazard === "psps" ? "grid"
          : dispatchingHazard === "wildfire" ? "wildfire"
          : dispatchingHazard === "flood" ? "flood"
          : dispatchingHazard === "heat" ? "heat"
          : "none",
        hours_to_action: 2,
      }
    : null;

  const lastChecked = response
    ? Math.round((Date.now() - new Date(response.last_updated).getTime()) / 60_000)
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <a href="/" className="text-blue-700 font-bold text-lg flex items-center gap-2">
          🛡️ Guardian Angel.AI
        </a>
        <span className="text-slate-300">/</span>
        <span className="text-slate-700 font-medium">Hazard Alert Check</span>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="lg:grid lg:grid-cols-[420px_1fr] lg:gap-8">

          {/* ── Left panel ── */}
          <div className="space-y-6">
            {/* Input form card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h1 className="text-xl font-bold text-slate-900 mb-1">
                Natural Disaster Risk Check
              </h1>
              <p className="text-sm text-slate-500 mb-5">
                Enter an address to check 5 independent hazard risks in real time.
              </p>
              <HazardInputForm onSubmit={handleSubmit} loading={loading} />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Results header */}
            {response && (
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-slate-700 truncate">
                  📍 {response.address}
                </p>
                {lastChecked !== null && (
                  <p className="text-xs text-slate-400 whitespace-nowrap ml-2">
                    Last checked: {lastChecked === 0 ? "just now" : `${lastChecked}m ago`}
                  </p>
                )}
              </div>
            )}

            {/* Hazard cards */}
            {response && (
              <div className="space-y-3">
                {HAZARD_ORDER.map((key) => {
                  const result = response.hazards[key];
                  if (!result) return null;
                  return (
                    <HazardCard
                      key={key}
                      hazardKey={key}
                      result={result}
                      address={response.address}
                      simulateMode={simulateMode}
                      onCallDispatch={handleCallDispatch}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Right panel: Map ── */}
          <div className="mt-6 lg:mt-0">
            {response ? (
              <div className="sticky top-8">
                <HazardMap
                  mapData={response.map_data}
                  hazardLevels={hazardLevels}
                />
                {response.map_data.evacuation_route && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
                    🚨 Evacuation route displayed — follow the red line away from the hazard zone
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 h-96 flex flex-col items-center justify-center text-slate-400 text-sm gap-3">
                <span className="text-4xl">🗺️</span>
                <p>Enter an address to see your hazard map</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Call dispatch — reuses existing MockCallModal */}
      {callModalOpen && (
        <MockCallModal
          patient={mockPatient as Record<string, unknown>}
          score={mockScore as Record<string, unknown> | null}
          onClose={() => {
            setCallModalOpen(false);
            setDispatchingHazard(null);
          }}
        />
      )}
    </div>
  );
}
