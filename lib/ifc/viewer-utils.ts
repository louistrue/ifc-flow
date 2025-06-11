import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IfcAPI, IfcGeometry, FlatMesh, PlacedGeometry, Vector } from "web-ifc"; // Import necessary types

// Viewer configuration options
export interface ViewerOptions {
  backgroundColor?: string;
  showGrid?: boolean;
  showAxes?: boolean;
  cameraPosition?: [number, number, number];
  highlightColor?: string;
}

// Interface for clash results
interface ClashResultDetail {
  id: string;
  element1Id: number;
  element2Id: number;
  boxIntersection?: boolean; // Indicate if it's just a box clash
  // Add intersection points/volume later if needed
}

interface ClashResults {
  clashes: number;
  details: ClashResultDetail[];
}

// The main viewer class that handles 3D rendering
export class IfcViewer {
  private viewerId: string; // Add unique ID
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private ifcAPI: IfcAPI | null = null;
  private modelID: number | null = null;
  // Store the main model group containing all meshes
  private ifcModelGroup: THREE.Group | null = null; // Changed from ifcModelMesh
  private selectedElements: Set<string> = new Set();
  private highlightMaterial: THREE.MeshBasicMaterial;
  private animationFrameId: number | null = null;
  // Material cache
  private materials: Record<string, THREE.Material> = {};

  // New map to store meshes by expressID
  private elementMeshMap: Map<number, THREE.Object3D> = new Map();
  private clashVisualizationGroup: THREE.Group | null = null; // Group for clash markers
  private isModelLoaded: boolean = false; // Add state flag
  private loadingPromise: Promise<void> | null = null; // Promise for ongoing load
  private currentLoadAbortController: AbortController | null = null; // To cancel ongoing loads

  constructor(
    private container: HTMLElement,
    private options: ViewerOptions = {}
  ) {
    this.viewerId = `viewer-${Date.now()}-${Math.random().toString(16).substring(2, 8)}`; // Assign unique ID
    console.log(`%cIfcViewer Constructor: Created instance ${this.viewerId}`, 'color: blue; font-weight: bold;'); // Log instance creation
    // Initialize Three.js components
    this.scene = new THREE.Scene();

    // Set background color
    const bgColor = options.backgroundColor || "#f0f0f0";
    this.scene.background = new THREE.Color(bgColor);

    // Set up camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(
      options.cameraPosition?.[0] || 10,
      options.cameraPosition?.[1] || 10,
      options.cameraPosition?.[2] || 10
    );
    this.camera.lookAt(0, 0, 0); // Look at origin initially

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Set up controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Slightly brighter ambient
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Slightly less intense directional
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5); // Add another light from a different angle
    directionalLight2.position.set(-10, -5, -15);
    this.scene.add(directionalLight2);


    // Add grid and axes if needed
    if (options.showGrid !== false) {
      const grid = new THREE.GridHelper(100, 100); // Larger grid
      this.scene.add(grid);
    }

    if (options.showAxes !== false) {
      const axes = new THREE.AxesHelper(10); // Larger axes
      this.scene.add(axes);
    }

    // Highlight material for selected elements (needs rework for LoadAllGeometry)
    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: options.highlightColor || 0xff0000,
      transparent: true,
      opacity: 0.5,
      depthTest: false, // Render highlight on top
    });

    // Start animation loop
    this.animate();

    // Handle window resize
    window.addEventListener("resize", this.handleResize);
  }

  // Public method to access the scene
  public getScene(): THREE.Scene {
    return this.scene;
  }

  // Initialize IfcAPI for web-ifc
  async initIfcAPI(): Promise<IfcAPI> {
    if (!this.ifcAPI) {
      console.log("Initializing IFC API...");
      this.ifcAPI = new IfcAPI();
      await this.ifcAPI.SetWasmPath("/wasm/", true);
      await this.ifcAPI.Init(); // Call Init() without arguments
      console.log("IFC API Initialized.");
    }
    return this.ifcAPI;
  }

  // Method to get the current loading promise
  public getLoadingPromise(): Promise<void> | null {
    return this.loadingPromise;
  }

  // Load an IFC model using web-ifc's geometry loader and build THREE meshes
  async loadIfc(file: File): Promise<void> {
    console.log(`Viewer ${this.viewerId}: loadIfc called for ${file.name}`);

    // Abort any previous ongoing load
    if (this.currentLoadAbortController) {
      console.log(`Viewer ${this.viewerId}: Aborting previous load.`);
      this.currentLoadAbortController.abort();
      this.loadingPromise = null; // Clear old promise
    }
    const abortController = new AbortController();
    this.currentLoadAbortController = abortController;
    const signal = abortController.signal;

    this.clear(); // Clear previous state
    this.isModelLoaded = false;

    // Create and store the loading promise
    this.loadingPromise = (async () => {
      let tempModelID: number | null = null;
      try {
        if (signal.aborted) throw new Error('Load aborted before start');
        const ifcAPI = await this.initIfcAPI();
        if (!ifcAPI) throw new Error("IFC API not initialized");
        if (signal.aborted) throw new Error('Load aborted during API init');

        console.log(`Viewer ${this.viewerId}: Reading file buffer...`);
        const buffer = await file.arrayBuffer();
        if (signal.aborted) throw new Error('Load aborted after reading buffer');
        const data = new Uint8Array(buffer);

        console.log(`Viewer ${this.viewerId}: Opening IFC model with web-ifc...`);
        tempModelID = ifcAPI.OpenModel(data);
        if (signal.aborted) {
          ifcAPI.CloseModel(tempModelID);
          throw new Error('Load aborted after opening model');
        }
        this.modelID = tempModelID;
        console.log(`Viewer ${this.viewerId}: Model opened, ID: ${this.modelID}`);

        console.log(`Viewer ${this.viewerId}: Requesting geometry data generation...`);
        const flatMeshVector: Vector<FlatMesh> = await ifcAPI.LoadAllGeometry(this.modelID);
        if (signal.aborted) throw new Error('Load aborted after LoadAllGeometry');
        console.log(`Viewer ${this.viewerId}: Geometry data vector obtained.`);

        this.ifcModelGroup = new THREE.Group();
        this.ifcModelGroup.name = file.name;
        const numFlatMeshes = flatMeshVector.size();
        console.log(`Viewer ${this.viewerId}: Processing ${numFlatMeshes} flat meshes...`);

        // Process meshes (check signal periodically if loop is long)
        for (let i = 0; i < numFlatMeshes; i++) {
          if (signal.aborted) throw new Error('Load aborted during mesh processing');
          const flatMesh: FlatMesh = flatMeshVector.get(i);
          const elementExpressId = flatMesh.expressID;
          const placedGeometryVector: Vector<PlacedGeometry> = flatMesh.geometries;
          const numPlacedGeometries = placedGeometryVector.size();
          const elementGroup = new THREE.Group();
          elementGroup.userData = { expressID: elementExpressId };
          for (let j = 0; j < numPlacedGeometries; j++) {
            const placedGeometry: PlacedGeometry = placedGeometryVector.get(j);
            const geometryHandle: IfcGeometry = ifcAPI.GetGeometry(this.modelID, placedGeometry.geometryExpressID);
            if (geometryHandle) {
              const threeMesh = this.createThreeMesh(geometryHandle, placedGeometry);
              if (threeMesh) {
                elementGroup.add(threeMesh);
              }
              geometryHandle.delete();
            }
          }
          if (elementGroup.children.length > 0) {
            this.ifcModelGroup.add(elementGroup);
            this.elementMeshMap.set(elementExpressId, elementGroup);
          }
        }

        console.log(`Viewer ${this.viewerId}: Finished processing geometry. Mapped ${this.elementMeshMap.size} elements.`);

        if (this.ifcModelGroup.children.length > 0) {
          this.scene.add(this.ifcModelGroup);
          this.isModelLoaded = true;
          console.log(`%cViewer ${this.viewerId}: Model loaded, map populated, isReady is now TRUE.`, 'color: green; font-weight: bold;');
        } else {
          console.warn(`Viewer ${this.viewerId}: No valid meshes were generated.`);
          this.ifcModelGroup = null;
          this.isModelLoaded = false;
        }

        this.fitCameraToModel();
        console.log(`Viewer ${this.viewerId}: loadIfc async IIFE completed successfully.`);
      } catch (error: any) {
        if (error.message.includes('aborted')) {
          console.log(`Viewer ${this.viewerId}: Load intentionally aborted.`);
        } else {
          console.error(`Viewer ${this.viewerId}: Error loading IFC for visualization:`, error);
          this.isModelLoaded = false;
          // Ensure model is closed in IfcAPI if opened
          const idToClose = this.modelID !== null ? this.modelID : tempModelID;
          if (this.ifcAPI && idToClose !== null) {
            try { this.ifcAPI.CloseModel(idToClose); } catch (e) { /* ignore */ }
          }
          this.modelID = null;
          // Don't call clear() here to avoid infinite loops if clear itself fails
          throw error; // Re-throw error to be caught by the caller
        }
      } finally {
        // Clean up abort controller reference if this promise completes (or is aborted)
        if (this.currentLoadAbortController === abortController) {
          this.currentLoadAbortController = null;
        }
        // Don't set loadingPromise to null here, let the caller check its status
      }
    })(); // Immediately invoke the async IIFE

    // Return the promise so callers can await
    await this.loadingPromise;
    console.log(`Viewer ${this.viewerId}: loadIfc awaited promise has resolved.`);
  }

  // Helper function to create a THREE.Mesh from web-ifc geometry data handles
  private createThreeMesh(geometryHandle: IfcGeometry, placedGeometry: PlacedGeometry): THREE.Mesh | null {
    // const geomExpressId = placedGeometry.geometryExpressID; // Keep commented unless debugging specific mesh creation
    if (!placedGeometry) {
      // console.warn(`createThreeMesh skipped: Invalid placedGeometry provided.`);
      return null;
    }
    try {
      const ifcAPI = this.ifcAPI;
      if (!ifcAPI || this.modelID === null) {
        // console.warn(`createThreeMesh skipped for geom ${geomExpressId}: IfcAPI or modelID not available.`);
        return null;
      }
      const vertexDataPtr = geometryHandle.GetVertexData();
      const vertexDataSize = geometryHandle.GetVertexDataSize();
      const indexDataPtr = geometryHandle.GetIndexData();
      const indexDataSize = geometryHandle.GetIndexDataSize();
      if (!vertexDataPtr || vertexDataSize === 0 || !indexDataPtr || indexDataSize === 0) {
        console.warn(`createThreeMesh skipped for geom ID ${placedGeometry.geometryExpressID}: Invalid or zero-sized geometry data pointers/sizes.`); // Keep this warn
        return null;
      }
      const vertices = ifcAPI.GetVertexArray(vertexDataPtr, vertexDataSize);
      const indices = ifcAPI.GetIndexArray(indexDataPtr, indexDataSize);
      if (!vertices || vertices.length === 0 || !indices || indices.length === 0) {
        console.warn(`createThreeMesh skipped for geom ID ${placedGeometry.geometryExpressID}: Empty vertices or indices array.`); // Keep this warn
        return null;
      }
      const bufferGeometry = new THREE.BufferGeometry();
      const numFloats = vertices.length;
      if (numFloats % 6 !== 0) {
        console.warn(`createThreeMesh skipped for geom ID ${placedGeometry.geometryExpressID}: Interleaved vertices array length (${numFloats}) is not a multiple of 6.`); // Keep this warn
        return null;
      }
      const numVertices = numFloats / 6;
      const positions = new Float32Array(numVertices * 3);
      const normals = new Float32Array(numVertices * 3);
      for (let i = 0; i < numVertices; i++) {
        const vIndex = i * 6;
        const pIndex = i * 3;
        positions[pIndex] = vertices[vIndex];
        positions[pIndex + 1] = vertices[vIndex + 1];
        positions[pIndex + 2] = vertices[vIndex + 2];
        normals[pIndex] = vertices[vIndex + 3];
        normals[pIndex + 1] = vertices[vIndex + 4];
        normals[pIndex + 2] = vertices[vIndex + 5];
      }
      bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      let invalidIndexFound = false;
      for (let i = 0; i < indices.length; i++) {
        if (indices[i] >= numVertices) {
          console.warn(`createThreeMesh skipped for geom ID ${placedGeometry.geometryExpressID}: Invalid index ${indices[i]} found (max allowed is ${numVertices - 1}).`); // Keep this warn
          invalidIndexFound = true;
          break;
        }
      }
      if (invalidIndexFound) return null;
      bufferGeometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1));
      const { color } = placedGeometry;
      if (!color) {
        console.warn(`createThreeMesh skipped for geom ID ${placedGeometry.geometryExpressID}: Missing color data.`); // Keep this warn
        return null;
      }
      const matId = `${color.x}-${color.y}-${color.z}-${color.w}`;
      let material = this.materials[matId];
      if (!material) {
        material = new THREE.MeshLambertMaterial({
          color: new THREE.Color(color.x, color.y, color.z),
          opacity: color.w,
          transparent: color.w < 1.0,
          side: THREE.DoubleSide,
          depthWrite: color.w === 1.0,
        });
        this.materials[matId] = material;
      }
      const mesh = new THREE.Mesh(bufferGeometry, material);
      if (placedGeometry.flatTransformation && placedGeometry.flatTransformation.length === 16) {
        mesh.matrix.fromArray(placedGeometry.flatTransformation);
        mesh.matrixAutoUpdate = false;
        mesh.matrixWorldNeedsUpdate = true;
      } else {
        console.warn(`createThreeMesh: Missing or invalid flatTransformation for geom ID ${placedGeometry.geometryExpressID}. Using identity matrix.`); // Keep this warn
        mesh.matrix.identity();
        mesh.matrixAutoUpdate = false;
        mesh.matrixWorldNeedsUpdate = true;
      }
      return mesh;
    } catch (e) {
      console.warn(`createThreeMesh Error processing geom ID ${placedGeometry.geometryExpressID}:`, e); // Keep this warn
      return null;
    }
  }

  // *** Highlighting needs significant rework for this geometry loading approach ***
  highlightElements(elementIds: string[]): void {
    console.warn("highlightElements is not implemented for the current geometry loading method.");
  }
  clearHighlights(): void {
    console.warn("clearHighlights is not implemented for the current geometry loading method.");
  }

  // Fit camera to model bounds
  fitCameraToModel(): void {
    if (!this.ifcModelGroup || this.ifcModelGroup.children.length === 0) {
      console.log("No model group/meshes to fit camera to.");
      // Reset camera...
      this.camera.position.set(
        this.options.cameraPosition?.[0] || 10,
        this.options.cameraPosition?.[1] || 10,
        this.options.cameraPosition?.[2] || 10
      );
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      return;
    }

    console.log("Fitting camera to model group...");
    const box = new THREE.Box3().setFromObject(this.ifcModelGroup, true);

    // Check finiteness of box components (Fix for Linter Error #4)
    if (box.isEmpty() ||
      !Number.isFinite(box.max.x) || !Number.isFinite(box.max.y) || !Number.isFinite(box.max.z) ||
      !Number.isFinite(box.min.x) || !Number.isFinite(box.min.y) || !Number.isFinite(box.min.z)) {
      console.warn("Model group bounding box is empty or invalid (Infinite/NaN bounds?).");
      return;
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    console.log("Model group bounds:", box.min, box.max);
    console.log("Model group center:", center);
    console.log("Model group size:", size);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim <= 1e-6) {
      console.warn("Model dimensions are near zero, cannot fit camera reliably. Centering view.");
      // Center view...
      this.camera.position.set(center.x + 5, center.y + 5, center.z + 5);
      this.camera.lookAt(center);
      this.controls.target.copy(center);
      this.controls.update();
      return;
    }

    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDistance = Math.abs(maxDim / (2 * Math.tan(fov / 2)));
    const sizeLength = size.length();
    cameraDistance = Math.max(cameraDistance * 1.6, sizeLength * 0.6, 1);

    if (!Number.isFinite(cameraDistance)) {
      console.warn("Calculated infinite camera distance. Resetting camera.");
      // Reset camera...
      this.camera.position.set(
        this.options.cameraPosition?.[0] || 10,
        this.options.cameraPosition?.[1] || 10,
        this.options.cameraPosition?.[2] || 10
      );
      this.camera.lookAt(0, 0, 0);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      return;
    }

    const direction = new THREE.Vector3(0.6, 0.5, 1).normalize();
    const position = center.clone().add(direction.multiplyScalar(cameraDistance));

    console.log("Calculated camera distance:", cameraDistance);
    console.log("Setting camera position to:", position);

    this.camera.position.copy(position);
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
    console.log("Camera fit complete.");
  }

  // Handle window resize
  private handleResize = (): void => {
    if (!this.container) return;

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  // Animation loop
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.controls.update(); // Update controls for damping
    this.renderer.render(this.scene, this.camera);
  };

  // *** Clash Visualization Methods (Moved from ClashVisualizer) ***
  public visualizeClashes(clashResults: ClashResults): void {
    this.clearClashVisualizations(); // Clear previous first
    if (!clashResults?.details || clashResults.details.length === 0) {
      // console.log(`Viewer ${this.viewerId}: No clashes to visualize.`); // Keep log minimal
      return;
    }

    console.log(`Viewer ${this.viewerId}: Visualizing ${clashResults.details.length} confirmed clashes.`);
    this.clashVisualizationGroup = new THREE.Group(); // Create the group
    this.clashVisualizationGroup.name = "clash-visualizations";

    clashResults.details.forEach((clash) => {
      const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.7,
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

      const meshA = this.elementMeshMap.get(clash.element1Id);
      const meshB = this.elementMeshMap.get(clash.element2Id);
      if (meshA && meshB) {
        const centerA = new THREE.Vector3();
        const centerB = new THREE.Vector3();
        new THREE.Box3().setFromObject(meshA, true).getCenter(centerA);
        new THREE.Box3().setFromObject(meshB, true).getCenter(centerB);
        sphere.position.lerpVectors(centerA, centerB, 0.5);
      } else {
        sphere.position.set(0, 1, 0);
      }

      sphere.userData = { ...clash };
      // Add sphere to the group (null check ensures group exists)
      if (this.clashVisualizationGroup) {
        this.clashVisualizationGroup.add(sphere);
      }
    });
    // Add the group to the scene (null check ensures group exists)
    if (this.clashVisualizationGroup) {
      this.scene.add(this.clashVisualizationGroup);
    }
  }

  public clearClashVisualizations(): void {
    if (this.clashVisualizationGroup) {
      console.log(`Viewer ${this.viewerId}: Clearing clash visualizations.`);
      // Dispose geometry/material of children?
      // For simple spheres, maybe not critical, but good practice:
      this.clashVisualizationGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      this.scene.remove(this.clashVisualizationGroup);
      this.clashVisualizationGroup = null;
    }
  }

  // Modified clear to also clear clash visuals
  clear(): void {
    // Abort any ongoing load before clearing
    if (this.currentLoadAbortController) {
      console.log(`Viewer ${this.viewerId}: Aborting potential ongoing load during clear.`);
      this.currentLoadAbortController.abort();
      this.currentLoadAbortController = null;
    }
    this.loadingPromise = null; // Clear promise on explicit clear
    console.log(`%c>>> IfcViewer ${this.viewerId}: CLEAR called!`, 'color: orange; font-weight: bold;');
    this.clearClashVisualizations();
    Object.values(this.materials).forEach(material => material.dispose());
    this.materials = {};
    if (this.ifcModelGroup) {
      this.scene.remove(this.ifcModelGroup);
      this.ifcModelGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
        }
      });
      this.ifcModelGroup = null;
    }
    // Store modelID locally before the check
    const modelIdToClose = this.modelID;
    // Explicitly check if ifcAPI exists AND we had a model ID to close
    if (this.ifcAPI && modelIdToClose !== null) {
      try {
        console.log("Closing model in web-ifc:", modelIdToClose);
        this.ifcAPI.CloseModel(modelIdToClose); // Use the local variable
      } catch (e) { console.error("Error closing model during clear:", e); }
    }
    this.modelID = null; // Reset the class property regardless
    this.selectedElements.clear();
    console.log(`   Clearing elementMeshMap (current size: ${this.elementMeshMap.size}) for viewer ${this.viewerId}...`);
    this.elementMeshMap.clear();
    this.isModelLoaded = false;
    console.log("Viewer scene cleared.");
  }

  // Clean up resources when done
  dispose(): void {
    console.log("Disposing IfcViewer...");
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.clear(); // Clear scene content and close model

    window.removeEventListener("resize", this.handleResize);

    this.renderer.dispose(); // Dispose renderer resources
    if (this.renderer.domElement.parentNode === this.container) {
      try {
        this.container.removeChild(this.renderer.domElement); // Remove canvas
      } catch (e) {
        console.warn("Could not remove renderer DOM element during dispose:", e);
      }
    }

    // Explicitly nullify to help GC, though IfcAPI might not have explicit dispose
    this.ifcAPI = null;

    console.log("IfcViewer disposed.");
  }

  // Public method to resize the viewer
  resize(): void {
    this.handleResize();
  }

  // Public method to access the ID
  public getId(): string {
    return this.viewerId;
  }

  // *** Clash Detection Method - Updated ***
  public performGeometricClashDetection(
    elementIdsA: number[],
    elementIdsB: number[],
    toleranceMm: number
  ): ClashResults {
    console.log(`Viewer: Performing geometric clash detection. Tolerance: ${toleranceMm}mm. Map Size: ${this.elementMeshMap.size}`);

    if (this.elementMeshMap.size === 0) {
      console.error("   Clash Check Aborted: elementMeshMap is empty!");
      return { clashes: 0, details: [] };
    }
    if (!elementIdsA || elementIdsA.length === 0 || !elementIdsB || elementIdsB.length === 0) {
      console.error("   Clash Check Aborted: Input element ID arrays are empty or invalid!");
      return { clashes: 0, details: [] };
    }

    const clashes: ClashResultDetail[] = [];
    const toleranceMeters = toleranceMm / 1000;
    const checkedPairs = new Set<string>();
    const boxA = new THREE.Box3();
    const boxB = new THREE.Box3();
    const centerA = new THREE.Vector3();
    const centerB = new THREE.Vector3();
    let skippedEmptyBoxA = 0;
    let skippedEmptyBoxB = 0;
    let skippedMeshNotFoundA = 0;
    let skippedMeshNotFoundB = 0;

    for (const idA of elementIdsA) {
      const meshA = this.elementMeshMap.get(idA);
      if (!meshA) {
        skippedMeshNotFoundA++;
        continue;
      }
      meshA.updateMatrixWorld(true);
      boxA.setFromObject(meshA, true);
      const isBoxAEmpty = boxA.isEmpty();
      if (isBoxAEmpty) {
        skippedEmptyBoxA++;
        continue;
      }
      boxA.getCenter(centerA);

      for (const idB of elementIdsB) {
        if (idA === idB) continue;
        const pairKey = idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
        if (checkedPairs.has(pairKey)) continue;
        checkedPairs.add(pairKey);

        const meshB = this.elementMeshMap.get(idB);
        if (!meshB) {
          skippedMeshNotFoundB++;
          continue;
        }
        meshB.updateMatrixWorld(true);
        boxB.setFromObject(meshB, true);
        const isBoxBEmpty = boxB.isEmpty();
        if (isBoxBEmpty) {
          skippedEmptyBoxB++;
          continue;
        }
        boxB.getCenter(centerB);

        const intersectsBBox = boxA.intersectsBox(boxB);
        const centerDistance = centerA.distanceTo(centerB);
        let potentialClash = false;
        let preCheckReason = "";

        if (intersectsBBox) {
          potentialClash = true;
          preCheckReason = "Boxes Intersect";
        } else if (centerDistance < toleranceMeters) {
          potentialClash = true;
          preCheckReason = `Centers Near (Dist: ${centerDistance.toFixed(4)}m < Tol: ${toleranceMeters}m)`;
        }

        if (potentialClash) {
          console.log(`   Potential Clash Pre-Check Passed: ${idA} vs ${idB} (${preCheckReason})`);
          const confirmedByRaycast = this._raycastMeshIntersection(meshA, meshB, toleranceMeters);
          if (confirmedByRaycast) {
            console.log(`      => Confirmed Clash by Raycast: ${idA} vs ${idB}`);
            clashes.push({ id: `clash-${idA}-${idB}`, element1Id: idA, element2Id: idB, boxIntersection: intersectsBBox });
          }
        }
      }
    }

    console.log(`Viewer: Clash detection summary: Skipped ${skippedMeshNotFoundA + skippedMeshNotFoundB} meshes (not found). Skipped ${skippedEmptyBoxA + skippedEmptyBoxB} empty BBoxes.`);
    console.log(`Viewer: Clash detection complete. Found ${clashes.length} confirmed clashes.`);
    return { clashes: clashes.length, details: clashes };
  }

  // *** Raycasting Helper Method - More Checks ***
  private _raycastMeshIntersection(
    objectA: THREE.Object3D,
    objectB: THREE.Object3D,
    tolerance: number
  ): boolean {
    const idA = objectA.userData?.expressID || 'unknownA';
    const idB = objectB.userData?.expressID || 'unknownB';

    const meshesA: THREE.Mesh[] = [];
    const meshesB: THREE.Mesh[] = [];

    objectA.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry?.type === 'BufferGeometry') { // Check type
        meshesA.push(child as THREE.Mesh);
      }
    });
    objectB.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry?.type === 'BufferGeometry') { // Check type
        meshesB.push(child as THREE.Mesh);
      }
    });

    if (meshesA.length === 0 || meshesB.length === 0) {
      return false;
    }

    const raycaster = new THREE.Raycaster();
    raycaster.far = tolerance;

    const directions = [
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
    ];

    const vertex = new THREE.Vector3();

    for (const meshA of meshesA) {
      const geometryA = meshA.geometry as THREE.BufferGeometry; // Cast is safe due to check above
      const positionA = geometryA.attributes.position;
      if (!positionA || positionA.count === 0) continue; // Skip if no position attribute or empty

      meshA.updateMatrixWorld(true);

      const minSamples = 500;
      const desiredFraction = 0.1;
      const calculatedStride = Math.max(1, Math.floor(1 / desiredFraction));
      const strideBasedOnCount = Math.max(1, Math.floor(positionA.count / minSamples));
      const stride = Math.min(calculatedStride, strideBasedOnCount);

      for (let i = 0; i < positionA.count; i += stride) {
        vertex.fromBufferAttribute(positionA, i);
        vertex.applyMatrix4(meshA.matrixWorld);

        for (const direction of directions) {
          raycaster.set(vertex, direction);

          // Ensure target meshes have up-to-date world matrices
          meshesB.forEach(meshTarget => meshTarget.updateMatrixWorld(true));

          const intersects = raycaster.intersectObjects(meshesB, false);

          if (intersects.length > 0) {
            // Check distance explicitly, as raycaster.far might not be absolute? 
            if (intersects[0].distance <= tolerance) {
              return true; // Confirmed hit within tolerance
            }
          }
        }
      }
    }

    return false; // No confirmed hits found
  }

  public isReady(): boolean { // New method to check readiness
    return this.isModelLoaded && this.elementMeshMap.size > 0;
  }
}
