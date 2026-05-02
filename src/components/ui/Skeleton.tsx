function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-lg ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-soft">
      <div className="flex items-start justify-between mb-3">
        <div className="space-y-2">
          <SkeletonBox className="h-4 w-36" />
          <SkeletonBox className="h-3 w-24" />
        </div>
        <SkeletonBox className="h-5 w-20 rounded-full" />
      </div>
      <SkeletonBox className="h-3 w-full mb-2" />
      <SkeletonBox className="h-3 w-3/4" />
    </div>
  );
}

export function SkeletonCustomerCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-soft">
      <SkeletonBox className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonBox className="h-4 w-32" />
        <SkeletonBox className="h-3 w-48" />
      </div>
      <SkeletonBox className="h-7 w-20 rounded-lg" />
    </div>
  );
}

export function SkeletonList({ count = 4, variant = "card" }: { count?: number; variant?: "card" | "customer" }) {
  const Item = variant === "customer" ? SkeletonCustomerCard : SkeletonCard;
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Item key={i} />
      ))}
    </div>
  );
}

export function SkeletonStatCards({ cols = 2 }: { cols?: 2 | 4 }) {
  const gridClass = cols === 4
    ? "grid grid-cols-2 sm:grid-cols-4 gap-3"
    : "grid grid-cols-2 gap-3";
  return (
    <div className={gridClass}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-soft">
          <SkeletonBox className="h-7 w-20 mb-2" />
          <SkeletonBox className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
