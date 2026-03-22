type HazardLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

interface HazardSummary {
  level: HazardLevel;
  label: string;
  reasoning?: string;
  data_sources?: string[];
}

interface Props {
  hazards: Record<string, HazardSummary>;
  lastUpdated?: string;
  hazardInsights?: Record<string, string>;
}

const HAZARD_META: Array<{ key: string; icon: string; name: string }> = [
  { key: "psps",       icon: "⚡", name: "PSPS" },
  { key: "wildfire",   icon: "🔥", name: "Wildfire" },
  { key: "flood",      icon: "🌊", name: "Flood" },
  { key: "heat",       icon: "🌡️", name: "Heat" },
  { key: "earthquake", icon: "🫨", name: "Earthquake" },
];

const LEVEL_STYLES: Record<HazardLevel, { badge: string; border: string; bg: string }> = {
  LOW:      { badge: "bg-green-100 text-green-700",   border: "border-green-200",  bg: "bg-green-50/30" },
  MODERATE: { badge: "bg-yellow-100 text-yellow-700", border: "border-yellow-200", bg: "bg-yellow-50/30" },
  HIGH:     { badge: "bg-orange-100 text-orange-700", border: "border-orange-300", bg: "bg-orange-50/30" },
  CRITICAL: { badge: "bg-red-100 text-red-700",       border: "border-red-300",    bg: "bg-red-50/30" },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function HazardStatusGrid({ hazards, lastUpdated, hazardInsights }: Props) {
  const updatedLabel = lastUpdated ? timeAgo(lastUpdated) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {HAZARD_META.map(({ key, icon, name }) => {
        const h = hazards[key];
        const level: HazardLevel = (h?.level as HazardLevel) ?? "LOW";
        const styles = LEVEL_STYLES[level];
        return (
          <div
            key={key}
            className={`rounded-2xl border ${styles.border} ${styles.bg} bg-white p-4 flex flex-col gap-2`}
          >
            {/* Header */}
            <div className="flex items-center gap-1.5">
              <span className="text-xl">{icon}</span>
              <span className="text-xs font-semibold text-slate-700">{name}</span>
            </div>

            {/* Label */}
            <p className="text-xs font-medium text-slate-800 leading-snug">
              {h?.label ?? "No data"}
            </p>

            {/* Prediction / Actual rows */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 w-16 shrink-0">Prediction</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${styles.badge}`}>{level}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 w-16 shrink-0">Actual</span>
                <span className={`px-2 py-0.5 rounded-full font-semibold ${styles.badge}`}>{level}</span>
              </div>
            </div>

            {/* Gemini insight for non-LOW hazards */}
            {level !== "LOW" && hazardInsights?.[key] && (
              <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2.5 py-1.5 leading-snug border border-slate-100">
                {hazardInsights[key]}
              </p>
            )}

            {/* Footer: sources + updated */}
            <div className="mt-auto pt-1 border-t border-slate-100 space-y-0.5">
              {h?.data_sources && h.data_sources.length > 0 && (
                <p className="text-[10px] text-slate-400 leading-tight">
                  📡 {h.data_sources.join(" · ")}
                </p>
              )}
              {updatedLabel && (
                <p className="text-[10px] text-slate-400">🕐 Updated {updatedLabel}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
