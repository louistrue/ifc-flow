import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { IfcAPI } from "web-ifc";
import { IfcModel, IfcElement } from "@/lib/ifc-utils";

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
  private meshes: Map<string, THREE.Mesh> = new Map();
  private selectedElements: Set<string> = new Set();
  private highlightMaterial: THREE.MeshBasicMaterial;
  private originalMaterials: Map<string, THREE.Material> = new Map();
  private animationFrameId: number | null = null;

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

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Set up controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);

    // Add grid and axes if needed
    if (options.showGrid !== false) {
      const grid = new THREE.GridHelper(50, 50);
      this.scene.add(grid);
    }

    if (options.showAxes !== false) {
      const axes = new THREE.AxesHelper(5);
      this.scene.add(axes);
    }

    // Highlight material for selected elements
    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: options.highlightColor || 0xff0000,
      transparent: true,
      opacity: 0.5,
    });

    // Start animation loop
    this.animate();

    // Handle window resize
    window.addEventListener("resize", this.handleResize);
  }

  // Initialize IfcAPI for web-ifc
  async initIfcAPI(): Promise<void> {
    if (!this.ifcAPI) {
      this.ifcAPI = new IfcAPI();
      await this.ifcAPI.Init();
    }
  }

  // Load an IFC model (using web-ifc for geometry)
  async loadIfc(file: File): Promise<void> {
    try {
      await this.initIfcAPI();

      if (!this.ifcAPI) {
        throw new Error("IFC API not initialized");
      }

      // Read the file
      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      // Load the model
      this.modelID = this.ifcAPI.OpenModel(data);

      // Get all meshes
      await this.loadAllGeometry();

      // Center camera on model
      this.fitCameraToModel();
    } catch (error) {
      console.error("Error loading IFC for visualization:", error);
      throw error;
    }
  }

  // Alternative loading method using a pre-loaded IfcModel
  async loadFromModel(model: IfcModel): Promise<void> {
    // This would use Three.js to create basic geometry for the model
    // In a real implementation, this would use the geometry from web-ifc
    // For now, we'll create simple placeholder geometry

    this.clear();

    for (const element of model.elements) {
      let geometry: THREE.BufferGeometry;
      let material = new THREE.MeshStandardMaterial({
        color: this.getColorForType(element.type),
      });

      // Create different geometry based on element type
      switch (element.type.toUpperCase()) {
        case "IFCWALL":
        case "IFCWALLSTANDARDCASE":
          geometry = new THREE.BoxGeometry(4, 3, 0.3);
          break;
        case "IFCSLAB":
          geometry = new THREE.BoxGeometry(4, 0.3, 4);
          break;
        case "IFCCOLUMN":
          geometry = new THREE.CylinderGeometry(0.2, 0.2, 3, 16);
          break;
        case "IFCBEAM":
          geometry = new THREE.BoxGeometry(4, 0.3, 0.2);
          break;
        case "IFCDOOR":
          geometry = new THREE.BoxGeometry(1, 2.1, 0.1);
          material = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
          break;
        case "IFCWINDOW":
          geometry = new THREE.BoxGeometry(1.5, 1.5, 0.1);
          material = new THREE.MeshStandardMaterial({
            color: 0xadd8e6,
            transparent: true,
            opacity: 0.5,
          });
          break;
        default:
          geometry = new THREE.BoxGeometry(1, 1, 1);
      }

      const mesh = new THREE.Mesh(geometry, material);

      // Spread elements out based on their index in the array
      const idx = model.elements.indexOf(element);
      const row = Math.floor(idx / 5);
      const col = idx % 5;
      mesh.position.set(col * 5, 0, row * 5);

      // Store original material
      this.originalMaterials.set(element.id, material);

      // Add to scene and track
      this.scene.add(mesh);
      this.meshes.set(element.id, mesh);
    }

    // Center camera on model
    this.fitCameraToModel();
  }

  // Load all geometry from the IFC model
  private async loadAllGeometry(): Promise<void> {
    if (!this.ifcAPI || this.modelID === null) {
      return;
    }

    try {
      // Get all IFC types to load
      const ifcTypes = [
        0x136, // IFCWALL
        0x142, // IFCWALLSTANDARDCASE
        0x230, // IFCSLAB
        0xbf8, // IFCCOLUMN
        0x124, // IFCBEAM
        0x275, // IFCDOOR
        0x290, // IFCWINDOW
      ];

      // Load each type
      for (const type of ifcTypes) {
        const ids = this.ifcAPI.GetLineIDsWithType(this.modelID, type);

        for (let i = 0; i < ids.size(); i++) {
          const id = ids.get(i);
          const props = this.ifcAPI.GetLine(this.modelID, id);
          const typeName = this.getIfcTypeName(type);

          // Create simple geometry based on type
          let geometry: THREE.BufferGeometry;
          let material = new THREE.MeshStandardMaterial({
            color: this.getColorForType(typeName),
          });

          // Create different geometry based on element type
          switch (typeName) {
            case "IFCWALL":
            case "IFCWALLSTANDARDCASE":
              geometry = new THREE.BoxGeometry(4, 3, 0.3);
              break;
            case "IFCSLAB":
              geometry = new THREE.BoxGeometry(4, 0.3, 4);
              break;
            case "IFCCOLUMN":
              geometry = new THREE.CylinderGeometry(0.2, 0.2, 3, 16);
              break;
            case "IFCBEAM":
              geometry = new THREE.BoxGeometry(4, 0.3, 0.2);
              break;
            case "IFCDOOR":
              geometry = new THREE.BoxGeometry(1, 2.1, 0.1);
              material = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
              break;
            case "IFCWINDOW":
              geometry = new THREE.BoxGeometry(1.5, 1.5, 0.1);
              material = new THREE.MeshStandardMaterial({
                color: 0xadd8e6,
                transparent: true,
                opacity: 0.5,
              });
              break;
            default:
              geometry = new THREE.BoxGeometry(1, 1, 1);
          }

          const mesh = new THREE.Mesh(geometry, material);

          // Position mesh (in a real implementation, would use actual geometry coordinates)
          mesh.position.set(
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
          );

          // Store original material
          this.originalMaterials.set(`${typeName}-${id}`, material);

          // Add to scene and track
          this.scene.add(mesh);
          this.meshes.set(`${typeName}-${id}`, mesh);
        }
      }
    } catch (error) {
      console.error("Error loading geometry:", error);
    }
  }

  // Utility to get the IFC type name from numeric code
  private getIfcTypeName(typeCode: number): string {
    const typeMap: Record<number, string> = {
      0x136: "IFCWALL",
      0x142: "IFCWALLSTANDARDCASE",
      0x230: "IFCSLAB",
      0xbf8: "IFCCOLUMN",
      0x124: "IFCBEAM",
      0x275: "IFCDOOR",
      0x290: "IFCWINDOW",
    };

    return typeMap[typeCode] || "IFCELEMENT";
  }

  // Utility to get color based on element type
  private getColorForType(type: string): number {
    const typeUpperCase = type.toUpperCase();
    const colorMap: Record<string, number> = {
      IFCWALL: 0xcccccc,
      IFCWALLSTANDARDCASE: 0xcccccc,
      IFCSLAB: 0x999999,
      IFCCOLUMN: 0x666666,
      IFCBEAM: 0x888888,
      IFCDOOR: 0x8b4513,
      IFCWINDOW: 0xadd8e6,
    };

    return colorMap[typeUpperCase] || 0xff00ff;
  }

  // Highlight specific elements
  highlightElements(elementIds: string[]): void {
    // Reset previous selection
    this.clearHighlights();

    // Highlight new elements
    for (const id of elementIds) {
      const mesh = this.meshes.get(id);
      if (mesh) {
        this.selectedElements.add(id);
        mesh.material = this.highlightMaterial;
      }
    }
  }

  // Clear all highlights
  clearHighlights(): void {
    for (const id of this.selectedElements) {
      const mesh = this.meshes.get(id);
      const material = this.originalMaterials.get(id);
      if (mesh && material) {
        mesh.material = material;
      }
    }
    this.selectedElements.clear();
  }

  // Fit camera to model bounds
  fitCameraToModel(): void {
    if (this.meshes.size === 0) return;

    // Create a bounding box for all meshes
    const box = new THREE.Box3();

    for (const mesh of this.meshes.values()) {
      box.expandByObject(mesh);
    }

    // Get center and size of the box
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    // Calculate distance based on box size
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));

    // Add some margin
    cameraDistance *= 1.5;

    // Position camera
    const direction = new THREE.Vector3(1, 1, 1).normalize();
    const position = center
      .clone()
      .add(direction.multiplyScalar(cameraDistance));

    this.camera.position.copy(position);
    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  // Clear the scene
  clear(): void {
    // Remove all meshes
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }

    this.meshes.clear();
    this.originalMaterials.clear();
    this.selectedElements.clear();
  }

  // Clean up resources when done
  dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.clear();

    window.removeEventListener("resize", this.handleResize);

    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);

    if (this.ifcAPI && this.modelID !== null) {
      this.ifcAPI.CloseModel(this.modelID);
    }
  }

  // Public method to resize the viewer
  resize(): void {
    this.handleResize();
  }
}
