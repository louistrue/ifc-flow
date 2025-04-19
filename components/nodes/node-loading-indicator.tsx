"use client";

import { Loader2 } from "lucide-react";

interface NodeLoadingIndicatorProps {
  isLoading: boolean;
  message: string; // e.g., "Loading IFC file...", "Processing Geometry..."
  progressMessage?: string;
  percentage?: number;
}

export function NodeLoadingIndicator({
  isLoading,
  message,
  progressMessage,
  percentage,
}: NodeLoadingIndicatorProps) {
  if (!isLoading) {
    return null;
  }

  const showProgress = typeof percentage === "number" && percentage > 0;

  return (
    <div className="space-y-1 p-3 text-xs">
      <div className="flex items-start gap-2 text-blue-500 w-full min-h-[28px]">
        <Loader2 className="h-3 w-3 animate-spin flex-shrink-0 mt-0.5" />
        <span>{message}</span>
      </div>
      <div className="space-y-1 pl-5 min-h-[28px]">
        {showProgress && (
          <>
            <div className="h-7 overflow-hidden">
              {progressMessage && (
                <div
                  className="text-xs text-gray-500 w-full"
                  title={progressMessage}
                >
                  {progressMessage}
                </div>
              )}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
