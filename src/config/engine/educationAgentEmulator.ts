export type AgentFacing = "NORTH" | "SOUTH" | "EAST" | "WEST";

export type AgentMoveDirection =
  | "FORWARD"
  | "BACK"
  | "LEFT"
  | "RIGHT"
  | "UP"
  | "DOWN";

export type AgentTurnDirection = "LEFT" | "RIGHT";

export type AgentPlaceDirection = "FORWARD" | "BACK" | "LEFT" | "RIGHT" | "UP" | "DOWN";

export interface AgentPosition {
  x: number;
  y: number;
  z: number;
  facing: AgentFacing;
}

export interface PlacedBlock {
  x: number;
  y: number;
  z: number;
  itemId: string;
  slot: number;
}

export interface AgentHotbarSlot {
  itemId: string;
  count: number;
}

const FACING_ORDER: AgentFacing[] = ["NORTH", "EAST", "SOUTH", "WEST"];

const FORWARD_DELTA: Record<AgentFacing, { x: number; z: number }> = {
  NORTH: { x: 0, z: -1 },
  SOUTH: { x: 0, z: 1 },
  EAST: { x: 1, z: 0 },
  WEST: { x: -1, z: 0 },
};

export class EducationAgentEmulator {
  private position: AgentPosition;
  private hotbar = new Map<number, AgentHotbarSlot>();
  private placed: PlacedBlock[] = [];
  private logs: string[] = [];

  constructor(start: AgentPosition) {
    this.position = { ...start };
  }

  public setItem(slot: number, itemId: string, count: number): void {
    this.hotbar.set(slot, { itemId, count });
  }

  public getPosition(): AgentPosition {
    return { ...this.position };
  }

  public getPlacedBlocks(): PlacedBlock[] {
    return this.placed.map((block) => ({ ...block }));
  }

  public getLogs(): string[] {
    return [...this.logs];
  }

  public log(message: string): void {
    this.logs.push(message);
  }

  public turn(direction: AgentTurnDirection): void {
    const current = FACING_ORDER.indexOf(this.position.facing);
    const delta = direction === "RIGHT" ? 1 : -1;
    this.position.facing =
      FACING_ORDER[(current + delta + FACING_ORDER.length) % FACING_ORDER.length]!;
  }

  public move(direction: AgentMoveDirection, blocks = 1): void {
    const steps = Math.max(0, Math.floor(blocks));
    for (let i = 0; i < steps; i++) {
      if (direction === "UP") {
        this.position.y += 1;
        continue;
      }
      if (direction === "DOWN") {
        this.position.y -= 1;
        continue;
      }
      const facing = this.relativeFacing(direction);
      const delta = FORWARD_DELTA[facing];
      this.position.x += delta.x;
      this.position.z += delta.z;
    }
  }

  public place(direction: AgentPlaceDirection, slot: number): void {
    const stack = this.hotbar.get(slot);
    if (!stack || stack.count < 1) {
      throw new Error(`Agent slot ${slot} is empty`);
    }
    const target = this.adjacent(direction);
    this.placed.push({
      x: target.x,
      y: target.y,
      z: target.z,
      itemId: stack.itemId,
      slot,
    });
    stack.count -= 1;
  }

  public executePythonScript(commands: Array<() => void>): void {
    for (const command of commands) {
      command();
    }
  }

  private relativeFacing(
    direction: Exclude<AgentMoveDirection, "UP" | "DOWN">,
  ): AgentFacing {
    if (direction === "FORWARD") return this.position.facing;
    if (direction === "BACK") {
      return FACING_ORDER[
        (FACING_ORDER.indexOf(this.position.facing) + 2) % FACING_ORDER.length
      ]!;
    }
    if (direction === "LEFT") {
      return FACING_ORDER[
        (FACING_ORDER.indexOf(this.position.facing) + 3) % FACING_ORDER.length
      ]!;
    }
    return FACING_ORDER[
      (FACING_ORDER.indexOf(this.position.facing) + 1) % FACING_ORDER.length
    ]!;
  }

  private adjacent(direction: AgentPlaceDirection): { x: number; y: number; z: number } {
    if (direction === "UP") {
      return { x: this.position.x, y: this.position.y + 1, z: this.position.z };
    }
    if (direction === "DOWN") {
      return { x: this.position.x, y: this.position.y - 1, z: this.position.z };
    }
    const facing = this.relativeFacing(direction);
    const delta = FORWARD_DELTA[facing];
    return {
      x: this.position.x + delta.x,
      y: this.position.y,
      z: this.position.z + delta.z,
    };
  }
}
