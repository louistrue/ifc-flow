"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FlaskConical, Wrench } from "lucide-react";

export type NodeStatus = "working" | "wip" | "experimental";

interface NodeStatusBadgeProps {
  status: NodeStatus;
}

export function NodeStatusBadge({ status }: NodeStatusBadgeProps) {
  if (status === "wip") {
    return (
      <Badge
        variant="default"
        className="bg-blue-500 hover:bg-blue-600 px-1.5 py-0.5 text-xs font-normal h-5 ml-1"
      >
        <Wrench className="h-3 w-3 mr-1" />
        WIP
      </Badge>
    );
  }

  if (status === "experimental") {
    return (
      <Badge
        variant="outline"
        className="px-1.5 py-0.5 text-xs font-normal h-5 ml-1 border-orange-500 text-orange-500 bg-orange-50"
      >
        <FlaskConical className="h-3 w-3 mr-1" />
        Experimental
      </Badge>
    );
  }

  return null; // No badge for 'working' status
}
