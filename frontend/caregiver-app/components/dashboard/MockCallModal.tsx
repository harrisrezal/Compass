"use client";

import { useEffect, useRef, useState } from "react";

type Screen = "confirm" | "generating" | "active" | "transfer911" | "ended";

const THREAT_LABELS: Record<string, string> = {
  grid: "Power Grid Outage",
  heat: "Extreme Heat",
  wildfire: "Wildfire / Smoke",
  flood: "Flooding",
  none: "Environmental Hazard",
};

const RISK_COLOURS: Record<string, string> = {
  CRITICAL: "text-red-700 bg-red-50 border-red-200",
  HIGH: "text-orange-700 bg-orange-50 border-orange-200",
  ELEVATED: "text-yellow-700 bg-yellow-50 border-yellow-200",
  MODERATE: "text-blue-700 bg-blue-50 border-blue-200",
  LOW: "text-green-700 bg-green-50 border-green-200",
};

interface Props {
  patient: Record<string, unknown>;
  score: Record<string, unknown> | null;
  onClose: () => void;
}

export default function MockCallModal({ patient, score, onClose }: Props) {
  const [screen, setScreen] = useState<Screen>("confirm");
  const [script, setScript] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const charTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const caregiver = (patient.caregiver as Record<string, unknown>) ?? {};
  const caregiverName = String(caregiver.name ?? "Emergency Contact");
  const caregiverPhone = String(caregiver.phone ?? "No phone on file");
  const caregiverRel = String(caregiver.relationship ?? "Contact");
  const patientName = String(patient.name ?? "the patient");
  const riskLevel = String(score?.risk_level ?? "UNKNOWN");
  const threatLabel = THREAT_LABELS[String(score?.primary_threat ?? "none")] ?? "Environmental Hazard";
  const riskColour = RISK_COLOURS[riskLevel] ?? "text-slate-700 bg-slate-50 border-slate-200";

  // Timer
  useEffect(() => {
    if (screen === "active") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen]);

  // Scroll transcript
  useEffect(() => {
    if (screen === "active" && script) {
      setVisibleChars(0);
      charTimerRef.current = setInterval(() => {
        setVisibleChars((v) => {
          if (v >= script.length) {
            if (charTimerRef.current) clearInterval(charTimerRef.current);
            return v;
          }
          return v + 3;
        });
      }, 50);
    }
    return () => { if (charTimerRef.current) clearInterval(charTimerRef.current); };
  }, [screen, script]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const placeCall = async () => {
    setScreen("generating");
    setError("");
    try {
      const res = await fetch("/api/call-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient, score, caregiver }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScript(data.script);
      setScreen("active");
      setElapsed(0);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(data.script);
      utterance.rate = 0.88;
      utterance.onend = () => setScreen("ended");
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate script");
      setScreen("confirm");
    }
  };

  const endCall = () => {
    window.speechSynthesis.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    setScreen("ended");
  };

  const connect911 = () => {
    window.speechSynthesis.cancel();
    if (timerRef.current) clearInterval(timerRef.current);
    setScreen("transfer911");
  };

  const handleClose = () => {
    window.speechSynthesis.cancel();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* CONFIRM */}
        {screen === "confirm" && (
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">🚨 Unresponded Risk Alert</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {patientName} has not responded to a risk alert.
                </p>
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl ml-4">✕</button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {/* Threat badge */}
            <div className={`border rounded-xl px-4 py-3 text-sm font-medium ${riskColour}`}>
              ⚡ {threatLabel} · Score {String(score?.composite_score ?? "—")}/100 · {riskLevel}
            </div>

            {/* Who will be called */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Compass will call</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg">👤</div>
                <div>
                  <p className="font-semibold text-slate-900">{caregiverName}</p>
                  <p className="text-sm text-slate-500">{caregiverRel}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700 pt-1">
                <span>📞</span>
                <span className="font-mono">{caregiverPhone}</span>
              </div>
            </div>

            <button
              onClick={placeCall}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-2xl transition flex items-center justify-center gap-2"
            >
              📞 Place Call Now
            </button>
            <button onClick={handleClose} className="w-full text-slate-500 text-sm py-2">
              Cancel
            </button>
          </div>
        )}

        {/* GENERATING */}
        {screen === "generating" && (
          <div className="p-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl animate-pulse">🧭</div>
            <div>
              <p className="font-semibold text-slate-900">Preparing alert script…</p>
              <p className="text-sm text-slate-500 mt-1">Compass is generating a personalised message for {caregiverName}</p>
            </div>
          </div>
        )}

        {/* ACTIVE CALL */}
        {screen === "active" && (
          <div className="flex flex-col">
            <div className="bg-slate-900 text-white px-6 pt-8 pb-6 flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl">🧭</div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <p className="font-semibold text-lg">Compass Agent</p>
              <p className="text-slate-400 text-sm">Calling {caregiverName}…</p>
              <p className="text-green-400 text-sm font-mono">{formatTime(elapsed)}</p>
            </div>

            <div className="bg-slate-50 px-5 py-4 h-48 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-2">Live transcript</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {script.slice(0, visibleChars)}
                <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />
              </p>
            </div>

            <div className="px-5 py-4 flex gap-3">
              <button
                onClick={connect911}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-2xl transition text-sm"
              >
                🚨 Connect to 911
              </button>
              <button
                onClick={endCall}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-3 rounded-2xl transition text-sm"
              >
                End Call
              </button>
            </div>
          </div>
        )}

        {/* 911 TRANSFER */}
        {screen === "transfer911" && (
          <div className="p-8 flex flex-col items-center gap-5 text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center text-4xl animate-pulse">🚨</div>
            <div>
              <p className="font-bold text-xl text-red-700">Connecting to 911</p>
              <p className="text-sm text-slate-500 mt-1">Transferring call to emergency services…</p>
            </div>
            <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 text-left space-y-1">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Emergency info pre-filled</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Patient:</span> {patientName}, age {String(patient.age ?? "unknown")}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Condition:</span> {String(patient.condition ?? "unknown")}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Equipment:</span> {String((patient.equipment as Record<string,unknown>)?.type ?? "unknown")}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Can evacuate:</span> {patient.can_self_evacuate ? "Yes" : "No — needs assistance"}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Threat:</span> {threatLabel}</p>
            </div>
            <button onClick={handleClose} className="w-full bg-slate-900 text-white font-semibold py-3 rounded-2xl">
              Close
            </button>
          </div>
        )}

        {/* ENDED */}
        {screen === "ended" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900">Call ended</h2>
                <p className="text-sm text-slate-500">Duration: {formatTime(elapsed)}</p>
              </div>
              <span className="text-2xl">📵</span>
            </div>
            <div className="bg-slate-50 rounded-2xl px-4 py-3 max-h-52 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-1">Transcript</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{script}</p>
            </div>
            <button onClick={handleClose} className="w-full bg-slate-900 text-white font-semibold py-3 rounded-2xl">
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
