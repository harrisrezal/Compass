import type { UserProfile } from "@/lib/types";

interface Subscriber {
  name: string;
  role: string;
  avatar: string;
  lastActive: string;
  alertLevel: string;
}

// Demo subscribers — in production these would come from a profile_subscribers BQ table
function getSubscribers(profile: UserProfile): Subscriber[] {
  const caregiver = profile.caregiver;
  const subs: Subscriber[] = [];

  if (caregiver?.name) {
    subs.push({
      name: caregiver.name,
      role: caregiver.relationship ?? "Caregiver",
      avatar: caregiver.name.charAt(0).toUpperCase(),
      lastActive: "Just now",
      alertLevel: caregiver.notify_threshold ?? "HIGH",
    });
  }

  // Mock neighbours for demo
  subs.push(
    {
      name: "Compass Watch",
      role: "AI monitoring",
      avatar: "🧭",
      lastActive: "Active",
      alertLevel: "ALL",
    },
    {
      name: "Local Neighbour Network",
      role: "Community watch",
      avatar: "🏘️",
      lastActive: "2 hrs ago",
      alertLevel: "CRITICAL",
    }
  );

  return subs;
}

export default function SubscribersPanel({ profile }: { profile: UserProfile }) {
  const subs = getSubscribers(profile);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-900">Watching this profile</h3>
        <span className="text-xs bg-blue-50 text-blue-600 font-medium px-2 py-0.5 rounded-full">
          {subs.length} active
        </span>
      </div>
      <div className="space-y-2">
        {subs.map((sub, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-700 shrink-0">
              {sub.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-slate-900 text-sm">{sub.name}</div>
              <div className="text-xs text-slate-400">{sub.role} · {sub.lastActive}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium transition py-1">
        + Invite a neighbour or caregiver
      </button>
    </div>
  );
}
