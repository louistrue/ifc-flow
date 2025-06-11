import * as THREE from "three";
import { IFCModel, IntersectionResult } from "./types";
import { exportConnectionsToIFC5 } from "./ifc-export";

export class FastIntersectionDetector {
  private raycaster: THREE.Raycaster;
  private meshes: THREE.Mesh[];

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.meshes = [];
  }

  public setupBoundingBoxes(object: THREE.Object3D): void {
    // Skip invisible objects
    if (!object.visible) return;

    if ((object as THREE.Mesh).isMesh) {
      const mesh = object as THREE.Mesh;
      this.meshes.push(mesh);
    }
  }

  public async findIntersection(
    obj1: THREE.Object3D,
    obj2: THREE.Object3D
  ): Promise<IntersectionResult | null> {
    const meshesA: THREE.Mesh[] = [];
    const meshesB: THREE.Mesh[] = [];

    obj1.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        meshesA.push(child as THREE.Mesh);
      }
    });
    obj2.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry) {
        meshesB.push(child as THREE.Mesh);
      }
    });
    if (meshesA.length === 0 || meshesB.length === 0) return null;

    // First, perform a bounding box check with a 5mm tolerance
    const touchingThreshold = 0.005; // 5mm tolerance
    const boxA = new THREE.Box3().setFromObject(obj1);
    const boxB = new THREE.Box3().setFromObject(obj2);
    if (!boxA.intersectsBox(boxB)) {
      // Even if the boxes do not intersect, check whether their centers are very close
      const centerA = boxA.getCenter(new THREE.Vector3());
      const centerB = boxB.getCenter(new THREE.Vector3());
      if (centerA.distanceTo(centerB) > touchingThreshold) {
        return null;
      }
    }

    // Perform raycasting between all mesh pairs
    const allIntersectionPoints: THREE.Vector3[] = [];
    for (const meshA of meshesA) {
      for (const meshB of meshesB) {
        const pts = this.raycastIntersection(meshA, meshB);
        if (pts && pts.length > 0) {
          allIntersectionPoints.push(...pts);
        }
      }
    }
    if (allIntersectionPoints.length === 0) return null;

    // Create visualization geometries
    const result = this.createIntersectionVisualization(allIntersectionPoints);
    return result;
  }

  private raycastIntersection(
    meshA: THREE.Mesh,
    meshB: THREE.Mesh
  ): THREE.Vector3[] {
    if (!meshA.geometry || !meshB.geometry) return [];

    const intersectionPoints: THREE.Vector3[] = [];
    const v = new THREE.Vector3();
    const positionA = meshA.geometry.attributes.position;

    // Define six principal ray directions
    const rayDirections = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1),
    ];

    // Sample vertices (up to 100 points)
    const stride = Math.max(1, Math.floor(positionA.count / 1000));
    for (let i = 0; i < positionA.count; i += stride) {
      v.fromBufferAttribute(positionA, i);
      v.applyMatrix4(meshA.matrixWorld);
      for (const direction of rayDirections) {
        this.raycaster.set(v, direction);
        // We limit the ray distance to the tolerance if needed
        this.raycaster.far = 0.01; // 1cm to catch near-contacts
        const intersects = this.raycaster.intersectObject(meshB);
        if (intersects.length > 0) {
          intersectionPoints.push(intersects[0].point.clone());
        }
      }
    }
    return intersectionPoints;
  }

  private createIntersectionVisualization(
    points: THREE.Vector3[]
  ): IntersectionResult | null {
    // Deduplicate points (within a 1cm threshold for safety)
    const uniquePoints: THREE.Vector3[] = [];
    const dedupTolerance = 0.001; // 1mm deduplication tolerance
    for (const point of points) {
      if (isNaN(point.x) || isNaN(point.y) || isNaN(point.z)) continue;
      let duplicate = false;
      for (const up of uniquePoints) {
        if (point.distanceTo(up) < dedupTolerance) {
          duplicate = true;
          break;
        }
      }
      if (!duplicate) uniquePoints.push(point);
    }
    if (uniquePoints.length === 0) return null;

    // Use 5mm as the tolerance for "touching" detection
    const tolerance = 0.005;

    // If only one unique point exists, return a point connection
    if (uniquePoints.length === 1) {
      const pointsGeometry = new THREE.BufferGeometry();
      const posArray = new Float32Array([
        uniquePoints[0].x,
        uniquePoints[0].y,
        uniquePoints[0].z,
      ]);
      pointsGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(posArray, 3)
      );
      return {
        type: "point",
        geometry: { points: pointsGeometry },
        measurements: {},
      };
    }

    // Find the two points with maximum separation
    let p1 = uniquePoints[0],
      p2 = uniquePoints[0];
    let maxDist = 0;
    for (let i = 0; i < uniquePoints.length; i++) {
      for (let j = i + 1; j < uniquePoints.length; j++) {
        const d = uniquePoints[i].distanceTo(uniquePoints[j]);
        if (d > maxDist) {
          maxDist = d;
          p1 = uniquePoints[i];
          p2 = uniquePoints[j];
        }
      }
    }

    // If the two most distant points are very close, treat the connection as a point
    if (maxDist < tolerance) {
      const pointsGeometry = new THREE.BufferGeometry();
      const posArray = new Float32Array([p1.x, p1.y, p1.z]);
      pointsGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(posArray, 3)
      );
      return {
        type: "point",
        geometry: { points: pointsGeometry },
        measurements: {},
      };
    }

    // Check collinearity: for each unique point, compute its distance from the line (p1, p2)
    const lineDir = new THREE.Vector3().subVectors(p2, p1).normalize();
    let maxDeviation = 0;
    for (const pt of uniquePoints) {
      const v = new THREE.Vector3().subVectors(pt, p1);
      const projLen = v.dot(lineDir);
      const projPt = new THREE.Vector3()
        .copy(lineDir)
        .multiplyScalar(projLen)
        .add(p1);
      const deviation = pt.distanceTo(projPt);
      if (deviation > maxDeviation) maxDeviation = deviation;
    }

    // If points lie nearly along a line, create a linear connection
    if (maxDeviation < tolerance) {
      const lineGeometry = new THREE.BufferGeometry();
      const linePos = new Float32Array([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
      lineGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePos, 3)
      );

      return {
        type: "line",
        geometry: { lines: lineGeometry },
        measurements: { length: maxDist },
      };
    }

    // Otherwise, assume a surface connection. Find a third point that is not collinear
    let p3: THREE.Vector3 | null = null;
    for (const candidate of uniquePoints) {
      if (candidate === p1 || candidate === p2) continue;
      const v = new THREE.Vector3().subVectors(candidate, p1);
      const projLen = v.dot(lineDir);
      const projPt = new THREE.Vector3()
        .copy(lineDir)
        .multiplyScalar(projLen)
        .add(p1);
      if (candidate.distanceTo(projPt) > tolerance) {
        p3 = candidate;
        break;
      }
    }

    // If all points are nearly collinear, fall back to a line
    if (!p3) {
      const lineGeometry = new THREE.BufferGeometry();
      const linePos = new Float32Array([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
      lineGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(linePos, 3)
      );
      return {
        type: "line",
        geometry: { lines: lineGeometry },
        measurements: { length: maxDist },
      };
    }

    // For surface connections, create proper triangulation
    if (uniquePoints.length === 4) {
      // Order points to form a proper rectangle
      const orderedPoints = this.orderPointsForRectangle(uniquePoints);
      const vertices: number[] = [];
      const indices = [0, 1, 2, 2, 3, 0]; // Fixed triangulation for ordered points

      // Add vertices in the correct order
      orderedPoints.forEach((p) => {
        vertices.push(p.x, p.y, p.z);
      });

      const surfaceGeometry = new THREE.BufferGeometry();
      surfaceGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3)
      );
      surfaceGeometry.setIndex(indices);
      surfaceGeometry.computeVertexNormals();

      // Calculate area using ordered points
      const area = this.calculateQuadArea(orderedPoints);

      // Create point geometry for visualization
      const pointsGeometry = new THREE.BufferGeometry();
      pointsGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3)
      );

      return {
        type: "surface",
        geometry: { points: pointsGeometry, surface: surfaceGeometry },
        measurements: { area },
      };
    } else {
      // For other point counts, use existing triangle fan approach
      const vertices: number[] = [];
      const indices: number[] = [];
      const center = new THREE.Vector3();
      uniquePoints.forEach((p) => center.add(p));
      center.divideScalar(uniquePoints.length);

      // Add center point as first vertex
      vertices.push(center.x, center.y, center.z);
      for (let i = 0; i < uniquePoints.length; i++) {
        const pt = uniquePoints[i];
        vertices.push(pt.x, pt.y, pt.z);
        if (i > 0) {
          indices.push(0, i, i + 1 < uniquePoints.length ? i + 1 : 1);
        }
      }

      const surfaceGeometry = new THREE.BufferGeometry();
      surfaceGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3)
      );
      surfaceGeometry.setIndex(indices);
      surfaceGeometry.computeVertexNormals();

      // Calculate area
      let area = 0;
      for (let i = 0; i < uniquePoints.length; i++) {
        const ptA = uniquePoints[i];
        const ptB = uniquePoints[(i + 1) % uniquePoints.length];
        const v1 = new THREE.Vector3().subVectors(ptA, center);
        const v2 = new THREE.Vector3().subVectors(ptB, center);
        area += v1.cross(v2).length() / 2;
      }

      // Create point geometry for visualization
      const pointsGeometry = new THREE.BufferGeometry();
      const posArray = new Float32Array(
        uniquePoints.flatMap((pt) => [pt.x, pt.y, pt.z])
      );
      pointsGeometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(posArray, 3)
      );

      return {
        type: "surface",
        geometry: { points: pointsGeometry, surface: surfaceGeometry },
        measurements: { area },
      };
    }
  }

  private orderPointsForRectangle(points: THREE.Vector3[]): THREE.Vector3[] {
    if (points.length !== 4) return points;

    // Find the center point
    const center = new THREE.Vector3();
    points.forEach((p) => center.add(p));
    center.divideScalar(4);

    // Calculate the primary plane normal using the first three points
    const v1 = new THREE.Vector3().subVectors(points[1], points[0]);
    const v2 = new THREE.Vector3().subVectors(points[2], points[0]);
    const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();

    // Project points onto a plane and get angles
    const projectedPoints = points.map((p) => {
      const v = new THREE.Vector3().subVectors(p, center);
      const projected = v.projectOnPlane(normal);
      const angle = Math.atan2(projected.y, projected.x);
      return { point: p, angle };
    });

    // Sort points by angle
    projectedPoints.sort((a, b) => a.angle - b.angle);

    // Return points in clockwise order
    return projectedPoints.map((p) => p.point);
  }

  private calculateQuadArea(orderedPoints: THREE.Vector3[]): number {
    if (orderedPoints.length !== 4) return 0;

    // Calculate area using cross product method for a quad
    const diagonal1 = new THREE.Vector3().subVectors(
      orderedPoints[2],
      orderedPoints[0]
    );
    const diagonal2 = new THREE.Vector3().subVectors(
      orderedPoints[3],
      orderedPoints[1]
    );

    return diagonal1.cross(diagonal2).length() / 2;
  }
}

export class IntersectionVisualizer {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private lastCameraPosition: THREE.Vector3;
  private lastCameraQuaternion: THREE.Quaternion;
  private updateThreshold: number = 0.01;
  private animationFrameId: number | null = null;
  private visualizations: Map<string, any>;
  private activeMode: boolean;
  public showLabelsGlobal: boolean;

  public colors = {
    surface: "#4CAF50", // Green
    line: "#2196F3", // Blue
    point: "#FFC107", // Amber
  };

  private typeVisibility: Record<string, boolean> = {
    surface: true,
    line: true,
    point: true,
  };

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.lastCameraPosition = camera.position.clone();
    this.lastCameraQuaternion = camera.quaternion.clone();
    this.visualizations = new Map();
    this.activeMode = false;
    this.showLabelsGlobal = false;
    this.startCameraTracking();
  }

  public setConnectionMode(active: boolean): void {
    this.activeMode = active;
    this.updateVisibility();
  }

  public createVisualization(data: {
    id: string;
    type: string;
    geometry: {
      points?: THREE.BufferGeometry;
      lines?: THREE.BufferGeometry;
      surface?: THREE.BufferGeometry;
    };
    measurements?: {
      area?: number;
      length?: number;
    };
  }): any {
    const visualization: any = {
      id: data.id,
      type: data.type,
      visible: true,
    };

    // Create points visualization using spheres
    if (data.geometry?.points) {
      const pointGroup = new THREE.Group();
      // Adjust sphere size based on connection type
      const sphereSize = data.type === "point" ? 0.1 : 0.025; // Double size for point connections, half for others
      const sphereGeometry = new THREE.SphereGeometry(sphereSize, 16, 16);

      // Revert to original colors.
      const pointColor =
        data.type === "point" ? this.colors.point : this.colors.surface;
      const pointMaterial = new THREE.MeshPhongMaterial({
        color: pointColor,
        transparent: true,
        opacity: 0.8,
        shininess: 100,
        specular: 0xffffff,
      });

      const positions = data.geometry.points.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i);
        const sphere = new THREE.Mesh(sphereGeometry, pointMaterial);
        sphere.position.copy(point);
        pointGroup.add(sphere);
      }

      visualization.points = pointGroup;
      this.scene.add(pointGroup);
    }

    // Create lines visualization
    if (data.geometry?.lines) {
      const lineMaterial = new THREE.LineBasicMaterial({
        color: this.colors.line,
        linewidth: 2,
        transparent: true,
        opacity: 0.8,
      });
      const lines = new THREE.LineSegments(data.geometry.lines, lineMaterial);
      visualization.lines = lines;
      this.scene.add(lines);
    }

    // Create surface visualization
    if (data.geometry?.surface) {
      const surfaceMaterial = new THREE.MeshPhongMaterial({
        color: this.colors.surface,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        shininess: 100,
        specular: 0xffffff,
      });
      const surface = new THREE.Mesh(data.geometry.surface, surfaceMaterial);
      visualization.surface = surface;
      this.scene.add(surface);

      // Add wireframe
      const wireframeMaterial = new THREE.LineBasicMaterial({
        color: this.colors.surface,
        transparent: true,
        opacity: 0.5,
      });
      const wireframe = new THREE.LineSegments(
        new THREE.WireframeGeometry(data.geometry.surface),
        wireframeMaterial
      );
      visualization.wireframe = wireframe;
      this.scene.add(wireframe);
    }

    // Store visualization
    this.visualizations.set(data.id, visualization);
    return visualization;
  }

  public clear(): void {
    console.log("Clearing visualizations");
    this.visualizations.forEach((vis) => {
      if (vis.points) {
        console.log("Clearing points");
        vis.points.children.forEach((sphere: THREE.Mesh) => {
          sphere.geometry.dispose();
          (sphere.material as THREE.Material).dispose();
        });
        this.scene.remove(vis.points);
      }
      if (vis.lines) {
        console.log("Clearing lines");
        vis.lines.geometry.dispose();
        (vis.lines.material as THREE.Material).dispose();
        this.scene.remove(vis.lines);
      }
      if (vis.surface) {
        console.log("Clearing surface");
        vis.surface.geometry.dispose();
        (vis.surface.material as THREE.Material).dispose();
        this.scene.remove(vis.surface);
        if (vis.wireframe) {
          vis.wireframe.geometry.dispose();
          (vis.wireframe.material as THREE.Material).dispose();
          this.scene.remove(vis.wireframe);
        }
      }
    });
    this.visualizations.clear();
  }

  private updateVisibility(): void {
    this.visualizations.forEach((vis) => {
      const isTypeVisible = this.typeVisibility[vis.type];
      if (vis.points) {
        vis.points.visible = this.activeMode && isTypeVisible;
        vis.points.children.forEach((sphere: THREE.Mesh) => {
          sphere.visible = this.activeMode && isTypeVisible;
        });
      }
      if (vis.lines) {
        vis.lines.visible = this.activeMode && isTypeVisible;
      }
      if (vis.surface) {
        vis.surface.visible = this.activeMode && isTypeVisible;
        if (vis.wireframe) {
          vis.wireframe.visible = this.activeMode && isTypeVisible;
        }
      }
    });
  }

  private startCameraTracking(): void {
    const animate = () => {
      if (
        this.camera.position.distanceTo(this.lastCameraPosition) >
          this.updateThreshold ||
        this.camera.quaternion.angleTo(this.lastCameraQuaternion) >
          this.updateThreshold
      ) {
        this.lastCameraPosition.copy(this.camera.position);
        this.lastCameraQuaternion.copy(this.camera.quaternion);
        this.updateLabels();
      }
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  private updateLabels(): void {
    if (!this.showLabelsGlobal) return;

    const camera = this.camera;
    const visibleLabels: THREE.Sprite[] = [];
    const minDistance = 0.15;

    // First pass: collect and update all labels
    this.visualizations.forEach((visualization) => {
      if (visualization.label) {
        const label = visualization.label as THREE.Sprite;
        const screenPos = label.position.clone().project(camera);
        screenPos.z = camera.position.distanceTo(label.position);
        visibleLabels.push(label);
        label.userData.screenPos = screenPos;
      }
    });

    // Sort labels by distance to camera (closest first)
    visibleLabels.sort((a, b) => {
      const distA = a.userData.screenPos.z;
      const distB = b.userData.screenPos.z;
      return distA - distB;
    });

    // Second pass: handle visibility and scaling
    visibleLabels.forEach((label, i) => {
      const pos1 = label.userData.screenPos;
      let shouldShow = true;

      // Check overlapping with adjusted distances
      let overlappingCount = 0;
      const maxOverlaps = 2;

      for (let j = 0; j < i; j++) {
        const otherLabel = visibleLabels[j];
        if (otherLabel.visible) {
          const pos2 = otherLabel.userData.screenPos;

          // Consider depth difference
          const depthDiff = Math.abs(pos1.z - pos2.z);
          const depthFactor = Math.max(0.5, Math.min(1, depthDiff));
          const adjustedMinDistance = minDistance * depthFactor;

          const dist = Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
          );

          if (dist < adjustedMinDistance) {
            overlappingCount++;
            if (overlappingCount > maxOverlaps) {
              shouldShow = false;
              break;
            }
          }
        }
      }

      // Update label visibility and scale
      label.visible = shouldShow;
      if (shouldShow) {
        const distance = pos1.z;
        // Adjusted scale calculation for better visibility at different distances
        const baseScale = 0.6; // Increased base scale (was 0.4)
        const minScale = 0.4; // Increased minimum scale (was 0.3)
        const maxScale = 2.0; // Increased maximum scale (was 1.2)

        // Use cube root for more gradual scaling at distance
        const scale = Math.max(
          minScale,
          Math.min(maxScale, baseScale * Math.pow(distance, 0.33))
        );

        // Apply scale while maintaining aspect ratio
        const baseScaleVector = label.scale.clone().normalize();
        label.scale.copy(baseScaleVector.multiplyScalar(scale));

        // Make label face camera
        label.quaternion.copy(camera.quaternion);
      }
    });
  }

  public highlight(visualization: any): void {
    if (!visualization) return;

    // Highlight points with different scales based on type
    if (visualization.points) {
      visualization.points.children.forEach((sphere: THREE.Mesh) => {
        (sphere.material as THREE.MeshPhongMaterial).opacity = 1;
        (sphere.material as THREE.MeshPhongMaterial).emissive.setHex(0x333333);
        // Scale up more for point connections
        const scaleMultiplier = visualization.type === "point" ? 1.5 : 1.2;
        sphere.scale.setScalar(scaleMultiplier);
      });
    }

    // Highlight lines
    if (visualization.lines) {
      (visualization.lines.material as THREE.LineBasicMaterial).opacity = 1;
      (visualization.lines.material as THREE.LineBasicMaterial).linewidth = 3;
    }

    // Highlight surface
    if (visualization.surface) {
      (visualization.surface.material as THREE.MeshPhongMaterial).opacity = 0.6;
      (
        visualization.surface.material as THREE.MeshPhongMaterial
      ).emissive.setHex(0x222222);

      if (visualization.wireframe) {
        (
          visualization.wireframe.material as THREE.LineBasicMaterial
        ).opacity = 0.8;
        (
          visualization.wireframe.material as THREE.LineBasicMaterial
        ).linewidth = 2;
      }
    }
  }

  public unhighlight(visualization: any): void {
    if (!visualization) return;

    // Reset points
    if (visualization.points) {
      visualization.points.children.forEach((sphere: THREE.Mesh) => {
        (sphere.material as THREE.MeshPhongMaterial).opacity = 0.8;
        (sphere.material as THREE.MeshPhongMaterial).emissive.setHex(0);
        sphere.scale.setScalar(1.0);
      });
    }

    // Reset lines
    if (visualization.lines) {
      (visualization.lines.material as THREE.LineBasicMaterial).opacity = 0.8;
      (visualization.lines.material as THREE.LineBasicMaterial).linewidth = 2;
    }

    // Reset surface
    if (visualization.surface) {
      (visualization.surface.material as THREE.MeshPhongMaterial).opacity = 0.3;
      (
        visualization.surface.material as THREE.MeshPhongMaterial
      ).emissive.setHex(0);

      if (visualization.wireframe) {
        (
          visualization.wireframe.material as THREE.LineBasicMaterial
        ).opacity = 0.5;
        (
          visualization.wireframe.material as THREE.LineBasicMaterial
        ).linewidth = 1;
      }
    }
  }

  public dispose(): void {
    // Stop camera tracking
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Clear all visualizations
    this.clear();
  }

  public resetView(): void {
    // Method kept for API compatibility but no longer resets camera
    console.log("resetView called but camera position maintained");
  }

  public setTypeVisibility(type: string, visible: boolean): void {
    console.log(`Setting ${type} visibility to ${visible}`, {
      type,
      visible,
      activeMode: this.activeMode,
      hasVisualizations: this.visualizations.size,
    });

    this.typeVisibility[type] = visible;

    this.visualizations.forEach((vis) => {
      if (vis.type === type) {
        console.log(`Processing visualization of type ${type}:`, {
          hasPoints: !!vis.points,
          hasLines: !!vis.lines,
          hasSurface: !!vis.surface,
        });

        if (vis.points) {
          vis.points.visible = visible && this.activeMode;
          vis.points.children.forEach((sphere: THREE.Mesh) => {
            sphere.visible = visible && this.activeMode;
          });
          console.log("Updated points visibility:", vis.points.visible);
        }
        if (vis.lines) {
          vis.lines.visible = visible && this.activeMode;
          console.log("Updated lines visibility:", vis.lines.visible);
        }
        if (vis.surface) {
          vis.surface.visible = visible && this.activeMode;
          if (vis.wireframe) {
            vis.wireframe.visible = visible && this.activeMode;
          }
          console.log("Updated surface visibility:", vis.surface.visible);
        }
      }
    });
  }

  public setGlobalLabelVisibility(visible: boolean): void {
    console.log(`Setting global label visibility to ${visible}`, {
      visible,
      hasVisualizations: this.visualizations.size,
    });

    this.showLabelsGlobal = visible;
    this.visualizations.forEach((vis) => {
      if (vis.label) {
        vis.label.visible = visible;
        console.log("Updated label visibility for visualization:", visible);
      }
    });
    if (visible) {
      console.log("Updating labels");
      this.updateLabels();
    }
  }

  public exportToIFC5(): void {
    const connections = new Map<string, any>();

    console.log("Total visualizations:", this.visualizations.size);

    this.visualizations.forEach((vis, id) => {
      // Get the connection label from the UI
      const connectionItem = document.querySelector(
        `[data-connection-id="${id}"]`
      );
      const elementNames = connectionItem
        ?.querySelector(".connection-elements")
        ?.textContent?.trim();
      const measurementText = connectionItem
        ?.querySelector(".connection-measurement")
        ?.textContent?.trim();

      console.log("Processing visualization:", {
        id,
        type: vis.type,
        hasPoints: !!vis.points,
        hasLines: !!vis.lines,
        hasSurface: !!vis.surface,
        label: elementNames,
        measurement: measurementText,
      });

      const connection: any = {
        type: vis.type,
        geometry: {},
        measurements: {},
        label: elementNames || `Connection_${id}`,
        measurementText,
      };

      // Add geometries based on type
      if (vis.points?.children[0]?.geometry) {
        connection.geometry.points = vis.points.children[0].geometry;
        console.log("Added point geometry");
      }
      if (vis.lines?.geometry) {
        connection.geometry.lines = vis.lines.geometry;
        console.log("Added line geometry");
      }
      if (vis.surface?.geometry) {
        connection.geometry.surface = vis.surface.geometry;
        console.log("Added surface geometry");
      }

      // Add measurements if they exist
      if (vis.measurements) {
        connection.measurements = vis.measurements;
        console.log("Added measurements:", vis.measurements);
      }

      connections.set(id, connection);
    });

    // Generate IFC5 JSON - pass the Map directly
    const ifcJson = exportConnectionsToIFC5(connections);

    // Create and trigger download with .ifcx extension
    const blob = new Blob([ifcJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "exported_connections.ifcx"; // Changed to .ifcx extension
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private createSummarySection(
    container: Element,
    connectionsByType: Record<string, Connection[]>
  ): void {
    const summary = document.createElement("div");
    summary.className = "connections-summary";

    // Create export buttons container with vertical layout
    const exportButtons = document.createElement("div");
    exportButtons.className = "summary-export-buttons";
    exportButtons.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 16px;
    `;

    // CSV Export button
    const csvExportButton = document.createElement("button");
    csvExportButton.className = "summary-export-btn";
    csvExportButton.style.cssText = `
        width: 100%;
        justify-content: center;
        padding: 8px;
    `;
    csvExportButton.innerHTML = `
        <i class="fas fa-file-export"></i>
        Export CSV
    `;
    csvExportButton.addEventListener("click", () =>
      this.exportConnectionsCSV()
    );

    // IFC5 Export button
    const ifc5ExportButton = document.createElement("button");
    ifc5ExportButton.className = "summary-export-btn";
    ifc5ExportButton.style.cssText = `
        width: 100%;
        justify-content: center;
        padding: 8px;
    `;
    ifc5ExportButton.innerHTML = `
        <i class="fas fa-file-code"></i>
        Export IFC5
    `;
    ifc5ExportButton.addEventListener("click", () => {
      if (this.connectionVisualizer) {
        this.connectionVisualizer.exportToIFC5();
      }
    });

    exportButtons.appendChild(csvExportButton);
    exportButtons.appendChild(ifc5ExportButton);

    // Create statistics content
    const content = document.createElement("div");
    content.className = "summary-content";
    content.style.cssText = `
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
    `;

    const types = [
      {
        type: "surface",
        icon: "square",
        label: "Surface",
        color: this.connectionVisualizer?.colors.surface || "#4CAF50",
      },
      {
        type: "line",
        icon: "minus",
        label: "Line",
        color: this.connectionVisualizer?.colors.line || "#2196F3",
      },
      {
        type: "point",
        icon: "circle",
        label: "Point",
        color: this.connectionVisualizer?.colors.point || "#FFC107",
      },
    ];

    types.forEach(({ type, icon, label, color }) => {
      const count = connectionsByType[type].length;
      const item = document.createElement("div");
      item.className = "summary-item";
      item.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 12px;
            background: ${color}10;
            border-radius: 8px;
        `;
      item.innerHTML = `
            <div class="summary-icon" style="color: ${color}">
                <i class="fas fa-${icon}"></i>
            </div>
            <div class="summary-count" style="font-size: 24px; font-weight: 600;">${count}</div>
            <div class="summary-label" style="color: #666;">${label}</div>
        `;
      content.appendChild(item);
    });

    summary.appendChild(exportButtons);
    summary.appendChild(content);
    container.appendChild(summary);
  }

  // Compute a pastel color for a given key.
  private getClusterColor(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 50%, 90%)`;
  }
}