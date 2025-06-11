"use client"

import { memo, useState, useEffect, useCallback } from "react"
import { Handle, Position, type NodeProps, useReactFlow } from "reactflow"
import { AlertTriangle, Eye, Table, Square, Copy } from "lucide-react"
import { AnalysisNodeData } from "./node-types"
import { performClashDetection } from "@/lib/ifc/analysis-utils"
import type { Node } from "reactflow"

export const AnalysisNode = memo(({ data, id, isConnectable }: NodeProps<AnalysisNodeData>) => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const { getEdges, getNode, setNodes, getNodes } = useReactFlow()

  // Local state for tolerance
  const [localTolerance, setLocalTolerance] = useState<number>(() => {
    const initialTolerance = data.properties?.tolerance;
    return typeof initialTolerance === 'number' ? initialTolerance :
      typeof initialTolerance === 'string' ? parseFloat(initialTolerance) || 10 : 10;
  });

  // Update node data when local tolerance changes
  const updateNodeTolerance = useCallback(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              properties: {
                ...n.data.properties,
                tolerance: localTolerance, // Update with local state
              },
            },
          };
        }
        return n;
      })
    );
  }, [id, localTolerance, setNodes]);

  // Effect to sync local state with node data (e.g., on load)
  useEffect(() => {
    const nodeTolerance = data.properties?.tolerance;
    const numericTolerance = typeof nodeTolerance === 'number' ? nodeTolerance :
      typeof nodeTolerance === 'string' ? parseFloat(nodeTolerance) || 10 : 10;
    if (numericTolerance !== localTolerance) {
      setLocalTolerance(numericTolerance);
    }
  }, [data.properties?.tolerance]); // Only trigger when node data tolerance changes

  // Effect to update the node data property when localTolerance changes
  useEffect(() => {
    updateNodeTolerance();
  }, [localTolerance, updateNodeTolerance]);

  // Analysis Effect - Depends on the whole nodes array now
  useEffect(() => {
    // Get nodes *inside* the effect
    const allNodes = getNodes();
    console.log("AnalysisNode: Effect triggered by nodes array change or tolerance.", { nodesLength: allNodes.length, localTolerance });

    const performAnalysis = async () => {
      setLoading(true);
      setResults(null);

      try {
        // Get Edges and Nodes within the effect
        const currentEdges = getEdges();
        const inputEdge = currentEdges.find(edge => edge.target === id && edge.targetHandle === "input");
        const referenceEdge = currentEdges.find(edge => edge.target === id && edge.targetHandle === "reference");

        if (!inputEdge || !referenceEdge) {
          setResults({ error: "Connect both primary and reference elements" });
          setLoading(false); return;
        }

        const inputNode = getNode(inputEdge.source);
        const referenceNode = getNode(referenceEdge.source);
        if (!inputNode || !referenceNode) {
          setResults({ error: "Input nodes not found" });
          setLoading(false); return;
        }

        // Get Element Data
        const primaryInputData = inputNode.data?.outputData;
        const referenceInputData = referenceNode.data?.outputData;
        const primaryElements = primaryInputData?.value;
        const referenceElements = referenceInputData?.value;

        // Validate Element Data
        if (!primaryInputData || primaryInputData.type === 'error' || primaryInputData.type === 'loading' || !Array.isArray(primaryElements) || primaryElements.length === 0) {
          setResults({ error: "Waiting for or invalid primary input" });
          setLoading(false); return;
        }
        if (!referenceInputData || referenceInputData.type === 'error' || referenceInputData.type === 'loading' || !Array.isArray(referenceElements) || referenceElements.length === 0) {
          setResults({ error: "Waiting for or invalid reference input" });
          setLoading(false); return;
        }

        // Check Viewer Readiness using the `allNodes` array fetched at the start of the effect
        const viewerNode = allNodes.find((n: Node) => n.type === 'viewerNode'); // Type node as Node
        const viewerIsReady = viewerNode?.data?.viewerState?.isReady ?? false;
        console.log(`AnalysisNode ${id}: Found viewer node ${viewerNode?.id}. IsReady = ${viewerIsReady}`);

        if (!viewerIsReady) {
          console.log(`AnalysisNode ${id}: Viewer is not ready yet.`);
          setResults({ status: 'viewer_not_ready', message: `Waiting for viewer...`, clashes: 0, details: [] });
          setLoading(false); return;
        }

        console.log(`AnalysisNode: Running clash with tolerance ${localTolerance}mm (Viewer ready)`);
        const analysisResults = await performClashDetection(
          primaryElements,
          referenceElements,
          { tolerance: localTolerance, showIn3DViewer: true }
        );
        setResults(analysisResults);

      } catch (error) {
        console.error("Clash detection error:", error);
        setResults({ error: "Failed to perform clash detection" });
      } finally {
        setLoading(false);
      }
    };

    performAnalysis();
    // Depend on getNodes and localTolerance.
    // Changes to node data will cause getNodes to potentially return a different reference (or internal changes)
    // which should trigger the effect correctly.
  }, [localTolerance, id, getEdges, getNode, getNodes]); // Corrected spelling

  // Propagate results to the appropriate output handles
  useEffect(() => {
    if (results) {
      setNodes(nds =>
        nds.map((n: Node) => { // Type node as Node
          if (n.id === id) {
            return { ...n, data: { ...n.data, outputData: { type: "clashResults", value: results }, visualizationData: { type: "clashResults", value: results } } };
          }
          return n;
        })
      );
    }
  }, [results, id, setNodes]);

  // Calculate clash severity color
  const getSeverityColor = () => {
    if (!results || results.error) return "bg-gray-200 text-gray-600"

    const clashCount = results.clashes || 0
    if (clashCount === 0) return "bg-green-100 text-green-700"
    if (clashCount < 10) return "bg-yellow-100 text-yellow-700"
    return "bg-red-100 text-red-700"
  }

  // Handle tolerance input change
  const handleToleranceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty input temporarily, default to 0 if empty, parse otherwise
    const newTolerance = value === '' ? 0 : parseFloat(value);
    if (!isNaN(newTolerance) && newTolerance >= 0) { // Prevent negative tolerance
      setLocalTolerance(newTolerance);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-red-500 dark:border-red-400 rounded-md w-56 shadow-md relative">
      <div className="bg-red-500 text-white px-3 py-1 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4" />
        <div className="text-sm font-medium truncate">Clash Detection</div>
      </div>
      <div className="p-3 text-xs">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span>Analysis:</span>
            <span className="font-medium">Clash Detection</span>
          </div>

          {/* Tolerance Input */}
          <div className="flex justify-between items-center">
            <label htmlFor={`tolerance-${id}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300">Tolerance (mm):</label>
            <input
              id={`tolerance-${id}`}
              type="number"
              value={localTolerance} // Bind to local state
              onChange={handleToleranceChange} // Update local state
              min="0"
              step="1" // Adjust step as needed
              className="nodrag w-16 p-1 text-xs border rounded bg-white dark:bg-gray-700 dark:text-gray-200 text-right"
            />
          </div>

          {/* Results section */}
          {loading ? (
            <div className="mt-2 text-blue-500">
              Running clash detection...
            </div>
          ) : results?.status === 'viewer_not_ready' ? (
            <div className="mt-2 text-orange-500 italic">
              Waiting for 3D viewer to finish loading geometry...
            </div>
          ) : results?.error ? (
            <div className="mt-2 text-red-500">
              {results.error}
            </div>
          ) : results ? (
            <div className="mt-2 space-y-1.5">
              <div className={`${getSeverityColor()} px-2 py-1 rounded-md font-medium`}>
                {results.clashes} clash{results.clashes !== 1 ? "es" : ""} found
              </div>

              {results.clashes > 0 && (
                <div className="text-xs text-gray-500">
                  Visualized in 3D viewer
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 text-gray-400 italic">Connect elements to run...</div>
          )}

          <div className="mt-2 flex items-center justify-between text-xs text-blue-500">
            <span>Primary</span>
            <span>Reference</span>
          </div>
        </div>
      </div>

      {/* Primary Input Label */}
      <div
        className="absolute left-[-20px] top-[calc(35%-8px)] text-gray-400 dark:text-gray-500 p-0.5 rounded bg-gray-100 dark:bg-gray-700 shadow"
        title="Primary Elements"
      >
        <Square size={12} />
      </div>
      {/* Reference Input Label */}
      <div
        className="absolute left-[-20px] top-[calc(65%-8px)] text-purple-400 dark:text-purple-300 p-0.5 rounded bg-gray-100 dark:bg-gray-700 shadow"
        title="Reference Elements"
      >
        <Copy size={12} />
      </div>
      {/* Results Output Label */}
      <div
        className="absolute right-[-20px] top-[calc(35%-8px)] text-gray-400 dark:text-gray-500 p-0.5 rounded bg-gray-100 dark:bg-gray-700 shadow"
        title="Clash Results Data"
      >
        <Table size={12} />
      </div>
      {/* Visualization Output Label */}
      <div
        className="absolute right-[-20px] top-[calc(65%-8px)] text-green-500 dark:text-green-400 p-0.5 rounded bg-gray-100 dark:bg-gray-700 shadow"
        title="Clash Visualization"
      >
        <Eye size={12} />
      </div>

      {/* Input Handles (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="input" // Primary input
        style={{ background: "#555", width: 8, height: 8, top: '35%' }} // Positioned higher
        isConnectable={isConnectable}
      />
      <Handle
        type="target"
        position={Position.Left} // Moved to Left
        id="reference"
        style={{ background: "#7c3aed", width: 8, height: 8, top: '65%' }} // Positioned lower
        isConnectable={isConnectable}
      />

      {/* Output Handles (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output" // Main data output (for WatchNode etc.)
        style={{ background: "#555", width: 8, height: 8, top: '35%' }} // Positioned higher
        isConnectable={isConnectable}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="visualization" // Output for viewer
        style={{ background: "#22c55e", width: 8, height: 8, top: '65%' }} // Positioned lower, green color
        isConnectable={isConnectable}
      />
    </div>
  )
})

AnalysisNode.displayName = "AnalysisNode"

