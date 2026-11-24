/**
 * Placeholders shown instantly while a menu that was never visited before is
 * rendered for the first time (afterwards it's served fully from cache).
 */
export function MenuSkeleton() {
  return (
    <div className="mx-auto max-w-xl animate-pulse px-5 pt-10" aria-busy="true" aria-label="Chargement du menu">
      <div className="h-9 w-2/3 rounded-lg bg-line" />
      <div className="mt-3 h-4 w-1/2 rounded bg-line" />
      <div className="mt-8 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-line" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mt-6 flex gap-4">
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 rounded bg-line" />
            <div className="h-4 w-full rounded bg-line" />
            <div className="h-4 w-1/3 rounded bg-line" />
          </div>
          <div className="size-28 rounded-2xl bg-line" />
        </div>
      ))}
    </div>
  );
}

export function DishSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true">
      <div className="aspect-square max-h-[62svh] w-full bg-line" />
      <div className="mx-auto max-w-xl space-y-3 px-5 pt-6">
        <div className="h-8 w-2/3 rounded-lg bg-line" />
        <div className="h-5 w-1/4 rounded bg-line" />
        <div className="h-4 w-full rounded bg-line" />
      </div>
    </div>
  );
}
