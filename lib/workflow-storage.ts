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

  // Generate a thumbnail from flow data using Canvas (simple and reliable)
  async generateThumbnail(flowData: any): Promise<string> {
    if (typeof window === 'undefined') return '';

    try {
      const hasNodes = Array.isArray(flowData?.nodes) && flowData.nodes.length > 0;
      const hasEdges = Array.isArray(flowData?.edges);
      if (!hasNodes) return '';

      const width = 300;
      const height = 200;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('Canvas 2D context not available');
        return '';
      }

      // Polyfill for roundRect - provides fallback for older browsers
      const drawRoundRect = (
        context: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        radii: number | number[]
      ) => {
        // Normalize radii to array format [topLeft, topRight, bottomRight, bottomLeft]
        let r: number[];
        if (typeof radii === 'number') {
          r = [radii, radii, radii, radii];
        } else if (radii.length === 1) {
          r = [radii[0], radii[0], radii[0], radii[0]];
        } else if (radii.length === 2) {
          r = [radii[0], radii[1], radii[0], radii[1]];
        } else if (radii.length === 4) {
          r = radii;
        } else {
          r = [0, 0, 0, 0];
        }

        // Clamp radii to half of smallest dimension
        const maxRadius = Math.min(w, h) / 2;
        r = r.map(radius => Math.min(radius, maxRadius));

        context.moveTo(x + r[0], y);
        context.lineTo(x + w - r[1], y);
        context.quadraticCurveTo(x + w, y, x + w, y + r[1]);
        context.lineTo(x + w, y + h - r[2]);
        context.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
        context.lineTo(x + r[3], y + h);
        context.quadraticCurveTo(x, y + h, x, y + h - r[3]);
        context.lineTo(x, y + r[0]);
        context.quadraticCurveTo(x, y, x + r[0], y);
        context.closePath();
      };

      // Background with subtle grid pattern
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, width, height);

      // Draw grid dots
      ctx.fillStyle = '#e5e7eb';
      for (let gx = 0; gx < width; gx += 16) {
        for (let gy = 0; gy < height; gy += 16) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Compute bounds from nodes
      const nodesArr = flowData.nodes as Array<{ id: string; type?: string; position: { x: number; y: number }; data?: { label?: string } }>;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const nodeWidth = 140;
      const nodeHeight = 44;

      for (const n of nodesArr) {
        const x = n.position?.x ?? 0;
        const y = n.position?.y ?? 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + nodeWidth > maxX) maxX = x + nodeWidth;
        if (y + nodeHeight > maxY) maxY = y + nodeHeight;
      }

      if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
        return '';
      }

      // Calculate scale and offset to fit nodes in canvas
      const padding = 24;
      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);
      const scale = Math.max(0.15, Math.min(1.5, Math.min(
        (width - padding * 2) / contentW,
        (height - padding * 2) / contentH
      )));
      const offsetX = (width - contentW * scale) / 2 - minX * scale;
      const offsetY = (height - contentH * scale) / 2 - minY * scale;

      // Build position map for edges
      const idToPos = new Map<string, { x: number; y: number }>();
      for (const n of nodesArr) {
        idToPos.set(n.id, { x: n.position?.x ?? 0, y: n.position?.y ?? 0 });
      }

      // Draw edges first (behind nodes)
      if (hasEdges) {
        const edgesArr = flowData.edges as Array<{ source: string; target: string; sourceHandle?: string; targetHandle?: string }>;
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = Math.max(1.5, 2 * scale);
        ctx.lineCap = 'round';

        for (const e of edgesArr) {
          const s = idToPos.get(e.source);
          const t = idToPos.get(e.target);
          if (!s || !t) continue;

          // Source: right side of node, Target: left side of node
          const sx = offsetX + (s.x + nodeWidth) * scale;
          const sy = offsetY + (s.y + nodeHeight / 2) * scale;
          const tx = offsetX + t.x * scale;
          const ty = offsetY + (t.y + nodeHeight / 2) * scale;

          // Draw bezier curve for nicer look
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          const cpOffset = Math.min(50, Math.abs(tx - sx) / 2) * scale;
          ctx.bezierCurveTo(sx + cpOffset, sy, tx - cpOffset, ty, tx, ty);
          ctx.stroke();
        }
      }

      // Node type colors
      const nodeColors: Record<string, { bg: string; border: string; accent: string }> = {
        ifcNode: { bg: '#dbeafe', border: '#3b82f6', accent: '#2563eb' },
        filterNode: { bg: '#fef3c7', border: '#f59e0b', accent: '#d97706' },
        aiNode: { bg: '#f3e8ff', border: '#a855f7', accent: '#9333ea' },
        viewerNode: { bg: '#dcfce7', border: '#22c55e', accent: '#16a34a' },
        exportNode: { bg: '#fee2e2', border: '#ef4444', accent: '#dc2626' },
        propertyNode: { bg: '#e0e7ff', border: '#6366f1', accent: '#4f46e5' },
        spatialNode: { bg: '#cffafe', border: '#06b6d4', accent: '#0891b2' },
        geometryNode: { bg: '#fce7f3', border: '#ec4899', accent: '#db2777' },
        materialNode: { bg: '#ffedd5', border: '#f97316', accent: '#ea580c' },
        default: { bg: '#f1f5f9', border: '#64748b', accent: '#475569' },
      };

      // Draw nodes
      for (const n of nodesArr) {
        const x = offsetX + (n.position?.x ?? 0) * scale;
        const y = offsetY + (n.position?.y ?? 0) * scale;
        const w = nodeWidth * scale;
        const h = nodeHeight * scale;
        const r = Math.max(4, 6 * scale);

        const colors = nodeColors[n.type || 'default'] || nodeColors.default;

        // Node shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.beginPath();
        drawRoundRect(ctx, x + 2, y + 2, w, h, r);
        ctx.fill();

        // Node background
        ctx.fillStyle = colors.bg;
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = Math.max(1, 1.5 * scale);
        ctx.beginPath();
        drawRoundRect(ctx, x, y, w, h, r);
        ctx.fill();
        ctx.stroke();

        // Accent bar on left
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        drawRoundRect(ctx, x, y, Math.max(3, 4 * scale), h, [r, 0, 0, r]);
        ctx.fill();

        // Label text
        const label = n.data?.label || n.type || 'Node';
        const fontSize = Math.max(8, Math.min(11, 11 * scale));
        ctx.fillStyle = '#1e293b';
        ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';

        // Truncate label if needed
        const maxTextWidth = w - 12 * scale;
        let displayLabel = String(label);
        while (ctx.measureText(displayLabel).width > maxTextWidth && displayLabel.length > 3) {
          displayLabel = displayLabel.slice(0, -1);
        }
        if (displayLabel !== String(label)) {
          displayLabel = displayLabel.slice(0, -2) + '…';
        }

        ctx.fillText(displayLabel, x + 8 * scale, y + h / 2);
      }

      const dataUrl = canvas.toDataURL('image/png');
      console.log('Thumbnail generated successfully, length:', dataUrl.length);
      return dataUrl;
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return '';
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

// Capture screenshot of ReactFlow canvas
export async function captureCanvasScreenshot(
  element: HTMLElement,
  fitViewCallback?: () => void
): Promise<string> {
  if (typeof window === 'undefined') return '';

  try {
    // Optionally fit view first to ensure all nodes are visible
    if (fitViewCallback) {
      fitViewCallback();
      // Wait for viewport to update - use multiple animation frames for reliable rendering
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      // Additional delay to ensure ReactFlow has fully updated the viewport
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    // Find the ReactFlow container - this has the proper fixed dimensions
    // Don't use .react-flow__viewport as it has transforms applied
    let captureElement: HTMLElement = element;
    const reactFlowContainer = element.querySelector('.react-flow') as HTMLElement;
    if (reactFlowContainer) {
      captureElement = reactFlowContainer;
    }

    // Get the actual dimensions of the element for capture
    const rect = captureElement.getBoundingClientRect();
    const captureWidth = Math.min(rect.width, 1200); // Cap width to avoid huge images
    const captureHeight = Math.min(rect.height, 800);

    // Import html-to-image dynamically
    const { toPng } = await import('html-to-image');

    // Capture the element with proper filtering
    const dataUrl = await toPng(captureElement, {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio: 1,
      quality: 0.95,
      width: captureWidth,
      height: captureHeight,
      filter: (node) => {
        // Exclude controls, minimap, and other UI elements
        const className = (node as HTMLElement).className || '';
        if (typeof className === 'string') {
          // Exclude ReactFlow controls
          if (className.includes('react-flow__controls')) return false;
          if (className.includes('react-flow__minimap')) return false;
          // Exclude any overlay elements
          if (className.includes('react-flow__panel')) return false;
          // Exclude selection overlays
          if (className.includes('react-flow__selection')) return false;
          // Exclude attribution
          if (className.includes('react-flow__attribution')) return false;
        }
        return true;
      },
    });

    if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image') && dataUrl.length > 1000) {
      console.log('Canvas screenshot captured successfully, length:', dataUrl.length);
      return dataUrl;
    }

    console.warn('Screenshot capture returned invalid data URL');
    return '';
  } catch (error) {
    console.error('Failed to capture canvas screenshot:', error);
    return '';
  }
}

// Create a singleton instance
export const workflowStorage = new WorkflowStorage();
