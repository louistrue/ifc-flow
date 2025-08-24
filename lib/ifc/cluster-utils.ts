import * as THREE from "three";
import { IfcElement } from "@/lib/ifc-utils";
import { IfcViewer } from "./viewer-utils";

export interface ClusterConfig {
  groupBy: 'type' | 'level' | 'material' | 'property';
  property?: string;
  pset?: string;
}

export interface Cluster {
  key: string;
  displayName: string;
  elementIds: number[];
  count: number;
  color: THREE.Color;
  bbox: THREE.Box3 | null;
  group: THREE.Group;
  visible: boolean;
}

export interface ClusterSet {
  config: ClusterConfig;
  clusters: Map<string, Cluster>;
  totalElements: number;
  originalParent: THREE.Group | null;
}

/**
 * Predefined color palette for clusters
 */
const CLUSTER_COLORS = [
  0x3498db, // Blue
  0xe74c3c, // Red
  0x2ecc71, // Green
  0xf39c12, // Orange
  0x9b59b6, // Purple
  0x1abc9c, // Turquoise
  0xf1c40f, // Yellow
  0xe67e22, // Dark Orange
  0x34495e, // Dark Blue-Gray
  0x95a5a6, // Gray
  0x8e44ad, // Dark Purple
  0x27ae60, // Dark Green
  0xd35400, // Dark Orange
  0x2c3e50, // Very Dark Blue
  0x7f8c8d, // Dark Gray
];

/**
 * Generate cluster key based on element and config
 */
function generateClusterKey(element: IfcElement, config: ClusterConfig): string {
  switch (config.groupBy) {
    case 'type':
      // Remove 'Ifc' prefix for cleaner display
      return element.type.startsWith('Ifc') ? element.type.substring(3) : element.type;

    case 'property':
      if (!config.property) return 'Unknown';

      // Check in psets first
      if (config.pset && element.psets?.[config.pset]?.[config.property] !== undefined) {
        return String(element.psets[config.pset][config.property]);
      }

      // Check in any pset if no specific pset provided
      if (!config.pset && element.psets) {
        for (const pset of Object.values(element.psets)) {
          if (pset[config.property] !== undefined) {
            return String(pset[config.property]);
          }
        }
      }

      // Check in direct properties
      if (element.properties?.[config.property] !== undefined) {
        return String(element.properties[config.property]);
      }

      return 'Unknown';

    case 'level':
      // This will be enhanced when worker support is added
      // For now, try to extract from common property locations
      if (element.psets?.['Pset_BuildingElementCommon']?.['Reference']) {
        return String(element.psets['Pset_BuildingElementCommon']['Reference']);
      }
      if (element.properties?.['Level']) {
        return String(element.properties['Level']);
      }
      return 'Unknown Level';

    case 'material':
      // This will be enhanced when worker support is added
      // For now, try to extract from common property locations
      if (element.psets?.['Pset_MaterialCommon']?.['Material']) {
        return String(element.psets['Pset_MaterialCommon']['Material']);
      }
      if (element.properties?.['Material']) {
        return String(element.properties['Material']);
      }
      return 'Unknown Material';

    default:
      return 'Unknown';
  }
}

/**
 * Generate display name for cluster key
 */
function generateDisplayName(key: string, config: ClusterConfig): string {
  if (key === 'Unknown') {
    switch (config.groupBy) {
      case 'type': return 'Unknown Type';
      case 'level': return 'Unknown Level';
      case 'material': return 'Unknown Material';
      case 'property': return `Unknown ${config.property || 'Property'}`;
      default: return 'Unknown';
    }
  }
  return key;
}

/**
 * Build clusters from elements
 */
export function buildClusters(
  elements: IfcElement[],
  config: ClusterConfig,
  viewer: IfcViewer
): ClusterSet {
  console.log(`Building clusters: ${config.groupBy}`, config);

  const clusters = new Map<string, Cluster>();
  const modelGroup = viewer.getModelGroup();

  if (!modelGroup) {
    throw new Error('No model group available in viewer for clustering');
  }

  // Group elements by cluster key
  const elementsByCluster = new Map<string, IfcElement[]>();

  elements.forEach(element => {
    const key = generateClusterKey(element, config);
    if (!elementsByCluster.has(key)) {
      elementsByCluster.set(key, []);
    }
    elementsByCluster.get(key)!.push(element);
  });

  console.log(`Generated ${elementsByCluster.size} clusters from ${elements.length} elements`);

  // Create cluster objects
  let colorIndex = 0;
  elementsByCluster.forEach((clusterElements, key) => {
    const elementIds = clusterElements.map(el => el.expressId);
    const color = new THREE.Color(CLUSTER_COLORS[colorIndex % CLUSTER_COLORS.length]);
    colorIndex++;

    // Create group for this cluster
    const group = new THREE.Group();
    group.name = `Cluster_${key}`;

    // Move meshes to cluster group
    const meshes: THREE.Mesh[] = [];
    elementIds.forEach(expressId => {
      const elementMeshes = viewer.getMeshesForElement(expressId);
      elementMeshes.forEach(mesh => {
        // Remove from current parent and add to cluster group
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        group.add(mesh);
        meshes.push(mesh);
      });
    });

    // Calculate bounding box for the cluster
    let bbox: THREE.Box3 | null = null;
    if (meshes.length > 0) {
      bbox = new THREE.Box3();
      meshes.forEach(mesh => {
        mesh.updateMatrixWorld(true);
        const meshBox = new THREE.Box3().setFromObject(mesh);
        bbox!.union(meshBox);
      });

      if (bbox.isEmpty()) {
        bbox = null;
      }
    }

    // Add cluster group to model
    modelGroup.add(group);

    const cluster: Cluster = {
      key,
      displayName: generateDisplayName(key, config),
      elementIds,
      count: clusterElements.length,
      color,
      bbox,
      group,
      visible: true
    };

    clusters.set(key, cluster);
  });

  const clusterSet: ClusterSet = {
    config,
    clusters,
    totalElements: elements.length,
    originalParent: modelGroup
  };

  console.log(`Created ${clusters.size} clusters with ${elements.length} total elements`);
  return clusterSet;
}

/**
 * Apply colors to clusters
 */
export function applyClusterColors(clusterSet: ClusterSet): void {
  console.log('Applying cluster colors');

  clusterSet.clusters.forEach(cluster => {
    cluster.elementIds.forEach(expressId => {
      // Use viewer's setColor method which handles material cloning
      const viewer = getViewerFromClusterSet(clusterSet);
      if (viewer) {
        viewer.setColor([expressId], cluster.color);
      }
    });
  });
}

/**
 * Reset cluster colors to original
 */
export function resetClusterColors(clusterSet: ClusterSet): void {
  console.log('Resetting cluster colors');

  const allElementIds: number[] = [];
  clusterSet.clusters.forEach(cluster => {
    allElementIds.push(...cluster.elementIds);
  });

  const viewer = getViewerFromClusterSet(clusterSet);
  if (viewer) {
    viewer.resetColors(allElementIds);
  }
}

/**
 * Toggle cluster visibility
 */
export function toggleClusterVisibility(clusterSet: ClusterSet, clusterKey: string, visible: boolean): void {
  const cluster = clusterSet.clusters.get(clusterKey);
  if (!cluster) {
    console.warn(`Cluster ${clusterKey} not found`);
    return;
  }

  cluster.visible = visible;
  cluster.group.visible = visible;

  console.log(`Cluster ${clusterKey} visibility set to ${visible}`);
}

/**
 * Isolate specific clusters (hide all others)
 */
export function isolateClusters(clusterSet: ClusterSet, clusterKeys: string[]): void {
  const isolateSet = new Set(clusterKeys);

  clusterSet.clusters.forEach((cluster, key) => {
    const shouldShow = isolateSet.has(key);
    toggleClusterVisibility(clusterSet, key, shouldShow);
  });

  console.log(`Isolated ${clusterKeys.length} clusters`);
}

/**
 * Show all clusters
 */
export function showAllClusters(clusterSet: ClusterSet): void {
  clusterSet.clusters.forEach((cluster, key) => {
    toggleClusterVisibility(clusterSet, key, true);
  });

  console.log('Showing all clusters');
}

/**
 * Explode clusters (move them apart spatially)
 */
export function explodeClusters(clusterSet: ClusterSet, distance: number = 50): void {
  console.log(`Exploding clusters with distance ${distance}`);

  const clusterArray = Array.from(clusterSet.clusters.values());
  const centerPoint = new THREE.Vector3();

  // Calculate overall center
  const totalBounds = new THREE.Box3();
  clusterArray.forEach(cluster => {
    if (cluster.bbox) {
      totalBounds.union(cluster.bbox);
    }
  });

  if (!totalBounds.isEmpty()) {
    totalBounds.getCenter(centerPoint);
  }

  // Move each cluster away from center
  clusterArray.forEach((cluster, index) => {
    if (!cluster.bbox) return;

    const clusterCenter = new THREE.Vector3();
    cluster.bbox.getCenter(clusterCenter);

    // Calculate direction from overall center to cluster center
    const direction = clusterCenter.clone().sub(centerPoint).normalize();

    // If direction is zero (cluster at center), use a default direction
    if (direction.length() === 0) {
      const angle = (index / clusterArray.length) * Math.PI * 2;
      direction.set(Math.cos(angle), 0, Math.sin(angle));
    }

    // Apply explosion offset
    const offset = direction.multiplyScalar(distance);
    cluster.group.position.copy(offset);
  });
}

/**
 * Reset cluster positions
 */
export function resetClusterPositions(clusterSet: ClusterSet): void {
  console.log('Resetting cluster positions');

  clusterSet.clusters.forEach(cluster => {
    cluster.group.position.set(0, 0, 0);
  });
}

/**
 * Dispose cluster set and restore original structure
 */
export function disposeClusters(clusterSet: ClusterSet): void {
  console.log('Disposing clusters and restoring original structure');

  if (!clusterSet.originalParent) {
    console.warn('No original parent to restore to');
    return;
  }

  // Move all meshes back to original parent
  clusterSet.clusters.forEach(cluster => {
    const meshesToMove: THREE.Mesh[] = [];

    cluster.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        meshesToMove.push(child);
      }
    });

    meshesToMove.forEach(mesh => {
      cluster.group.remove(mesh);
      clusterSet.originalParent!.add(mesh);
    });

    // Remove cluster group
    if (cluster.group.parent) {
      cluster.group.parent.remove(cluster.group);
    }
  });

  // Reset colors
  resetClusterColors(clusterSet);

  clusterSet.clusters.clear();
}

/**
 * Get cluster statistics
 */
export function getClusterStats(clusterSet: ClusterSet): {
  totalClusters: number;
  totalElements: number;
  visibleClusters: number;
  largestCluster: { key: string; count: number } | null;
  smallestCluster: { key: string; count: number } | null;
} {
  const clusters = Array.from(clusterSet.clusters.values());
  const visibleClusters = clusters.filter(c => c.visible).length;

  let largestCluster: { key: string; count: number } | null = null;
  let smallestCluster: { key: string; count: number } | null = null;

  if (clusters.length > 0) {
    const sorted = clusters.sort((a, b) => b.count - a.count);
    largestCluster = { key: sorted[0].key, count: sorted[0].count };
    smallestCluster = { key: sorted[sorted.length - 1].key, count: sorted[sorted.length - 1].count };
  }

  return {
    totalClusters: clusterSet.clusters.size,
    totalElements: clusterSet.totalElements,
    visibleClusters,
    largestCluster,
    smallestCluster
  };
}

/**
 * Build clusters from elements without requiring a viewer (for workflow processing)
 * Returns a simplified cluster result that can be serialized
 */
export function buildClustersFromElements(
  elements: IfcElement[],
  config: ClusterConfig
): {
  clusters: Array<{
    key: string;
    displayName: string;
    count: number;
    color: string;
    visible: boolean;
    elementIds: number[];
    position?: { x: number; y: number; z: number }; // Add position for spatial separation
  }>;
  stats: {
    totalClusters: number;
    totalElements: number;
    visibleClusters: number;
  };
} | null {
  console.log(`Building clusters from elements: ${config.groupBy}`, config);

  try {
    // Group elements by cluster key
    const elementsByCluster = new Map<string, IfcElement[]>();

    elements.forEach(element => {
      const key = generateClusterKey(element, config);
      if (!elementsByCluster.has(key)) {
        elementsByCluster.set(key, []);
      }
      elementsByCluster.get(key)!.push(element);
    });

    console.log(`Generated ${elementsByCluster.size} clusters from ${elements.length} elements`);

    // Create cluster objects with spatial positioning
    let colorIndex = 0;
    const clusters: Array<{
      key: string;
      displayName: string;
      count: number;
      color: string;
      visible: boolean;
      elementIds: number[];
      position?: { x: number; y: number; z: number };
    }> = [];

    // Calculate positions for spatial separation
    const clusterKeys = Array.from(elementsByCluster.keys());
    const separationDistance = 150; // Further increased distance for clearer cluster separation

    elementsByCluster.forEach((clusterElements, key, map) => {
      const elementIds = clusterElements.map(el => el.expressId);
      const color = new THREE.Color(CLUSTER_COLORS[colorIndex % CLUSTER_COLORS.length]);

      // Calculate position for this cluster (arrange in a grid)
      const clusterIndex = Array.from(map.keys()).indexOf(key);
      const gridSize = Math.ceil(Math.sqrt(map.size));
      const row = Math.floor(clusterIndex / gridSize);
      const col = clusterIndex % gridSize;

      // Center the grid around origin
      const offsetX = (gridSize - 1) * separationDistance * 0.5;
      const offsetZ = (gridSize - 1) * separationDistance * 0.5;

      const position = {
        x: col * separationDistance - offsetX,
        y: 0,
        z: row * separationDistance - offsetZ
      };

      clusters.push({
        key,
        displayName: generateDisplayName(key, config),
        count: clusterElements.length,
        color: `#${color.getHexString()}`,
        visible: true,
        elementIds,
        position
      });

      colorIndex++;
    });

    const stats = {
      totalClusters: clusters.length,
      totalElements: elements.length,
      visibleClusters: clusters.length
    };

    console.log(`Created ${clusters.length} clusters with ${elements.length} total elements and spatial positions`);
    return { clusters, stats };
  } catch (error) {
    console.error('Error building clusters from elements:', error);
    return null;
  }
}

/**
 * Helper to get viewer from cluster set (assumes single active viewer)
 */
function getViewerFromClusterSet(clusterSet: ClusterSet): IfcViewer | null {
  // This is a simplified approach - in a more complex setup, 
  // you might need to track which viewer the cluster set belongs to
  const { withActiveViewer } = require('./viewer-manager');
  return withActiveViewer((viewer: IfcViewer) => viewer) || null;
}
