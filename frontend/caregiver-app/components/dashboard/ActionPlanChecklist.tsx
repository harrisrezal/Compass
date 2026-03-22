import type { ActionItem, ActionPlan, Urgency } from "@/lib/types";

const URGENCY_CONFIG: Record<Urgency, { label: string; colour: string; bg: string }> = {
  NOW:          { label: "Do Now",        colour: "text-red-700",    bg: "bg-red-100" },
  TODAY:        { label: "Today",         colour: "text-orange-700", bg: "bg-orange-100" },
  BEFORE_EVENT: { label: "Before Event",  colour: "text-yellow-700", bg: "bg-yellow-100" },
  DURING:       { label: "During Event",  colour: "text-blue-700",   bg: "bg-blue-100" },
  AFTER:        { label: "After",         colour: "text-slate-600",  bg: "bg-slate-100" },
};

const URGENCY_ORDER: Urgency[] = ["NOW", "TODAY", "BEFORE_EVENT", "DURING", "AFTER"];

interface Props {
  plan: ActionPlan;
}

function groupByUrgency(items: ActionItem[]): Map<Urgency, ActionItem[]> {
  const map = new Map<Urgency, ActionItem[]>();
  for (const urgency of URGENCY_ORDER) {
    const group = items.filter((i) => i.urgency === urgency);
    if (group.length > 0) map.set(urgency, group);
  }
  return map;
}

export default function ActionPlanChecklist({ plan }: Props) {
  const items = plan.action_items ?? [];
  const grouped = groupByUrgency(items);
  const generated = new Date(plan.generated_at).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="font-bold text-slate-900">Action Plan</h2>
          <p className="text-xs text-slate-400 mt-0.5">Generated {generated}</p>
        </div>
        {plan.risk_level && (
          <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
            {plan.primary_threat} risk
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm">No action plan yet — score below alert threshold.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {URGENCY_ORDER.map((urgency) => {
            const group = grouped.get(urgency);
            if (!group) return null;
            const cfg = URGENCY_CONFIG[urgency];
            return (
              <div key={urgency}>
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${cfg.bg} ${cfg.colour}`}>
                  {cfg.label}
                </div>
                <div className="space-y-2">
                  {group.map((item, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl hover:bg-slate-50 transition group">
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 ${item.completed ? "bg-green-500 border-green-500" : "border-slate-300"}`}>
                        {item.completed && (
                          <svg className="w-full h-full text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 text-sm">{item.action}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
