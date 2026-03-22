"use client";

import { useState } from "react";

export interface HazardFormValues {
  address: string;
  medical: boolean;
  pets: boolean;
  ageGroup: "under18" | "18-64" | "65+";
  simulate: boolean;
}

interface Props {
  onSubmit: (values: HazardFormValues) => void;
  loading: boolean;
}

export default function HazardInputForm({ onSubmit, loading }: Props) {
  const [address, setAddress] = useState("");
  const [medical, setMedical] = useState(false);
  const [pets, setPets] = useState(false);
  const [ageGroup, setAgeGroup] = useState<HazardFormValues["ageGroup"]>("18-64");
  const [simulate, setSimulate] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      setError("Please enter an address.");
      return;
    }
    setError("");
    onSubmit({ address: address.trim(), medical, pets, ageGroup, simulate });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Home address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 123 Main St, Fresno CA or ZIP code"
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Age group */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Age group</label>
        <select
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value as HazardFormValues["ageGroup"])}
          className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="under18">Under 18</option>
          <option value="18-64">18–64</option>
          <option value="65+">65+</option>
        </select>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setMedical((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center ${medical ? "bg-blue-600" : "bg-slate-300"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${medical ? "translate-x-4" : ""}`} />
          </div>
          <span className="text-sm text-slate-700">Uses powered medical equipment (oxygen, dialysis, ventilator)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setPets((v) => !v)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center ${pets ? "bg-blue-600" : "bg-slate-300"}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${pets ? "translate-x-4" : ""}`} />
          </div>
          <span className="text-sm text-slate-700">Has pets</span>
        </label>
      </div>

      {/* Demo mode */}
      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Demo Mode</p>
          <p className="text-xs text-slate-500">Returns simulated HIGH/CRITICAL data for all hazards</p>
        </div>
        <div
          onClick={() => setSimulate((v) => !v)}
          className={`w-10 h-6 rounded-full transition-colors flex items-center cursor-pointer ${simulate ? "bg-orange-500" : "bg-slate-300"}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${simulate ? "translate-x-4" : ""}`} />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition text-sm"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Checking hazards…
          </span>
        ) : (
          "Check My Address →"
        )}
      </button>
    </form>
  );
}
