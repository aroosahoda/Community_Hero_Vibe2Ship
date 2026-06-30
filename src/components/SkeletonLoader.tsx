import React from "react";

interface SkeletonLoaderProps {
  type: "card" | "list" | "metric" | "chart" | "detail";
  count?: number;
}

export default function SkeletonLoader({ type, count = 1 }: SkeletonLoaderProps) {
  const shimmerClass = "bg-gray-200 dark:bg-slate-800 animate-pulse rounded-xl relative overflow-hidden after:absolute after:inset-0 after:-translate-x-full after:bg-linear-to-r after:from-transparent after:via-white/20 dark:after:via-white/5 after:to-transparent after:animate-shimmer";

  if (type === "card") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-xs space-y-4"
          >
            {/* Image block skeleton */}
            <div className={`h-40 w-full ${shimmerClass}`} />

            {/* Category header skeleton */}
            <div className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-lg ${shimmerClass}`} />
              <div className={`h-4 w-24 ${shimmerClass}`} />
            </div>

            {/* Title skeleton */}
            <div className={`h-5 w-3/4 ${shimmerClass}`} />

            {/* Description skeleton */}
            <div className="space-y-2">
              <div className={`h-3 w-full ${shimmerClass}`} />
              <div className={`h-3 w-5/6 ${shimmerClass}`} />
            </div>

            {/* Location & Time skeletons */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800/60 space-y-2">
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded-full ${shimmerClass}`} />
                <div className={`h-3 w-1/2 ${shimmerClass}`} />
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-3.5 w-3.5 rounded-full ${shimmerClass}`} />
                <div className={`h-3 w-1/3 ${shimmerClass}`} />
              </div>
            </div>

            {/* Bottom buttons skeleton */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-50 dark:border-slate-800/40">
              <div className={`h-8 w-24 ${shimmerClass}`} />
              <div className={`h-8 w-16 ${shimmerClass}`} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "list") {
    return (
      <div className="space-y-3 w-full">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/60 rounded-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3 w-3/4">
              {/* Thumbnail square */}
              <div className={`h-11 w-11 rounded-xl flex-shrink-0 ${shimmerClass}`} />
              <div className="space-y-2 flex-1">
                <div className="flex gap-2">
                  <div className={`h-3.5 w-16 ${shimmerClass}`} />
                  <div className={`h-3.5 w-12 ${shimmerClass}`} />
                </div>
                <div className={`h-4 w-1/2 ${shimmerClass}`} />
              </div>
            </div>
            <div className={`h-6 w-16 ${shimmerClass}`} />
          </div>
        ))}
      </div>
    );
  }

  if (type === "metric") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="p-5 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl flex items-center justify-between shadow-xs"
          >
            <div className="space-y-2 flex-1">
              <div className={`h-3 w-20 ${shimmerClass}`} />
              <div className={`h-8 w-16 ${shimmerClass}`} />
              <div className={`h-3.5 w-32 ${shimmerClass}`} />
            </div>
            <div className={`p-6 rounded-xl ${shimmerClass}`} />
          </div>
        ))}
      </div>
    );
  }

  if (type === "chart") {
    return (
      <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-3xl p-5 shadow-xs w-full">
        <div className="flex justify-between items-center mb-6">
          <div className="space-y-1">
            <div className={`h-4 w-32 ${shimmerClass}`} />
            <div className={`h-3 w-24 ${shimmerClass}`} />
          </div>
          <div className={`h-4 w-16 ${shimmerClass}`} />
        </div>
        {/* Mock graph bars inside the chart */}
        <div className="flex items-end justify-between gap-3 h-48 pt-4 px-2">
          <div className={`w-8 h-2/3 ${shimmerClass}`} />
          <div className={`w-8 h-1/2 ${shimmerClass}`} />
          <div className={`w-8 h-4/5 ${shimmerClass}`} />
          <div className={`w-8 h-1/3 ${shimmerClass}`} />
          <div className={`w-8 h-3/4 ${shimmerClass}`} />
          <div className={`w-8 h-2/5 ${shimmerClass}`} />
          <div className={`w-8 h-5/6 ${shimmerClass}`} />
        </div>
      </div>
    );
  }

  if (type === "detail") {
    return (
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 w-full">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className={`h-3.5 w-1/4 ${shimmerClass}`} />
            <div className={`h-5 w-1/2 ${shimmerClass}`} />
          </div>
          <div className={`h-5 w-20 ${shimmerClass}`} />
        </div>
        <div className={`h-40 w-full ${shimmerClass}`} />
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <div className={`h-3 w-24 ${shimmerClass}`} />
            <div className={`h-3.5 w-full ${shimmerClass}`} />
            <div className={`h-3.5 w-5/6 ${shimmerClass}`} />
          </div>
          <div className="space-y-1">
            <div className={`h-3 w-32 ${shimmerClass}`} />
            <div className={`h-3.5 w-2/3 ${shimmerClass}`} />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
