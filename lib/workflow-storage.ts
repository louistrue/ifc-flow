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

    const workflows = this.getWorkflows();
    const existingIndex = workflows.findIndex((w) => w.id === workflow.id);

    if (existingIndex >= 0) {
      // Update existing workflow
      workflows[existingIndex] = {
        ...workflow,
        updatedAt: new Date().toISOString(),
      };
    } else {
      // Add new workflow
      workflows.push({
        ...workflow,
        id: workflow.id || crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    localStorage.setItem(this.storageKey, JSON.stringify(workflows));
    return workflow;
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

    const json = JSON.stringify(workflow, null, 2);
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

// Create a singleton instance
export const workflowStorage = new WorkflowStorage();
