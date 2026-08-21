export default function ProductDetailLoading() {
  return (
    <div className="animate-pulse pb-20 bg-white">
      {/* Sticky Header skeleton */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="w-6 h-6 bg-gray-200 rounded" />
          <div className="flex items-center gap-1">
            <div className="w-8 h-8 bg-gray-200 rounded" />
            <div className="w-8 h-8 bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      {/* Image skeleton */}
      <div className="aspect-square bg-gray-100" />

      {/* Brand & Name skeleton */}
      <div className="px-4 pt-5 pb-3">
        <div className="h-3 w-20 bg-gray-100 rounded mb-2" />
        <div className="h-5 w-3/4 bg-gray-200 rounded mb-2" />
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-3 h-3 bg-gray-100 rounded" />
            ))}
          </div>
          <div className="h-3 w-8 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Price skeleton */}
      <div className="px-4 pb-4">
        <div className="flex items-baseline gap-2">
          <div className="h-6 w-12 bg-red-50 rounded" />
          <div className="h-6 w-24 bg-gray-200 rounded" />
        </div>
      </div>

      <div className="h-2 bg-gray-50" />

      {/* Shipping skeleton */}
      <div className="px-4 py-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gray-100 rounded" />
            <div className="h-4 w-40 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      <div className="h-2 bg-gray-50" />

      {/* Tabs skeleton */}
      <div className="px-4 py-4">
        <div className="flex gap-4 border-b border-gray-100 pb-3">
          <div className="h-4 w-16 bg-gray-200 rounded" />
          <div className="h-4 w-16 bg-gray-100 rounded" />
          <div className="h-4 w-16 bg-gray-100 rounded" />
        </div>
        <div className="space-y-3 pt-4">
          <div className="h-4 w-full bg-gray-100 rounded" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
          <div className="h-4 w-4/6 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Fixed Bottom Bar skeleton */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white border-t border-gray-200 z-50">
        <div className="flex items-center gap-2 p-3">
          <div className="w-12 h-12 bg-gray-100 rounded-lg" />
          <div className="flex-1 h-12 bg-gray-100 rounded-lg" />
          <div className="flex-1 h-12 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
