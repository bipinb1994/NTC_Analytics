interface SkeletonProps {
  height?: string
  className?: string
}

export default function Skeleton({ height = 'h-48', className = '' }: SkeletonProps) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="skeleton h-4 w-28 mb-4" />
      <div className={`skeleton w-full ${height}`} />
    </div>
  )
}

export function SkeletonStat() {
  return (
    <div className="card p-5">
      <div className="flex justify-between mb-4">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-8 w-8 rounded-lg" />
      </div>
      <div className="skeleton h-8 w-20 mb-1" />
      <div className="skeleton h-3 w-32 mt-2" />
    </div>
  )
}
