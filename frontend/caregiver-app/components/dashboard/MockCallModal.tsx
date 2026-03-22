"use client";

import { useEffect, useRef, useState } from "react";

type Purpose = "welfare_check" | "risk_alert" | "evacuation_warning";
type Screen = "config" | "generating" | "active" | "transfer911" | "ended";

const PURPOSES: { value: Purpose; icon: string; label: string; desc: string }[] = [
  {
    value: "welfare_check",
    icon: "💚",
    label: "Welfare Check",
    desc: "Friendly check-in — is the patient aware of current risk?",
  },
  {
    value: "risk_alert",
    icon: "⚠️",
    label: "Risk Alert",
    desc: "Urgent — risk score crossed threshold, action steps needed now.",
  },
  {
    value: "evacuation_warning",
    icon: "🚨",
    label: "Evacuation Warning",
    desc: "Emergency — active Red Flag / PSPS. Prepare to leave now.",
  },
];

interface Props {
  patient: Record<string, unknown>;
  score: Record<string, unknown> | null;
  onClose: () => void;
}

export default function MockCallModal({ patient, score, onClose }: Props) {
  const [screen, setScreen] = useState<Screen>("config");
  const [purpose, setPurpose] = useState<Purpose | "">("");
  const [customNote, setCustomNote] = useState("");
  const [script, setScript] = useState("");
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const charTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const patientFirstName = String(patient.name ?? "the patient").split(" ")[0];

  // Timer
  useEffect(() => {
    if (screen === "active") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen]);

  // Scroll transcript character by character
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
    if (!purpose) return;
    setScreen("generating");
    setError("");
    try {
      const res = await fetch("/api/call-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, customNote, patient, score }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setScript(data.script);
      setScreen("active");
      setElapsed(0);
      // Speak
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(data.script);
      utterance.rate = 0.88;
      utterance.pitch = 1.0;
      utterance.onend = () => setScreen("ended");
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate script");
      setScreen("config");
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

        {/* CONFIG */}
        {screen === "config" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Simulate Agent Call</h2>
                <p className="text-sm text-slate-500">Compass will call {patientFirstName} directly</p>
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Call purpose</label>
              {PURPOSES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPurpose(p.value)}
                  className={`w-full flex items-start gap-3 border-2 rounded-xl px-4 py-3 text-left transition ${
                    purpose === p.value ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="text-xl mt-0.5">{p.icon}</span>
                  <div>
                    <div className="font-medium text-slate-900 text-sm">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Additional note for agent <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g. Ask if she has someone to stay with tonight…"
                rows={2}
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <button
              onClick={placeCall}
              disabled={!purpose}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold py-3 rounded-2xl transition flex items-center justify-center gap-2"
            >
              📞 Place Call
            </button>
          </div>
        )}

        {/* GENERATING */}
        {screen === "generating" && (
          <div className="p-10 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-3xl animate-pulse">🧭</div>
            <div>
              <p className="font-semibold text-slate-900">Preparing call script…</p>
              <p className="text-sm text-slate-500 mt-1">Compass agent is generating a personalised message</p>
            </div>
          </div>
        )}

        {/* ACTIVE CALL */}
        {screen === "active" && (
          <div className="flex flex-col">
            {/* Header */}
            <div className="bg-slate-900 text-white px-6 pt-8 pb-6 flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl">🧭</div>
                <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <p className="font-semibold text-lg">Compass Agent</p>
              <p className="text-slate-400 text-sm">Calling {patientFirstName}…</p>
              <p className="text-green-400 text-sm font-mono">{formatTime(elapsed)}</p>
            </div>

            {/* Transcript */}
            <div className="bg-slate-50 px-5 py-4 h-48 overflow-y-auto">
              <p className="text-xs text-slate-400 mb-2">Live transcript</p>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {script.slice(0, visibleChars)}
                <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse align-middle" />
              </p>
            </div>

            {/* Actions */}
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
              <p className="text-sm text-slate-700"><span className="font-medium">Patient:</span> {String(patient.name)}, age {String(patient.age ?? "unknown")}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Condition:</span> {String(patient.condition)}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Equipment:</span> {String((patient.equipment as Record<string,unknown>)?.type ?? "unknown")}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Can evacuate:</span> {patient.can_self_evacuate ? "Yes" : "No — needs assistance"}</p>
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
