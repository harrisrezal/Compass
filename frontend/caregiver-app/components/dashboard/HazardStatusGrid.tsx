type HazardLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

interface HazardSummary {
  level: HazardLevel;
  label: string;
}

interface Props {
  hazards: Record<string, HazardSummary>;
}

const HAZARD_META: Array<{ key: string; icon: string; name: string }> = [
  { key: "psps",       icon: "⚡", name: "PSPS" },
  { key: "wildfire",   icon: "🔥", name: "Wildfire" },
  { key: "flood",      icon: "🌊", name: "Flood" },
  { key: "heat",       icon: "🌡️", name: "Heat" },
  { key: "earthquake", icon: "🫨", name: "Seismic" },
];

const LEVEL_STYLES: Record<HazardLevel, { badge: string; border: string }> = {
  LOW:      { badge: "bg-green-100 text-green-700",  border: "border-green-200" },
  MODERATE: { badge: "bg-yellow-100 text-yellow-700", border: "border-yellow-200" },
  HIGH:     { badge: "bg-orange-100 text-orange-700", border: "border-orange-300" },
  CRITICAL: { badge: "bg-red-100 text-red-700",      border: "border-red-300" },
};

export default function HazardStatusGrid({ hazards }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {HAZARD_META.map(({ key, icon, name }) => {
        const h = hazards[key];
        const level: HazardLevel = (h?.level as HazardLevel) ?? "LOW";
        const styles = LEVEL_STYLES[level];
        return (
          <div
            key={key}
            className={`rounded-2xl border bg-white p-4 flex flex-col items-center gap-2 text-center ${styles.border}`}
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs font-semibold text-slate-700">{name}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
              {level}
            </span>
          </div>
        );
      })}
    </div>
  );
}
