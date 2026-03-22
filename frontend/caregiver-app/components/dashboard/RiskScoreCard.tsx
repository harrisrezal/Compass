import type { RiskScore } from "@/lib/types";

const LEVEL_CONFIG = {
  LOW:      { colour: "text-green-600",  ring: "stroke-green-500",  bg: "bg-green-50",  label: "Low Risk" },
  MODERATE: { colour: "text-yellow-600", ring: "stroke-yellow-500", bg: "bg-yellow-50", label: "Moderate Risk" },
  ELEVATED: { colour: "text-orange-500", ring: "stroke-orange-500", bg: "bg-orange-50", label: "Elevated Risk" },
  HIGH:     { colour: "text-red-600",    ring: "stroke-red-500",    bg: "bg-red-50",    label: "High Risk" },
  CRITICAL: { colour: "text-red-700",    ring: "stroke-red-700",    bg: "bg-red-100",   label: "Critical" },
};

const THREAT_ICONS: Record<string, string> = {
  grid: "⚡",
  heat: "🌡️",
  wildfire: "🔥",
  flood: "🌊",
  none: "✅",
};

interface Props {
  score: RiskScore;
}

export default function RiskScoreCard({ score }: Props) {
  const cfg = LEVEL_CONFIG[score.risk_level] ?? LEVEL_CONFIG.LOW;
  const circumference = 2 * Math.PI * 52; // r=52
  const dashOffset = circumference * (1 - score.composite_score / 100);
  const updated = new Date(score.timestamp).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className={`rounded-2xl border border-slate-200 p-6 ${cfg.bg} space-y-4`}>
      {/* Score ring */}
      <div className="flex justify-center">
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className={`${cfg.ring} transition-all duration-700`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-bold ${cfg.colour}`}>
              {Math.round(score.composite_score)}
            </span>
            <span className="text-xs text-slate-500 font-medium">/ 100</span>
          </div>
        </div>
      </div>

      {/* Level badge */}
      <div className="text-center">
        <span className={`text-lg font-bold ${cfg.colour}`}>{cfg.label}</span>
      </div>

      {/* Details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Primary threat</span>
          <span className="font-medium">
            {THREAT_ICONS[score.primary_threat ?? "none"]} {score.primary_threat ?? "none"}
          </span>
        </div>
        {score.hours_to_action != null && (
          <div className="flex justify-between">
            <span className="text-slate-500">Hours to action</span>
            <span className="font-medium">{score.hours_to_action}h</span>
          </div>
        )}
        {score.has_red_flag_warning && (
          <div className="text-red-600 font-medium text-center text-xs bg-red-50 rounded-lg py-1">
            🚩 Red Flag Warning active
          </div>
        )}
        {score.active_psps && (
          <div className="text-orange-600 font-medium text-center text-xs bg-orange-50 rounded-lg py-1">
            ⚡ PSPS event active
          </div>
        )}
        <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-200">
          <span>Updated</span>
          <span>{updated}</span>
        </div>
      </div>

      {/* Welfare check button */}
      <button className="w-full border border-slate-300 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-sm font-medium py-2 rounded-xl transition">
        Trigger welfare check
      </button>
    </div>
  );
}
