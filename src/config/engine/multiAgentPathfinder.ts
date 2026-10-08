export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

function posKey(pos: Vector3D): string {
  return `${pos.x},${pos.y},${pos.z}`;
}

const NEIGHBORS: Vector3D[] = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

export class MultiAgentPathfinder {
  private static reserved = new Map<string, string>();

  public static clearReservations(): void {
    this.reserved.clear();
  }

  public static reservePosition(agentId: string, pos: Vector3D): boolean {
    const key = posKey(pos);
    const owner = this.reserved.get(key);
    if (owner && owner !== agentId) return false;
    this.reserved.set(key, agentId);
    return true;
  }

  public static releasePosition(pos: Vector3D): void {
    this.reserved.delete(posKey(pos));
  }

  /**
   * 6-connected BFS that never steps onto another agent's reserved cell.
   */
  public static findPath(start: Vector3D, target: Vector3D): Vector3D[] {
    const startKey = posKey(start);
    const targetKey = posKey(target);
    if (startKey === targetKey) return [{ ...start }];

    const minX = Math.min(start.x, target.x) - 16;
    const maxX = Math.max(start.x, target.x) + 16;
    const minY = Math.min(start.y, target.y) - 4;
    const maxY = Math.max(start.y, target.y) + 4;
    const minZ = Math.min(start.z, target.z) - 16;
    const maxZ = Math.max(start.z, target.z) + 16;

    const isBlocked = (pos: Vector3D, key: string): boolean => {
      if (key === startKey) return false;
      return this.reserved.has(key);
    };

    const queue: Vector3D[] = [{ ...start }];
    const cameFrom = new Map<string, Vector3D | null>([[startKey, null]]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = posKey(current);
      if (currentKey === targetKey) {
        return reconstructPath(cameFrom, current);
      }

      for (const delta of NEIGHBORS) {
        const next: Vector3D = {
          x: current.x + delta.x,
          y: current.y + delta.y,
          z: current.z + delta.z,
        };
        if (
          next.x < minX ||
          next.x > maxX ||
          next.y < minY ||
          next.y > maxY ||
          next.z < minZ ||
          next.z > maxZ
        ) {
          continue;
        }
        const nextKey = posKey(next);
        if (cameFrom.has(nextKey) || isBlocked(next, nextKey)) continue;
        cameFrom.set(nextKey, current);
        queue.push(next);
      }
    }

    return reconstructPath(cameFrom, closestReachable(cameFrom, start, target));
  }
}

function reconstructPath(
  cameFrom: Map<string, Vector3D | null>,
  end: Vector3D,
): Vector3D[] {
  const path: Vector3D[] = [];
  let current: Vector3D | null = end;
  while (current) {
    path.push({ ...current });
    current = cameFrom.get(posKey(current)) ?? null;
  }
  path.reverse();
  return path;
}

function closestReachable(
  cameFrom: Map<string, Vector3D | null>,
  start: Vector3D,
  target: Vector3D,
): Vector3D {
  let best = start;
  let bestDist = manhattan(start, target);
  for (const key of cameFrom.keys()) {
    const [x, y, z] = key.split(",").map(Number) as [number, number, number];
    const pos = { x, y, z };
    const dist = manhattan(pos, target);
    if (dist < bestDist) {
      best = pos;
      bestDist = dist;
    }
  }
  return best;
}

function manhattan(a: Vector3D, b: Vector3D): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
}
