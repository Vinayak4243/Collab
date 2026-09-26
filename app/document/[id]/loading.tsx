export default function DocumentLoading() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3">
        <div className="h-6 w-6 animate-pulse rounded bg-slate-100" />
        <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex-1 space-y-3 px-6 py-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-slate-100"
            style={{ width: `${85 - i * 8}%` }}
          />
        ))}
      </div>
    </div>
  );
}
