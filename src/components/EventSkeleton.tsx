export function EventSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading events" role="status">
      <div className="flex items-center gap-3">
        <div className="h-4 w-20 animate-pulse rounded bg-[#E5E7EB]" />
        <div className="h-px flex-1 bg-[#E5E7EB]" />
      </div>

      {[0, 1, 2].map((idx) => (
        <div
          key={idx}
          className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xs flex flex-col sm:flex-row"
        >
          <div className="aspect-[16/9] sm:aspect-auto sm:w-52 md:w-60 animate-pulse bg-[#F3F4F6] shrink-0" />
          <div className="flex-1 p-5 sm:p-6 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-24 animate-pulse rounded bg-[#F3F4F6]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[#F3F4F6]" />
            </div>
            <div className="h-6 w-3/4 max-w-sm animate-pulse rounded bg-[#E5E7EB]" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded bg-[#F3F4F6]" />
            <div className="pt-4 border-t border-[#E5E7EB]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-10 w-28 animate-pulse rounded-xl bg-[#E5E7EB]" />
                <div className="h-10 w-32 animate-pulse rounded-xl bg-[#F3F4F6]" />
              </div>
              <div className="h-4 w-16 animate-pulse rounded bg-[#F3F4F6]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
