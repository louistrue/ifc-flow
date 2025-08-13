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

  // Generate a thumbnail from flow data (simplified version)
  generateThumbnail(flowData: any): string {
    // In a real implementation, this would create a visual thumbnail
    // For now, we'll return a placeholder
    return "/placeholder.svg?height=200&width=300";
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
