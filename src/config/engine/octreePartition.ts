export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox3D {
  min: Vector3D;
  max: Vector3D;
}

export interface SpatialEntity {
  id: string;
  position: Vector3D;
}

const MAX_ENTITIES = 8;
const MAX_DEPTH = 8;

function containsPoint(box: BoundingBox3D, point: Vector3D): boolean {
  return (
    point.x >= box.min.x &&
    point.x <= box.max.x &&
    point.y >= box.min.y &&
    point.y <= box.max.y &&
    point.z >= box.min.z &&
    point.z <= box.max.z
  );
}

function intersects(a: BoundingBox3D, b: BoundingBox3D): boolean {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y &&
    a.min.z <= b.max.z &&
    a.max.z >= b.min.z
  );
}

function octantBounds(parent: BoundingBox3D, index: number): BoundingBox3D {
  const mid: Vector3D = {
    x: (parent.min.x + parent.max.x) / 2,
    y: (parent.min.y + parent.max.y) / 2,
    z: (parent.min.z + parent.max.z) / 2,
  };
  const min: Vector3D = { ...parent.min };
  const max: Vector3D = { ...parent.max };
  if (index & 1) min.x = mid.x;
  else max.x = mid.x;
  if (index & 2) min.y = mid.y;
  else max.y = mid.y;
  if (index & 4) min.z = mid.z;
  else max.z = mid.z;
  return { min, max };
}

export class OctreeNode {
  private children: OctreeNode[] | null = null;
  private entities: SpatialEntity[] = [];

  constructor(
    private readonly bounds: BoundingBox3D,
    private readonly depth = 0,
  ) {}

  public insert(entity: SpatialEntity): boolean {
    if (!containsPoint(this.bounds, entity.position)) return false;

    if (
      !this.children &&
      (this.entities.length < MAX_ENTITIES || this.depth >= MAX_DEPTH)
    ) {
      this.entities.push(entity);
      return true;
    }

    if (!this.children) {
      this.subdivide();
    }

    for (const child of this.children ?? []) {
      if (child.insert(entity)) return true;
    }

    this.entities.push(entity);
    return true;
  }

  public queryRange(range: BoundingBox3D): SpatialEntity[] {
    if (!intersects(this.bounds, range)) return [];

    const found = this.entities.filter((entity) =>
      containsPoint(range, entity.position),
    );
    if (this.children) {
      for (const child of this.children) {
        found.push(...child.queryRange(range));
      }
    }
    return found;
  }

  private subdivide(): void {
    this.children = Array.from({ length: 8 }, (_, index) => {
      return new OctreeNode(octantBounds(this.bounds, index), this.depth + 1);
    });
    const pending = this.entities;
    this.entities = [];
    for (const entity of pending) {
      let placed = false;
      for (const child of this.children) {
        if (child.insert(entity)) {
          placed = true;
          break;
        }
      }
      if (!placed) this.entities.push(entity);
    }
  }
}
