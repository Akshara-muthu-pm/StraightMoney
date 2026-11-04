export default function ProgressBar({
  current,
  goal,
  label = "Campaign funding progress",
  caption = "Funded",
}: {
  current: number;
  goal: number;
  label?: string;
  caption?: string;
}) {
  const percent = goal > 0 ? Math.max(0, Math.min(100, Math.round((current / goal) * 100))) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-600">
        <span>{caption}</span>
        <span className="font-extrabold text-[#001435] tabular-nums">{percent}%</span>
      </div>
      <div
        className="h-3.5 overflow-hidden rounded-full bg-[#E1E7EC] p-0.5"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#003087] via-[#00457C] to-[#0070BA] transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
