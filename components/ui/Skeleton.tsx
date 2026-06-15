export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded-lg ${className}`} />
}

export function ItemSkeleton() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '0.5px solid #F5F5F5' }}
    >
      <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-5 w-8 rounded-full" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <tr style={{ borderBottom: '0.5px solid #F5F5F5' }}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

export function CardSkeleton() {
  return <Skeleton className="h-36 w-full rounded-2xl" />
}
