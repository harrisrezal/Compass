"use client";

import { useEffect, useRef, useState } from "react";

export type HazardLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface HazardResult {
  level: HazardLevel;
  label: string;
  action: string;
  alert_message?: string;
  alert_sent: boolean;
  acknowledged: boolean;
  call_dispatched: boolean;
  data: Record<string, unknown>;
}

interface Props {
  hazardKey: string;
  result: HazardResult;
  address: string;
  simulateMode: boolean;
  onCallDispatch?: (hazardKey: string) => void;
}

const HAZARD_META: Record<string, { icon: string; name: string }> = {
  psps:       { icon: "⚡", name: "Power Shutoff (PSPS)" },
  wildfire:   { icon: "🔥", name: "Wildfire / Smoke" },
  flood:      { icon: "🌊", name: "Flooding" },
  heat:       { icon: "🌡️", name: "Extreme Heat" },
  earthquake: { icon: "🫨", name: "Earthquake" },
};

const LEVEL_STYLES: Record<HazardLevel, { badge: string; border: string; bg: string; dot: string }> = {
  LOW:      { badge: "bg-green-100 text-green-700",   border: "border-green-200",  bg: "bg-green-50",  dot: "🟢" },
  MODERATE: { badge: "bg-amber-100 text-amber-700",   border: "border-amber-200",  bg: "bg-amber-50",  dot: "🟡" },
  HIGH:     { badge: "bg-orange-100 text-orange-700", border: "border-orange-200", bg: "bg-orange-50", dot: "🟠" },
  CRITICAL: { badge: "bg-red-100 text-red-700",       border: "border-red-200",    bg: "bg-red-50",    dot: "🔴" },
};

// Ack timer durations
const TIMER_MS: Record<string, number> = {
  simulate: 5_000,       // 5s in demo mode
  real:     15 * 60_000, // 15 min in production
};

export default function HazardCard({
  hazardKey,
  result,
  address,
  simulateMode,
  onCallDispatch,
}: Props) {
  const meta = HAZARD_META[hazardKey] ?? { icon: "⚠️", name: hazardKey };
  const styles = LEVEL_STYLES[result.level];

  const [acknowledged, setAcknowledged] = useState(false);
  const [callDispatched, setCallDispatched] = useState(result.call_dispatched);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const needsAck = result.level === "HIGH" || result.level === "CRITICAL";

  // Start ack timer for HIGH/CRITICAL
  useEffect(() => {
    if (!needsAck || acknowledged || callDispatched) return;

    const totalMs = simulateMode ? TIMER_MS.simulate : TIMER_MS.real;
    const totalSecs = totalMs / 1000;
    setCountdown(totalSecs);

    // countdown display
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c !== null && c > 0 ? c - 1 : 0));
    }, 1000);

    // fire call dispatch when timer expires
    timerRef.current = setTimeout(() => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
      setCallDispatched(true);
      onCallDispatch?.(hazardKey);
    }, totalMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [needsAck, acknowledged, callDispatched, simulateMode, hazardKey, onCallDispatch]);

  const handleAcknowledge = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(null);
    setAcknowledged(true);
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (result.level === "LOW") {
    return (
      <div className={`rounded-2xl border ${styles.border} ${styles.bg} px-5 py-4 flex items-center gap-4`}>
        <span className="text-2xl">{meta.icon}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">{meta.name}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${styles.badge}`}>
              {styles.dot} LOW
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">No active threat detected at your address</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 ${styles.border} ${styles.bg} p-5 space-y-4`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{meta.icon}</span>
          <div>
            <p className="font-bold text-slate-900 text-lg leading-tight">{meta.name}</p>
            <p className="text-sm text-slate-600">{result.label}</p>
          </div>
        </div>
        <span className={`text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap ${styles.badge}`}>
          {styles.dot} {result.level}
        </span>
      </div>

      {/* Gemini alert message */}
      {result.alert_message && (
        <div className={`rounded-xl border ${styles.border} px-4 py-3`}>
          <p className="text-sm text-slate-700 leading-relaxed">{result.alert_message}</p>
        </div>
      )}

      {/* Action */}
      <div className="flex items-start gap-2">
        <span className="text-slate-400 mt-0.5">→</span>
        <p className="text-sm font-medium text-slate-800">{result.action}</p>
      </div>

      {/* Acknowledgement + Call Dispatch */}
      {needsAck && (
        <div className="space-y-2">
          {callDispatched ? (
            <div className="flex items-center gap-2 bg-red-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold">
              📞 Call dispatched — agent is calling the registered contact
            </div>
          ) : acknowledged ? (
            <div className="flex items-center gap-2 bg-green-100 text-green-700 rounded-xl px-4 py-2.5 text-sm font-semibold">
              ✓ Acknowledged — call dispatch cancelled
            </div>
          ) : (
            <div className="space-y-2">
              {countdown !== null && (
                <p className="text-xs text-slate-500 text-center">
                  ⏱ Call will be dispatched in{" "}
                  <span className="font-mono font-bold text-orange-600">
                    {formatCountdown(countdown)}
                  </span>{" "}
                  if not acknowledged
                </p>
              )}
              <button
                onClick={handleAcknowledge}
                className="w-full bg-slate-900 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl transition text-sm"
              >
                ✓ Acknowledge — I&apos;m aware and taking action
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
