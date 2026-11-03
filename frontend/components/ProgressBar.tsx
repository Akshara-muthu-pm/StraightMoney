export default function ProgressBar({ current, goal, label = "Campaign funding progress", caption = "Funded" }: { current: number; goal: number; label?: string; caption?: string }) {
  const percent = goal > 0 ? Math.max(0, Math.min(100, Math.round((current / goal) * 100))) : 0;
  return <div>
    <div className="mb-2 flex items-center justify-between text-sm text-slate-600"><span>{caption}</span><span className="font-semibold text-slate-900">{percent}%</span></div>
    <div className="h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
    </div>
  </div>;
}
