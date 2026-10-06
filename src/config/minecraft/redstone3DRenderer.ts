import * as THREE from "three";

export interface RedstoneNodeUpdate {
  x: number;
  y: number;
  z: number;
  power: number; // 0 - 15
}

export interface Redstone3DRendererOptions {
  wsUrl?: string;
  autoConnect?: boolean;
  autoAnimate?: boolean;
  renderer?: THREE.WebGLRenderer;
  WebSocketImpl?: { new (url: string): WebSocket };
}

export class Redstone3DRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private nodeMeshes = new Map<string, THREE.Mesh>();
  private ws: WebSocket | null = null;
  private animationFrame: number | null = null;
  private readonly WebSocketImpl: { new (url: string): WebSocket };

  constructor(containerElement: HTMLElement, options: Redstone3DRendererOptions = {}) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    const width = containerElement.clientWidth || 1;
    const height = containerElement.clientHeight || 1;

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(10, 15, 20);
    this.camera.lookAt(0, 0, 0);

    this.renderer =
      options.renderer ?? new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    containerElement.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    this.WebSocketImpl = options.WebSocketImpl ?? WebSocket;

    if (options.autoAnimate !== false) {
      this.animate();
    }
    if (options.autoConnect !== false) {
      this.connectWebSocket(options.wsUrl ?? "ws://localhost:8080");
    }
  }

  private connectWebSocket(url: string) {
    this.ws = new this.WebSocketImpl(url);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as {
          type?: unknown;
          payload?: { activeNodes?: RedstoneNodeUpdate[] };
        };
        if (data.type === "REDSTONE_TICK" && data.payload?.activeNodes) {
          this.updateSignalState(data.payload.activeNodes);
        }
      } catch (err) {
        console.error("Failed to parse WS signal payload:", err);
      }
    };
  }

  public applySignalState(nodes: RedstoneNodeUpdate[]): void {
    this.updateSignalState(nodes);
  }

  public getNodeCount(): number {
    return this.nodeMeshes.size;
  }

  public getNodeMaterial(
    x: number,
    y: number,
    z: number,
  ): THREE.MeshStandardMaterial | undefined {
    const mesh = this.nodeMeshes.get(`${x},${y},${z}`);
    if (!mesh) return undefined;
    return mesh.material as THREE.MeshStandardMaterial;
  }

  private updateSignalState(nodes: RedstoneNodeUpdate[]) {
    nodes.forEach((node) => {
      const key = `${node.x},${node.y},${node.z}`;
      let mesh = this.nodeMeshes.get(key);

      if (!mesh) {
        const geometry = new THREE.BoxGeometry(0.8, 0.2, 0.8);
        const material = new THREE.MeshStandardMaterial({
          color: 0x330000,
          emissive: 0x000000,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(node.x, node.y, node.z);
        this.scene.add(mesh);
        this.nodeMeshes.set(key, mesh);
      }

      // Scale glow intensity based on Redstone power (0 to 15)
      const powerPct = Math.min(15, Math.max(0, node.power)) / 15;
      const material = mesh.material as THREE.MeshStandardMaterial;

      material.emissive.setHex(powerPct > 0 ? 0xff0000 : 0x000000);
      material.emissiveIntensity = powerPct * 2.0;
    });
  }

  private animate = () => {
    this.animationFrame = requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    if (this.animationFrame != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.ws) this.ws.close();
    this.renderer.dispose();
  }
}
