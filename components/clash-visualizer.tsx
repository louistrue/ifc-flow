"use client"

import { useEffect, useState } from "react"
import * as THREE from "three"
import { initClashHandler, clashVisualizerInstance } from "@/lib/ifc/analysis-utils"
import type { IfcViewer } from "@/lib/ifc/viewer-utils"

interface ClashVisualizerProps {
    viewer: IfcViewer | null
    clashResults?: any
}

export function ClashVisualizer({ viewer, clashResults }: ClashVisualizerProps) {
    const [initialized, setInitialized] = useState(false)

    // Initialize the clash handler when the viewer instance is available
    useEffect(() => {
        if (viewer && !initialized) {
            console.log("Initializing clash handler with viewer instance")
            initClashHandler(viewer)
            setInitialized(true)
        }
        // Clean up if viewer becomes null
        if (!viewer && initialized) {
            initClashHandler(null)
            setInitialized(false)
        }
    }, [viewer, initialized])

    // Visualize clash results when they change
    useEffect(() => {
        // Use clashVisualizerInstance which is set by initClashHandler
        if (initialized && clashVisualizerInstance && clashResults) {
            console.log("Visualizing clash results via instance:", clashResults)
            clashVisualizerInstance.visualizeClashes(clashResults)

            // Clean up visualization when component unmounts or results clear
            return () => {
                if (clashVisualizerInstance) {
                    clashVisualizerInstance.clearClashes()
                }
            }
        } else if (initialized && clashVisualizerInstance && !clashResults) {
            // Clear visualization if results become null/undefined
            clashVisualizerInstance.clearClashes()
        }
    }, [clashResults, initialized])

    // This component doesn't render anything directly
    return null
}

export default ClashVisualizer 