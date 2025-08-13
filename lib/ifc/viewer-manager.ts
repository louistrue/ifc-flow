import { IfcViewer } from './viewer-utils';

/**
 * Singleton manager for IFC viewers across the application
 * Provides centralized access to active viewers for geometry nodes
 */
class ViewerManager {
  private static instance: ViewerManager;
  private viewers: Map<string, IfcViewer> = new Map();
  private activeViewerId: string | null = null;

  private constructor() {}

  static getInstance(): ViewerManager {
    if (!ViewerManager.instance) {
      ViewerManager.instance = new ViewerManager();
    }
    return ViewerManager.instance;
  }

  /**
   * Register a viewer instance with a unique ID (typically node ID)
   */
  registerViewer(id: string, viewer: IfcViewer): void {
    console.log(`Registering viewer: ${id}`);
    this.viewers.set(id, viewer);
    
    // Set as active if it's the first viewer or if no active viewer
    if (!this.activeViewerId || this.viewers.size === 1) {
      this.setActiveViewer(id);
    }

    // Listen for model events to potentially update active status
    viewer.on('modelLoaded', (data) => {
      console.log(`Viewer ${id} loaded model: ${data.modelName} with ${data.elementCount} elements`);
      // Auto-set as active when a model is loaded
      this.setActiveViewer(id);
    });

    viewer.on('modelCleared', () => {
      console.log(`Viewer ${id} cleared model`);
      // If this was the active viewer and it's cleared, find another active one
      if (this.activeViewerId === id) {
        this.findNextActiveViewer();
      }
    });
  }

  /**
   * Unregister a viewer
   */
  unregisterViewer(id: string): void {
    console.log(`Unregistering viewer: ${id}`);
    this.viewers.delete(id);
    
    if (this.activeViewerId === id) {
      this.findNextActiveViewer();
    }
  }

  /**
   * Set the active viewer by ID
   */
  setActiveViewer(id: string): void {
    if (this.viewers.has(id)) {
      this.activeViewerId = id;
      console.log(`Active viewer set to: ${id}`);
    } else {
      console.warn(`Cannot set active viewer: ${id} not found`);
    }
  }

  /**
   * Get the currently active viewer
   */
  getActiveViewer(): IfcViewer | null {
    if (!this.activeViewerId) return null;
    return this.viewers.get(this.activeViewerId) || null;
  }

  /**
   * Get a specific viewer by ID
   */
  getViewer(id: string): IfcViewer | null {
    return this.viewers.get(id) || null;
  }

  /**
   * Get all registered viewer IDs
   */
  getViewerIds(): string[] {
    return Array.from(this.viewers.keys());
  }

  /**
   * Get the active viewer ID
   */
  getActiveViewerId(): string | null {
    return this.activeViewerId;
  }

  /**
   * Execute a function with the active viewer if available
   * Provides safe access pattern for nodes
   */
  withActiveViewer<T>(fn: (viewer: IfcViewer) => T): T | null {
    const viewer = this.getActiveViewer();
    if (!viewer) {
      console.warn('No active viewer available for operation');
      return null;
    }
    
    try {
      return fn(viewer);
    } catch (error) {
      console.error('Error executing operation with active viewer:', error);
      return null;
    }
  }

  /**
   * Execute a function with a specific viewer if available
   */
  withViewer<T>(id: string, fn: (viewer: IfcViewer) => T): T | null {
    const viewer = this.getViewer(id);
    if (!viewer) {
      console.warn(`Viewer ${id} not available for operation`);
      return null;
    }
    
    try {
      return fn(viewer);
    } catch (error) {
      console.error(`Error executing operation with viewer ${id}:`, error);
      return null;
    }
  }

  /**
   * Check if there's an active viewer with a loaded model
   */
  hasActiveModel(): boolean {
    const viewer = this.getActiveViewer();
    return viewer ? viewer.getElementCount() > 0 : false;
  }

  /**
   * Get statistics about all viewers
   */
  getStats(): {
    totalViewers: number;
    activeViewerId: string | null;
    viewersWithModels: number;
    totalElements: number;
  } {
    let viewersWithModels = 0;
    let totalElements = 0;

    this.viewers.forEach(viewer => {
      const elementCount = viewer.getElementCount();
      if (elementCount > 0) {
        viewersWithModels++;
        totalElements += elementCount;
      }
    });

    return {
      totalViewers: this.viewers.size,
      activeViewerId: this.activeViewerId,
      viewersWithModels,
      totalElements
    };
  }

  /**
   * Find and set the next available viewer with a model as active
   */
  private findNextActiveViewer(): void {
    // First try to find a viewer with a loaded model
    for (const [id, viewer] of this.viewers) {
      if (viewer.getElementCount() > 0) {
        this.setActiveViewer(id);
        return;
      }
    }

    // If no viewer has a model, just pick the first available
    const firstId = this.viewers.keys().next().value;
    if (firstId) {
      this.setActiveViewer(firstId);
    } else {
      this.activeViewerId = null;
      console.log('No viewers available, cleared active viewer');
    }
  }
}

// Export singleton instance
export const viewerManager = ViewerManager.getInstance();

// Export utility functions for common operations
export const withActiveViewer = <T>(fn: (viewer: IfcViewer) => T): T | null => {
  return viewerManager.withActiveViewer(fn);
};

export const withViewer = <T>(id: string, fn: (viewer: IfcViewer) => T): T | null => {
  return viewerManager.withViewer(id, fn);
};

export const getActiveViewer = (): IfcViewer | null => {
  return viewerManager.getActiveViewer();
};

export const hasActiveModel = (): boolean => {
  return viewerManager.hasActiveModel();
};
