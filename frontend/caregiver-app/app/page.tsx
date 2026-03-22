import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-blue-950 to-slate-900 text-white px-6">
      <div className="max-w-lg text-center space-y-6">
        <div className="text-5xl font-bold tracking-tight">🧭 Compass</div>
        <p className="text-xl text-blue-200">
          AI Medical Emergency Intelligence for California
        </p>
        <p className="text-slate-400 text-sm leading-relaxed">
          Protecting medically vulnerable Californians — home oxygen, dialysis,
          ventilators, and power wheelchairs — by predicting energy and disaster
          risks before they become emergencies.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Link
            href="/onboarding"
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            Enrol a Patient
          </Link>
          <Link
            href="/dashboard/demo-user-margaret-001"
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-xl transition"
          >
            View Demo Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
