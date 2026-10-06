import { describe, expect, it } from "vitest";
import { Redstone3DRenderer } from "./redstone3DRenderer";

class FakeRenderer {
  domElement = { nodeName: "CANVAS", style: {} as Record<string, string> };
  setSize() {}
  render() {}
  dispose() {}
}

class MockWebSocket {
  static lastUrl = "";
  onmessage: ((event: { data: string }) => void) | null = null;
  closed = false;

  constructor(url: string) {
    MockWebSocket.lastUrl = url;
  }

  close() {
    this.closed = true;
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function makeContainer() {
  const appended: unknown[] = [];
  return {
    clientWidth: 800,
    clientHeight: 600,
    appended,
    appendChild(child: unknown) {
      appended.push(child);
      return child;
    },
  };
}

describe("Redstone3DRenderer", () => {
  it("glows dust meshes from REDSTONE_TICK power 0-15", () => {
    const container = makeContainer();
    const ws = { current: null as MockWebSocket | null };
    const renderer = new Redstone3DRenderer(container as unknown as HTMLElement, {
      autoAnimate: false,
      renderer: new FakeRenderer() as never,
      WebSocketImpl: class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          ws.current = this;
        }
      },
    });

    expect(MockWebSocket.lastUrl).toBe("ws://127.0.0.1:8080");
    expect(container.appended).toHaveLength(1);

    ws.current?.emit({
      type: "REDSTONE_TICK",
      payload: {
        activeNodes: [
          { x: 2, y: 64, z: 4, power: 15 },
          { x: 3, y: 64, z: 4, power: 0 },
        ],
      },
    });

    expect(renderer.getNodeCount()).toBe(2);
    const hot = renderer.getNodeMaterial(2, 64, 4);
    const cold = renderer.getNodeMaterial(3, 64, 4);
    expect(hot?.emissive.getHex()).toBe(0xff0000);
    expect(hot?.emissiveIntensity).toBe(2);
    expect(cold?.emissive.getHex()).toBe(0x000000);
    expect(cold?.emissiveIntensity).toBe(0);

    renderer.applySignalState([{ x: 2, y: 64, z: 4, power: 8 }]);
    expect(renderer.getNodeCount()).toBe(2);
    expect(renderer.getNodeMaterial(2, 64, 4)?.emissiveIntensity).toBeCloseTo(16 / 15);

    renderer.destroy();
    expect(ws.current?.closed).toBe(true);
  });
});
