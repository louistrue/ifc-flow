export interface Workflow {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  thumbnail?: string;
  flowData: any;
}

// Check if localStorage is available (not available during SSR)
const isLocalStorageAvailable = () => {
  if (typeof window === 'undefined') return false;
  try {
    const testKey = 'test-localStorage';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

// Storage service for workflows
export class WorkflowStorage {
  private storageKey = "ifcflow-workflows";

  // Get all workflows
  getWorkflows(): Workflow[] {
    try {
      if (!isLocalStorageAvailable()) {
        console.warn("localStorage not available, returning empty workflow array");
        return [];
      }
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Error loading workflows:", error);
      return [];
    }
  }

  // Get a single workflow by ID
  getWorkflow(id: string): Workflow | null {
    const workflows = this.getWorkflows();
    return workflows.find((workflow) => workflow.id === id) || null;
  }

  // Save a workflow
  saveWorkflow(workflow: Workflow): Workflow {
    if (!isLocalStorageAvailable()) {
      console.warn("localStorage not available, workflow not saved");
      return workflow;
    }

    // Clean the workflow data before saving
    const cleanedWorkflow = {
      ...workflow,
      flowData: cleanWorkflowData(workflow.flowData)
    };

    const workflows = this.getWorkflows();
    const existingIndex = workflows.findIndex((w) => w.id === cleanedWorkflow.id);

    if (existingIndex >= 0) {
      // Update existing workflow
      workflows[existingIndex] = {
        ...cleanedWorkflow,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Add new workflow
      workflows.push({
        ...cleanedWorkflow,
        id: cleanedWorkflow.id || crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    localStorage.setItem(this.storageKey, JSON.stringify(workflows));
    return cleanedWorkflow;
  }

  // Delete a workflow
  deleteWorkflow(id: string): boolean {
    if (!isLocalStorageAvailable()) {
      console.warn("localStorage not available, workflow not deleted");
      return false;
    }

    const workflows = this.getWorkflows();
    const filteredWorkflows = workflows.filter(
      (workflow) => workflow.id !== id
    );

    if (filteredWorkflows.length !== workflows.length) {
      localStorage.setItem(this.storageKey, JSON.stringify(filteredWorkflows));
      return true;
    }

    return false;
  }

  // Generate a thumbnail from flow data (client-only, renders offscreen ReactFlow)
  async generateThumbnail(flowData: any): Promise<string> {
    const placeholder = "/placeholder.svg?height=200&width=300";
    if (typeof window === 'undefined') return placeholder;

    try {
      const hasNodes = Array.isArray(flowData?.nodes) && flowData.nodes.length > 0;
      const hasEdges = Array.isArray(flowData?.edges);
      if (!hasNodes) return placeholder;

      const [{ toPng }, React, ReactDOMClient, ReactFlowModule, nodesModule] = await Promise.all([
        import('html-to-image'),
        import('react'),
        import('react-dom/client'),
        import('reactflow'),
        import('@/components/nodes'),
      ]);

      const nodeTypes = (nodesModule as any).nodeTypes || undefined;
      const ReactFlowComponent = (ReactFlowModule as any).default;
      const Background = (ReactFlowModule as any).Background;
      const ReactFlowProvider = (ReactFlowModule as any).ReactFlowProvider;

      // Simplify nodes to avoid heavy custom renderers during thumbnailing
      const thumbnailNodes = (flowData.nodes as any[]).map((n: any) => ({
        id: n.id,
        type: 'default',
        position: n.position,
        style: { width: 140, height: 44 },
        data: { label: n.data?.label ?? n.type ?? 'Node' },
      }));
      const thumbnailEdges = (hasEdges ? flowData.edges : []).map((e: any, idx: number) => ({
        id: e.id ?? `e-${idx}`,
        source: e.source,
        target: e.target,
        label: e.label,
        type: e.type,
      }));

      // Offscreen container
      const width = 300;
      const height = 200;
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-10000px';
      container.style.left = '-10000px';
      container.style.width = `${width}px`;
      container.style.height = `${height}px`;
      container.style.pointerEvents = 'none';
      container.style.background = 'white';
      document.body.appendChild(container);

      const root = (ReactDOMClient as any).createRoot(container);

      const onInit = (instance: any) => {
        try {
          if (flowData?.viewport) {
            instance.setViewport?.(flowData.viewport);
          } else {
            instance.fitView?.({ padding: 0.15, duration: 0 });
          }
        } catch { }
      };

      // Precompute viewport to avoid blank captures
      let computedViewport: { x: number; y: number; zoom: number } | undefined;
      try {
        if (!flowData?.viewport && thumbnailNodes.length > 0) {
          const padding = 16;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const n of thumbnailNodes as any[]) {
            const w = n.style?.width ?? 140;
            const h = n.style?.height ?? 44;
            const x1 = n.position?.x ?? 0;
            const y1 = n.position?.y ?? 0;
            const x2 = x1 + w;
            const y2 = y1 + h;
            if (x1 < minX) minX = x1;
            if (y1 < minY) minY = y1;
            if (x2 > maxX) maxX = x2;
            if (y2 > maxY) maxY = y2;
          }
          const contentW = Math.max(1, maxX - minX);
          const contentH = Math.max(1, maxY - minY);
          const scaleX = width / (contentW + padding * 2);
          const scaleY = height / (contentH + padding * 2);
          const zoom = Math.max(0.1, Math.min(2, Math.min(scaleX, scaleY)));
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const x = (width / 2) - centerX * zoom;
          const y = (height / 2) - centerY * zoom;
          computedViewport = { x, y, zoom };
        }
      } catch { }

      // Render ReactFlow offscreen
      root.render(
        React.createElement(
          ReactFlowProvider,
          null,
          React.createElement(
            ReactFlowComponent,
            {
              nodes: thumbnailNodes,
              edges: thumbnailEdges,
              nodeTypes,
              fitView: !(flowData?.viewport || computedViewport),
              defaultViewport: flowData?.viewport || computedViewport,
              minZoom: 0.1,
              maxZoom: 2,
              nodesDraggable: false,
              nodesConnectable: false,
              elementsSelectable: false,
              panOnDrag: false,
              panOnScroll: false,
              zoomOnScroll: false,
              zoomOnPinch: false,
              zoomOnDoubleClick: false,
              onInit,
              proOptions: { hideAttribution: true },
              style: { width: `${width}px`, height: `${height}px`, background: 'white' },
            },
            React.createElement(Background, { color: '#e5e7eb', gap: 12 })
          )
        )
      );

      // Allow layout to settle
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Capture
      const dataUrl = await toPng(container, {
        cacheBust: true,
        width,
        height,
        style: { background: 'white' },
      });

      // Cleanup
      try { root.unmount(); } catch { }
      try { document.body.removeChild(container); } catch { }

      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image') && dataUrl.length > 1000) {
        return dataUrl;
      }

      // Fallback: draw a simple thumbnail using Canvas (no ReactFlow)
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2D context');

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Compute bounds
        const nodesArr = (flowData.nodes as any[]) as Array<{ id: string; position: { x: number; y: number }; }>;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodesArr) {
          const x = n.position?.x ?? 0;
          const y = n.position?.y ?? 0;
          const w = 140;
          const h = 44;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x + w > maxX) maxX = x + w;
          if (y + h > maxY) maxY = y + h;
        }
        if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return placeholder;

        const padding = 24;
        const contentW = Math.max(1, maxX - minX);
        const contentH = Math.max(1, maxY - minY);
        const scale = Math.max(0.1, Math.min((width - padding * 2) / contentW, (height - padding * 2) / contentH));
        const offsetX = (width - contentW * scale) / 2 - minX * scale;
        const offsetY = (height - contentH * scale) / 2 - minY * scale;

        // Draw edges
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2;
        const edgesArr = (hasEdges ? flowData.edges : []) as Array<{ source: string; target: string }>;
        const idToPos = new Map<string, { x: number; y: number }>();
        for (const n of nodesArr) {
          idToPos.set(n.id, { x: n.position?.x ?? 0, y: n.position?.y ?? 0 });
        }
        for (const e of edgesArr) {
          const s = idToPos.get(e.source);
          const t = idToPos.get(e.target);
          if (!s || !t) continue;
          const sx = offsetX + (s.x + 140) * scale;
          const sy = offsetY + (s.y + 22) * scale;
          const tx = offsetX + t.x * scale;
          const ty = offsetY + (t.y + 22) * scale;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        }

        // Draw nodes
        for (const n of nodesArr) {
          const x = offsetX + (n.position?.x ?? 0) * scale;
          const y = offsetY + (n.position?.y ?? 0) * scale;
          const w = 140 * scale;
          const h = 44 * scale;
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          const r = 6 * scale;
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Label
          const label = (flowData.nodes.find((nn: any) => nn.id === n.id)?.data?.label) ?? 'Node';
          ctx.fillStyle = '#0f172a';
          ctx.font = `${Math.max(10, 12 * scale)}px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.fillText(String(label).slice(0, 18), x + 8 * scale, y + h / 2);
        }

        return canvas.toDataURL('image/png');
      } catch {
        // Ignore and return placeholder
      }

      return placeholder;
    } catch (error) {
      console.warn('Thumbnail generation failed:', error);
      return placeholder;
    }
  }

  // Export workflow to file
  exportWorkflow(workflow: Workflow): void {
    if (typeof window === 'undefined') {
      console.warn("Cannot export workflow in server-side context");
      return;
    }

    // Clean the workflow data before exporting
    const cleanedWorkflow = {
      ...workflow,
      flowData: cleanWorkflowData(workflow.flowData)
    };

    const json = JSON.stringify(cleanedWorkflow, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflow.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import workflow from file
  async importWorkflow(file: File): Promise<Workflow> {
    if (!isLocalStorageAvailable()) {
      return Promise.reject(new Error("localStorage not available"));
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          if (!event.target) {
            reject(new Error("Error reading file: No data received"));
            return;
          }

          const workflow = JSON.parse(
            event.target.result as string
          ) as Workflow;
          // Update timestamps
          workflow.updatedAt = new Date().toISOString();
          // Save to storage
          this.saveWorkflow(workflow);
          resolve(workflow);
        } catch (error) {
          reject(new Error("Invalid workflow file"));
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsText(file);
    });
  }
}

// Utility function to clean workflow data before saving
// Removes IFC model data and other heavy data from nodes
export function cleanWorkflowData(flowData: any): any {
  if (!flowData) return flowData;

  // Create a deep copy to avoid mutating the original
  const cleanedData = JSON.parse(JSON.stringify(flowData));

  // Clean nodes if they exist
  if (cleanedData.nodes && Array.isArray(cleanedData.nodes)) {
    cleanedData.nodes = cleanedData.nodes.map((node: any) => {
      // Create a clean copy of the node
      const cleanNode = { ...node };

      // Clean the node data
      if (cleanNode.data) {
        const cleanData = { ...cleanNode.data };

        // For IFC nodes, remove the actual model data
        if (node.type === 'ifcNode') {
          // Remove heavy data properties
          delete cleanData.model;
          delete cleanData.modelInfo;
          delete cleanData.file;
          delete cleanData.fileHandle;
          delete cleanData.modelState;
          delete cleanData.elements;

          // Keep only essential properties for restoration
          cleanData.isEmptyNode = true; // Mark as empty for loading
          if (cleanData.properties?.filename) {
            cleanData.fileName = cleanData.properties.filename; // Preserve filename for reference
          }
        }

        // For other nodes that might have cached IFC data
        if (cleanData.modelInfo) {
          delete cleanData.modelInfo;
        }
        if (cleanData.inputData?.value && cleanData.inputData.type === 'ifcModel') {
          // Clear the actual model data but keep the type info
          cleanData.inputData = {
            ...cleanData.inputData,
            value: null,
            isCleared: true
          };
        }

        // Remove any execution results or temporary data
        delete cleanData.executionResult;
        delete cleanData.error;
        delete cleanData.isLoading;
        delete cleanData.progress;

        cleanNode.data = cleanData;
      }

      return cleanNode;
    });
  }

  return cleanedData;
}

// Create a singleton instance
export const workflowStorage = new WorkflowStorage();
