function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
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
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
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

export function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
          <SkeletonBox className="h-7 w-24 mb-2" />
          <SkeletonBox className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
