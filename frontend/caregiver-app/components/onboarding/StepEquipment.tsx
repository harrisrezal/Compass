"use client";

import type { UserProfileCreate } from "@/lib/types";

interface Props {
  data: Partial<UserProfileCreate>;
  onChange: (updates: Partial<UserProfileCreate>) => void;
}

export default function StepEquipment({ data, onChange }: Props) {
  const eq = data.equipment ?? {};

  const update = (field: string, value: string | number | null) =>
    onChange({ equipment: { ...eq, [field]: value } });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Medical equipment</h2>
        <p className="text-slate-500 mt-1">
          Indicate the medical devices used at the home.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Equipment type / name</label>
          <input
            type="text"
            value={eq.type ?? ""}
            onChange={(e) => update("type", e.target.value)}
            placeholder="Oxygen concentrator (5L/min)"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Power draw (watts)</label>
          <input
            type="number"
            value={eq.power_watts ?? ""}
            onChange={(e) => update("power_watts", parseInt(e.target.value) || 0)}
            placeholder="300"
            min={0}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Supplier name</label>
          <input
            type="text"
            value={eq.supplier_name ?? ""}
            onChange={(e) => update("supplier_name", e.target.value)}
            placeholder="AeroCare Medical"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Supplier phone</label>
          <input
            type="tel"
            value={eq.supplier_phone ?? ""}
            onChange={(e) => update("supplier_phone", e.target.value)}
            placeholder="1-800-232-7263"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

    </div>
  );
}
