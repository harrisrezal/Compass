"use client";

import { useState } from "react";
import Link from "next/link";
import HazardMap from "@/components/hazards/HazardMap";

// ── Types ──────────────────────────────────────────────────────────────────────

type HazardLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

interface HazardSummary {
  level: HazardLevel;
  label: string;
}

interface MapData {
  user_lat_lng: [number, number];
  active_overlays: string[];
  evacuation_route?: { trigger: string } | null;
}

interface Patient {
  id: string;
  name: string;
  age: number;
  condition: string;
  zip_code: string;
  city: string;
  utility: string;
  equipment_type: string;
  backup_hours: number;
  hospital_name: string;
  hospital_miles: number;
  caregiver_name: string;
  hazards: Record<string, HazardSummary>;
  map_data: MapData;
}

// ── Mock Data ──────────────────────────────────────────────────────────────────

const ORG = {
  name: "California Health Network",
  id: "CHN-001",
  region: "Central & Southern California",
  contact: "care@chn.org",
};

const PATIENTS: Patient[] = [
  {
    id: "demo-user-margaret-001",
    name: "Margaret Rodriguez",
    age: 74,
    condition: "Oxygen Dependent",
    zip_code: "93720",
    city: "Fresno, CA",
    utility: "PG&E",
    equipment_type: "Oxygen concentrator (5L/min)",
    backup_hours: 4,
    hospital_name: "Fresno Community Hospital",
    hospital_miles: 1.8,
    caregiver_name: "Maria Rodriguez",
    hazards: {
      psps:       { level: "CRITICAL", label: "Active PSPS Alert" },
      wildfire:   { level: "HIGH",     label: "Red Flag Warning" },
      flood:      { level: "LOW",      label: "No flood risk" },
      heat:       { level: "HIGH",     label: "Heat Advisory" },
      earthquake: { level: "LOW",      label: "No seismic activity" },
    },
    map_data: {
      user_lat_lng: [36.8034, -119.7195],
      active_overlays: ["psps", "wildfire", "heat"],
      evacuation_route: null,
    },
  },
  {
    id: "demo-user-james-002",
    name: "James Thornton",
    age: 68,
    condition: "Ventilator Dependent",
    zip_code: "95969",
    city: "Paradise, CA",
    utility: "PG&E",
    equipment_type: "Home mechanical ventilator (BiPAP)",
    backup_hours: 8,
    hospital_name: "Adventist Health Feather River",
    hospital_miles: 3.2,
    caregiver_name: "Sandra Thornton",
    hazards: {
      psps:       { level: "HIGH",     label: "PSPS Risk Zone" },
      wildfire:   { level: "CRITICAL", label: "Active Fire Nearby" },
      flood:      { level: "LOW",      label: "No flood risk" },
      heat:       { level: "MODERATE", label: "Warm conditions" },
      earthquake: { level: "LOW",      label: "No seismic activity" },
    },
    map_data: {
      user_lat_lng: [39.7596, -121.6219],
      active_overlays: ["psps", "wildfire", "heat"],
      evacuation_route: { trigger: "wildfire" },
    },
  },
  {
    id: "demo-user-dorothy-003",
    name: "Dorothy Kim",
    age: 81,
    condition: "Heat Vulnerable",
    zip_code: "90034",
    city: "Los Angeles, CA",
    utility: "SCE",
    equipment_type: "Air conditioner (window unit)",
    backup_hours: 0,
    hospital_name: "Cedars-Sinai Medical Center",
    hospital_miles: 2.1,
    caregiver_name: "David Kim",
    hazards: {
      psps:       { level: "LOW",      label: "No PSPS risk" },
      wildfire:   { level: "LOW",      label: "No wildfire risk" },
      flood:      { level: "MODERATE", label: "Flood Watch" },
      heat:       { level: "HIGH",     label: "Excessive Heat" },
      earthquake: { level: "MODERATE", label: "Seismic Zone" },
    },
    map_data: {
      user_lat_lng: [34.0211, -118.4001],
      active_overlays: ["flood", "heat", "earthquake"],
      evacuation_route: null,
    },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const LEVEL_ORDER = ["LOW", "MODERATE", "HIGH", "CRITICAL"] as const;

function getOverallLevel(hazards: Record<string, HazardSummary>): HazardLevel {
  return Object.values(hazards).reduce<HazardLevel>(
    (worst, h) =>
      LEVEL_ORDER.indexOf(h.level) > LEVEL_ORDER.indexOf(worst) ? h.level : worst,
    "LOW"
  );
}

const RISK_BADGE: Record<HazardLevel, { dot: string; badge: string; label: string }> = {
  LOW:      { dot: "bg-green-500",  badge: "bg-green-100 text-green-700 border border-green-200",    label: "All Clear" },
  MODERATE: { dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border border-yellow-200", label: "Monitor" },
  HIGH:     { dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border border-red-300",           label: "High Risk" },
  CRITICAL: { dot: "bg-red-500",    badge: "bg-red-100 text-red-700 border border-red-300",           label: "High Risk" },
};

const CONDITION_ICON: Record<string, string> = {
  "Oxygen Dependent":    "🫁",
  "Ventilator Dependent": "🫀",
  "Heat Vulnerable":     "🌡️",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OrganisationPage() {
  const [selectedId, setSelectedId] = useState<string>(PATIENTS[0].id);
  const selected = PATIENTS.find(p => p.id === selectedId) ?? PATIENTS[0];

  const hazardLevels = Object.fromEntries(
    Object.entries(selected.hazards).map(([k, v]) => [k, v.level])
  ) as Record<string, HazardLevel>;

  const activeThreats = Object.values(selected.hazards).filter(
    h => h.level === "HIGH" || h.level === "CRITICAL"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-blue-700 font-bold text-lg">🧭 Compass</Link>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="font-medium text-slate-700">{ORG.name}</span>
          <span>·</span>
          <span>{ORG.id}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Org header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{ORG.name}</h1>
            <p className="text-slate-500 text-sm mt-1">{ORG.region} · {PATIENTS.length} enrolled patients</p>
          </div>
          <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-full font-medium">
            Organisation View
          </span>
        </div>

        {/* 3-column grid: patient list (1) + map panel (2) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ── Patient list ── */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              Patients
            </h2>
            {PATIENTS.map((patient) => {
              const level = getOverallLevel(patient.hazards);
              const badge = RISK_BADGE[level];
              const isSelected = patient.id === selectedId;
              const icon = CONDITION_ICON[patient.condition] ?? "👤";

              return (
                <button
                  key={patient.id}
                  onClick={() => setSelectedId(patient.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition ${
                    isSelected
                      ? "border-blue-300 bg-blue-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {/* Row 1: avatar + name + badge */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-lg shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 text-sm truncate">{patient.name}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${badge.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{patient.condition} · Age {patient.age}</p>
                    </div>
                  </div>

                  {/* Row 2: ZIP + city + utility */}
                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                    <span>📍 {patient.city}</span>
                    <span>·</span>
                    <span>ZIP {patient.zip_code}</span>
                    <span>·</span>
                    <span>{patient.utility}</span>
                  </div>

                  {/* Row 3: active threat count */}
                  {(getOverallLevel(patient.hazards) === "HIGH" || getOverallLevel(patient.hazards) === "CRITICAL") && (
                    <div className="mt-2 text-xs font-medium text-red-600">
                      ⚠ {Object.values(patient.hazards).filter(h => h.level === "HIGH" || h.level === "CRITICAL").length} active hazard(s) require attention
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Map panel ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Patient info card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">{selected.name}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {selected.condition} · {selected.city} · ZIP {selected.zip_code}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${RISK_BADGE[getOverallLevel(selected.hazards)].badge}`}>
                    <span className={`w-2 h-2 rounded-full animate-pulse ${RISK_BADGE[getOverallLevel(selected.hazards)].dot}`} />
                    {RISK_BADGE[getOverallLevel(selected.hazards)].label}
                  </span>
                  {activeThreats > 0 && (
                    <p className="text-xs text-slate-400 mt-1">{activeThreats} hazard{activeThreats !== 1 ? "s" : ""} require attention</p>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Equipment</p>
                  <p className="text-xs font-medium text-slate-700 mt-0.5 leading-snug">{selected.equipment_type}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Backup Power</p>
                  <p className={`text-sm font-bold mt-0.5 ${selected.backup_hours === 0 ? "text-red-600" : selected.backup_hours < 4 ? "text-orange-600" : "text-green-600"}`}>
                    {selected.backup_hours === 0 ? "None" : `${selected.backup_hours}h`}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Hospital</p>
                  <p className="text-xs font-medium text-slate-700 mt-0.5 leading-snug">{selected.hospital_name} ({selected.hospital_miles}mi)</p>
                </div>
              </div>

              {/* Hazard summary row */}
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(selected.hazards).map(([key, h]) => {
                  if (h.level === "LOW") return null;
                  const colours: Record<HazardLevel, string> = {
                    LOW:      "",
                    MODERATE: "bg-yellow-50 text-yellow-700 border-yellow-200",
                    HIGH:     "bg-orange-50 text-orange-700 border-orange-300",
                    CRITICAL: "bg-red-50 text-red-700 border-red-300",
                  };
                  const icons: Record<string, string> = { psps: "⚡", wildfire: "🔥", flood: "🌊", heat: "🌡️", earthquake: "🫨" };
                  return (
                    <span key={key} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colours[h.level]}`}>
                      {icons[key]} {h.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Map */}
            <HazardMap mapData={selected.map_data} hazardLevels={hazardLevels} />

            {/* Link to full dashboard */}
            <div className="text-center">
              <Link
                href={`/dashboard/${selected.id}`}
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition"
              >
                Open full dashboard for {selected.name.split(" ")[0]} →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
