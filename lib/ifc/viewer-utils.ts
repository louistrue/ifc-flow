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

// The main viewer class that handles 3D rendering
export class IfcViewer {
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

  constructor(
    private container: HTMLElement,
    private options: ViewerOptions = {}
  ) {
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

  // Load an IFC model using web-ifc's geometry loader and build THREE meshes
  async loadIfc(file: File): Promise<void> {
    console.log("Loading IFC file:", file.name);
    let tempModelID: number | null = null;

    try {
      const ifcAPI = await this.initIfcAPI();
      if (!ifcAPI) throw new Error("IFC API not initialized");

      this.clear();

      console.log("Reading file buffer...");
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      console.log("Opening IFC model with web-ifc...");
      tempModelID = ifcAPI.OpenModel(data);
      this.modelID = tempModelID;
      console.log("Model opened, ID:", this.modelID);

      console.log("Requesting geometry data generation...");
      // LoadAllGeometry returns a Vector<FlatMesh> handle
      const flatMeshVector: Vector<FlatMesh> = await ifcAPI.LoadAllGeometry(this.modelID);
      console.log("Geometry data vector obtained.");

      this.ifcModelGroup = new THREE.Group();
      this.ifcModelGroup.name = file.name;

      const numFlatMeshes = flatMeshVector.size();
      console.log(`Processing ${numFlatMeshes} flat meshes...`);

      for (let i = 0; i < numFlatMeshes; i++) {
        const flatMesh: FlatMesh = flatMeshVector.get(i); // Get FlatMesh handle
        const placedGeometryVector: Vector<PlacedGeometry> = flatMesh.geometries;
        const numPlacedGeometries = placedGeometryVector.size();

        for (let j = 0; j < numPlacedGeometries; j++) {
          const placedGeometry: PlacedGeometry = placedGeometryVector.get(j); // Get PlacedGeometry handle
          // Get the geometry handle using the expressID from PlacedGeometry
          const geometryHandle: IfcGeometry = ifcAPI.GetGeometry(this.modelID, placedGeometry.geometryExpressID);

          if (geometryHandle) {
            const threeMesh = this.createThreeMesh(geometryHandle, placedGeometry);
            if (threeMesh) {
              // Associate the mesh with the original product ID if needed for picking/highlighting later
              // threeMesh.userData = { expressID: flatMesh.expressID };
              this.ifcModelGroup.add(threeMesh);
            }
            geometryHandle.delete(); // Clean up geometry handle
          } else {
            // console.warn(`Could not get geometry handle for instance geometryExpressID: ${placedGeometry.geometryExpressID}`);
          }
          // PlacedGeometry might not have a delete method, check API if needed
          // placedGeometry.delete();
        }
      }

      // The Vector handle itself might not need deletion, only its contents
      // REMOVED: flatMeshVector.delete();
      console.log("Finished processing geometry subsets.");

      if (this.ifcModelGroup.children.length > 0) {
        this.scene.add(this.ifcModelGroup);
        console.log(`IFC model group with ${this.ifcModelGroup.children.length} meshes added to scene.`);
      } else {
        console.warn("No valid meshes were generated from the IFC geometry data.");
        this.ifcModelGroup = null;
      }

      this.fitCameraToModel();

    } catch (error) {
      console.error("Error loading IFC for visualization:", error);
      const idToClose = this.modelID !== null ? this.modelID : tempModelID;
      if (this.ifcAPI && idToClose !== null) {
        try {
          console.log("Closing potentially opened model in web-ifc:", idToClose);
          this.ifcAPI.CloseModel(idToClose);
        } catch (closeError) {
          console.error("Error closing model after load failure:", closeError);
        }
      }
      this.modelID = null;
      this.ifcModelGroup = null;
      try { this.clear(); } catch (clearError) { console.error("Error during clear after load failure:", clearError); }
      throw error;
    }
  }

  // Helper function to create a THREE.Mesh from web-ifc geometry data handles
  private createThreeMesh(geometryHandle: IfcGeometry, placedGeometry: PlacedGeometry): THREE.Mesh | null {
    try {
      // Use local variable for null check safety
      const ifcAPI = this.ifcAPI;
      if (!ifcAPI || this.modelID === null) return null;

      // REMOVED geometry type check - attempt to process all as mesh
      // const geometryType = geometryHandle.GetGeometryType();
      // if (geometryType === ifcAPI.IFCMESH || geometryType === ifcAPI.IFCSOLID || geometryType === ifcAPI.IFCFACETEDBREP)

      // Attempt to get vertex and index data, might fail for non-mesh types
      const vertexDataPtr = geometryHandle.GetVertexData();
      const vertexDataSize = geometryHandle.GetVertexDataSize();
      const indexDataPtr = geometryHandle.GetIndexData();
      const indexDataSize = geometryHandle.GetIndexDataSize();

      if (!vertexDataPtr || vertexDataSize === 0 || !indexDataPtr || indexDataSize === 0) {
        // console.warn(`Invalid or zero-sized geometry data pointers/sizes for geometry ID: ${placedGeometry.geometryExpressID}`);
        return null;
      }

      const vertices = ifcAPI.GetVertexArray(vertexDataPtr, vertexDataSize);
      const indices = ifcAPI.GetIndexArray(indexDataPtr, indexDataSize);

      if (!vertices || vertices.length === 0 || !indices || indices.length === 0) {
        // console.warn(`Empty vertices or indices array for geometry ID: ${placedGeometry.geometryExpressID}`);
        return null;
      }

      const bufferGeometry = new THREE.BufferGeometry();
      if (vertices.length % 3 !== 0) {
        console.warn("Vertices array length is not a multiple of 3 for geometry ID:", placedGeometry.geometryExpressID);
        return null;
      }
      bufferGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      bufferGeometry.setIndex(new THREE.Uint32BufferAttribute(indices, 1));
      try {
        bufferGeometry.computeVertexNormals();
      } catch (normError) {
        console.warn("Could not compute vertex normals for geometry ID:", placedGeometry.geometryExpressID, normError);
      }

      const { color } = placedGeometry;
      if (!color) {
        console.warn("Missing color data in placed geometry:", placedGeometry);
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
        console.warn("Missing or invalid flatTransformation in placed geometry:", placedGeometry);
      }
      return mesh;

    } catch (e) {
      // Catch errors during geometry data access (e.g., GetVertexData on non-mesh)
      console.warn("Error processing geometry handle (likely not a mesh/solid/brep):", e, "GeometryHandle:", geometryHandle, "PlacedGeometry:", placedGeometry);
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

  // Clear the scene
  clear(): void {
    console.log("Clearing viewer scene...");
    // Dispose materials first
    Object.values(this.materials).forEach(material => material.dispose());
    this.materials = {};

    // Remove and dispose the main model group
    if (this.ifcModelGroup) {
      this.scene.remove(this.ifcModelGroup);

      // Dispose geometry and materials within the group
      this.ifcModelGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          // Materials are disposed above via the cache
        }
      });
      this.ifcModelGroup = null; // Set to null after disposal
    }

    // Close the model in web-ifc API if it's open and we have an instance
    // Use a local check for ifcAPI as it might be null if constructor failed
    const localIfcApi = this.ifcAPI;
    if (localIfcApi && this.modelID !== null) {
      try {
        console.log("Closing model in web-ifc:", this.modelID);
        localIfcApi.CloseModel(this.modelID);
      } catch (e) {
        console.error("Error closing model during clear:", e);
      }
    }
    this.modelID = null; // Always reset modelID

    this.selectedElements.clear(); // Clear selection set
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
}
