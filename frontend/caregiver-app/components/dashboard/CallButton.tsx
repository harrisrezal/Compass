"use client";

import { useState } from "react";
import MockCallModal from "./MockCallModal";

interface Props {
  patient: Record<string, unknown>;
  score: Record<string, unknown> | null;
}

export default function CallButton({ patient, score }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
      >
        📞 Simulate Agent Call
      </button>
      {open && (
        <MockCallModal patient={patient} score={score} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
