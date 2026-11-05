export default function ProgressBar({
  current,
  goal,
  label = "Campaign funding progress",
  caption,
}: {
  current: number;
  goal: number;
  label?: string;
  caption?: string;
}) {
  const percent = goal > 0 ? Math.max(0, Math.min(100, Math.round((current / goal) * 100))) : 0;
  return (
    <div className="w-full">
      {caption && (
        <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
          <span>{caption}</span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div
          className="liquid-progress-container relative h-3 flex-1 overflow-hidden rounded-full p-0.5"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className="liquid-progress-fill h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="min-w-[2.75rem] text-right text-xs font-black text-[#003087] dark:text-[#38bdf8] tabular-nums">
          {percent}%
        </span>
      </div>
    </div>
  );
}
