const config: Record<string, { dot: string; style: string }> = {
  DRAFT:     { dot: "bg-gray-400",    style: "bg-gray-50   text-gray-600   ring-1 ring-inset ring-gray-200"   },
  PENDING:   { dot: "bg-amber-400",   style: "bg-amber-50  text-amber-700  ring-1 ring-inset ring-amber-200"  },
  APPROVED:  { dot: "bg-violet-500",  style: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200" },
  DELIVERED: { dot: "bg-emerald-500", style: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" },
  CANCELLED: { dot: "bg-red-400",     style: "bg-red-50    text-red-600    ring-1 ring-inset ring-red-200"    },
};

export function StatusBadge({ status }: { status: string }) {
  const c = config[status] ?? { dot: "bg-gray-400", style: "bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${c.style}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {status}
    </span>
  );
}
