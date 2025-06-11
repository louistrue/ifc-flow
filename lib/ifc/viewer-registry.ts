import type { IfcViewer } from "./viewer-utils";

let activeViewerInstance: IfcViewer | null = null;
let activeViewerId: string | null = null;

/**
 * Registers an IfcViewer instance as the currently active one.
 * @param viewer The IfcViewer instance.
 */
export function registerActiveViewer(viewer: IfcViewer): void {
    const newId = viewer.getId();
    if (activeViewerInstance && activeViewerId !== newId) {
        console.warn(`Replacing active viewer ${activeViewerId} with ${newId}`);
        // Optionally call dispose on the old one if needed?
    }
    activeViewerInstance = viewer;
    activeViewerId = newId;
    console.log(`%cViewer Registry: Registered ${activeViewerId} as active.`, 'color: green;');
}

/**
 * Unregisters an IfcViewer instance if it's the currently active one.
 * @param viewerId The ID of the viewer to unregister.
 */
export function unregisterActiveViewer(viewerId: string): void {
    if (activeViewerId === viewerId) {
        activeViewerInstance = null;
        activeViewerId = null;
        console.log(`%cViewer Registry: Unregistered ${viewerId}. Active viewer is now null.`, 'color: orange;');
    } else if (activeViewerId && viewerId) {
        console.warn(`Viewer Registry: Attempted to unregister ${viewerId}, but active viewer is ${activeViewerId}.`);
    }
}

/**
 * Gets the currently active IfcViewer instance.
 * @returns The active IfcViewer instance or null.
 */
export function getActiveViewer(): IfcViewer | null {
    // console.log(`Viewer Registry: getActiveViewer called. Returning instance with ID: ${activeViewerId ?? 'null'}`);
    return activeViewerInstance;
} 