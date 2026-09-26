export default function DashboardLoading() {
  return (
    <div className="flex h-screen">
      <div className="w-60 border-r border-slate-100 bg-white p-3">
        <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex-1 bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="h-7 w-64 animate-pulse rounded bg-slate-200" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
