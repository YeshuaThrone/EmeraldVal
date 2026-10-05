export type RedstoneNodeType = "dust" | "repeater" | "torch" | "block";

export interface RedstoneNode {
  x: number;
  y: number;
  z: number;
  type?: RedstoneNodeType;
  power?: number;
}

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

const NEIGHBORS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
] as const;

export class RedstoneSimulator {
  private nodes = new Map<
    string,
    { x: number; y: number; z: number; type: RedstoneNodeType; power: number }
  >();

  public setNode(node: RedstoneNode): void {
    if (![node.x, node.y, node.z].every(Number.isFinite)) {
      throw new Error("Redstone node coordinates must be numbers");
    }
    this.nodes.set(key(node.x, node.y, node.z), {
      x: node.x,
      y: node.y,
      z: node.z,
      type: node.type ?? "dust",
      power: Math.max(0, Math.min(15, node.power ?? 0)),
    });
  }

  public propagateSignal(
    startX: number,
    startY: number,
    startZ: number,
    initialPower = 15,
  ): void {
    if (![startX, startY, startZ, initialPower].every(Number.isFinite)) {
      throw new Error("Redstone propagation requires numeric coordinates and power");
    }
    const power = Math.max(0, Math.min(15, Math.floor(initialPower)));
    if (!this.nodes.has(key(startX, startY, startZ))) {
      this.setNode({ x: startX, y: startY, z: startZ, type: "dust", power: 0 });
    }

    const queue: Array<{ x: number; y: number; z: number; incoming: number }> = [
      { x: startX, y: startY, z: startZ, incoming: power },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = this.nodes.get(key(current.x, current.y, current.z));
      if (!node) continue;

      const nextPower =
        node.type === "repeater" || node.type === "torch"
          ? current.incoming > 0
            ? 15
            : 0
          : current.incoming;
      if (nextPower <= node.power) continue;
      node.power = nextPower;

      const outgoing =
        node.type === "dust" ? Math.max(0, node.power - 1) : node.power;
      if (outgoing <= 0) continue;

      for (const [dx, dy, dz] of NEIGHBORS) {
        queue.push({
          x: current.x + dx,
          y: current.y + dy,
          z: current.z + dz,
          incoming: outgoing,
        });
      }
    }
  }

  public getNodePower(x: number, y: number, z: number): number {
    return this.nodes.get(key(x, y, z))?.power ?? 0;
  }
}
