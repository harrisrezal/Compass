import type { UserProfile } from "@/lib/types";

interface Org {
  name: string;
  type: string;
  icon: string;
  detail?: string;
  phone?: string;
}

function getOrgs(profile: UserProfile): Org[] {
  const orgs: Org[] = [];
  const nr = profile.nearest_resources;

  if (nr?.hospital_name) {
    orgs.push({
      name: nr.hospital_name,
      type: "Hospital",
      icon: "🏥",
      detail: nr.hospital_miles != null ? `${nr.hospital_miles} miles away` : undefined,
    });
  }
  if (nr?.cooling_center) {
    orgs.push({
      name: nr.cooling_center,
      type: "Cooling Center",
      icon: "❄️",
      detail: "Open during heat advisories",
    });
  }
  if (profile.equipment?.supplier_name) {
    orgs.push({
      name: profile.equipment.supplier_name,
      type: "Equipment Supplier",
      icon: "🔧",
      phone: profile.equipment.supplier_phone ?? undefined,
    });
  }

  // Community orgs — static for demo, keyed by ZIP
  const communityOrgs: Record<string, Org[]> = {
    "93720": [
      { name: "Fresno Disability Resource Center", type: "Non-profit", icon: "🤝", detail: "Evacuation assistance" },
    ],
    "95969": [
      { name: "Butte County Emergency Services", type: "Government", icon: "🚨", detail: "PSPS support line" },
      { name: "Paradise Ridge Community Recovery", type: "Non-profit", icon: "🤝" },
    ],
    "90034": [
      { name: "LA County Aging & Disabilities", type: "Government", icon: "🏛️", detail: "Heat relief resources" },
      { name: "Culver City Senior Center", type: "Community", icon: "🏘️" },
    ],
  };

  const community = communityOrgs[profile.zip_code] ?? [
    { name: "211 California", type: "Resource Helpline", icon: "📞", detail: "Call or text 211 for local support" },
  ];

  return [...orgs, ...community];
}

export default function OrganisationsPanel({ profile }: { profile: UserProfile }) {
  const orgs = getOrgs(profile);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <h3 className="font-bold text-slate-900">Connected Organisations</h3>
      <div className="space-y-2">
        {orgs.map((org, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 transition">
            <span className="text-xl flex-shrink-0">{org.icon}</span>
            <div className="min-w-0">
              <div className="font-medium text-slate-900 text-sm truncate">{org.name}</div>
              <div className="flex gap-2 mt-0.5 flex-wrap">
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{org.type}</span>
                {org.detail && <span className="text-xs text-slate-400">{org.detail}</span>}
              </div>
              {org.phone && (
                <a href={`tel:${org.phone}`} className="text-xs text-blue-600 hover:underline mt-0.5 block">
                  {org.phone}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
