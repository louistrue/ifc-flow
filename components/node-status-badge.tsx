"use client";

import { Badge } from "@/components/ui/badge";
import { Wrench, Sparkles } from "lucide-react";

export type NodeStatus = "working" | "wip" | "new";

interface NodeStatusBadgeProps {
  status: NodeStatus;
}

export function NodeStatusBadge({ status }: NodeStatusBadgeProps) {
  if (status === "wip") {
    return (
      <Badge
        variant="outline"
        className="border-amber-500 text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800 px-1.5 py-0.5 text-xs font-normal h-5 ml-1"
      >
        <Wrench className="h-3 w-3 mr-1" />
        WIP
      </Badge>
    );
  }

  if (status === "new") {
    return (
      <Badge
        variant="outline"
        className="border-teal-500 text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-950 dark:border-teal-800 px-1.5 py-0.5 text-xs font-normal h-5 ml-1"
      >
        <Sparkles className="h-3 w-3 mr-1" />
        New
      </Badge>
    );
  }

  return null; // No badge for 'working' status
}
