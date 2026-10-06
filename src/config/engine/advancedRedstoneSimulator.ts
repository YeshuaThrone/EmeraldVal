export type AdvancedRedstoneNodeType =
  | "COMPARATOR"
  | "REPEATER"
  | "DUST"
  | "TORCH"
  | "BLOCK";

export interface AdvancedRedstoneNode {
  x: number;
  y: number;
  z: number;
  type: AdvancedRedstoneNodeType;
  power: number;
  isSubtractMode?: boolean;
  delayTicks?: number;
}

function key(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

function clampPower(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(15, Math.floor(value)));
}

export class AdvancedRedstoneSimulator {
  private nodes = new Map<string, AdvancedRedstoneNode>();

  public setNode(node: AdvancedRedstoneNode): void {
    if (![node.x, node.y, node.z].every(Number.isFinite)) {
      throw new Error("Redstone node coordinates must be numbers");
    }
    this.nodes.set(key(node.x, node.y, node.z), {
      ...node,
      power: clampPower(node.power),
    });
  }

  /**
   * Evaluates a placed component given rear (back) and side input strengths.
   * Comparator subtract mode: max(0, rear - side).
   * Repeater: any powered rear input is boosted to 15.
   */
  public evaluateNode(
    x: number,
    y: number,
    z: number,
    rearSignal: number,
    sideSignal: number,
  ): number {
    const node = this.nodes.get(key(x, y, z));
    if (!node) return 0;

    const rear = clampPower(rearSignal);
    const side = clampPower(sideSignal);
    let output = 0;

    switch (node.type) {
      case "COMPARATOR":
        output = node.isSubtractMode
          ? Math.max(0, rear - side)
          : rear >= side
            ? rear
            : 0;
        break;
      case "REPEATER":
        output = rear > 0 ? 15 : 0;
        break;
      case "TORCH":
        output = rear > 0 ? 0 : 15;
        break;
      default:
        output = rear;
        break;
    }

    node.power = output;
    return output;
  }

  public getNodePower(x: number, y: number, z: number): number {
    return this.nodes.get(key(x, y, z))?.power ?? 0;
  }
}
