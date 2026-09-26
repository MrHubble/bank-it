import { DEG, dcos, dsin } from "../sim/dmath.ts";
import type { Vec2 } from "../sim/types.ts";
import type { BinDef, HoopDef, RoofDef, TrampolineDef, UmbrellaDef } from "./defs.ts";
import { hoopCentre } from "./defs.ts";

// Pure outlines for each prop. The physics turns them into colliders and the
// renderer extrudes the same outlines into models.

export interface HoopGeometry {
  centre: Vec2;
  leftTube: Vec2;
  rightTube: Vec2;
  board: { x0: number; x1: number; y0: number; y1: number };
}

export function hoopGeometry(h: HoopDef): HoopGeometry {
  const centre = hoopCentre(h);
  return {
    centre,
    leftTube: { x: centre.x - h.rimHalf, y: h.rimY },
    rightTube: { x: centre.x + h.rimHalf, y: h.rimY },
    board: { x0: h.boardX, x1: h.boardX + h.boardThickness, y0: h.boardBottom, y1: h.boardTop },
  };
}

/** Roof slab: eave-top, ridge-top, ridge-bottom, eave-bottom. The eave end is the gutter board. */
export function roofOutline(r: RoofDef): Vec2[] {
  return [
    { x: r.eave.x, y: r.eave.y },
    { x: r.ridge.x, y: r.ridge.y },
    { x: r.ridge.x, y: r.ridge.y - r.thickness },
    { x: r.eave.x, y: r.eave.y - r.thickness },
  ];
}

export function roofSlopeDeg(r: RoofDef): number {
  return (Math.atan2(r.ridge.y - r.eave.y, Math.abs(r.ridge.x - r.eave.x)) * 180) / Math.PI;
}

export interface BinGeometry {
  /** Tapered body, bottom-left first, anticlockwise. */
  body: Vec2[];
  /** Lid wedge sitting on the body, anticlockwise. */
  lid: Vec2[];
  /** Top surface of the lid from low edge to raised edge. */
  lidTop: [Vec2, Vec2];
}

export const BIN_LID_THICKNESS = 0.06;
export const BIN_LID_OVERHANG = 0.035;

export function binGeometry(b: BinDef): BinGeometry {
  const halfTop = b.width / 2;
  const halfBottom = halfTop - 0.06;
  const body: Vec2[] = [
    { x: b.x - halfBottom, y: 0 },
    { x: b.x + halfBottom, y: 0 },
    { x: b.x + halfTop, y: b.height },
    { x: b.x - halfTop, y: b.height },
  ];
  const xl = b.x - halfTop - BIN_LID_OVERHANG;
  const xr = b.x + halfTop + BIN_LID_OVERHANG;
  const rise = ((xr - xl) * dsin(b.lidTilt * DEG)) / dcos(b.lidTilt * DEG);
  const leftTop = b.height + BIN_LID_THICKNESS + (b.lidRise === "left" ? rise : 0);
  const rightTop = b.height + BIN_LID_THICKNESS + (b.lidRise === "right" ? rise : 0);
  const lid: Vec2[] = [
    { x: xl, y: b.height },
    { x: xr, y: b.height },
    { x: xr, y: rightTop },
    { x: xl, y: leftTop },
  ];
  const lidTop: [Vec2, Vec2] =
    b.lidRise === "right"
      ? [{ x: xl, y: leftTop }, { x: xr, y: rightTop }]
      : [{ x: xr, y: rightTop }, { x: xl, y: leftTop }];
  return { body, lid, lidTop };
}

export const TRAMPOLINE_MAT_THICKNESS = 0.08;
export const TRAMPOLINE_FRAME_RADIUS = 0.09;

export function trampolineGeometry(t: TrampolineDef) {
  const half = t.width / 2;
  return {
    matHalfWidth: half - TRAMPOLINE_FRAME_RADIUS,
    matTop: t.height,
    leftFrame: { x: t.x - half, y: t.height },
    rightFrame: { x: t.x + half, y: t.height },
  };
}

export const UMBRELLA_POLE_RADIUS = 0.04;

/** Canopy outline (convex dome) in world space, anticlockwise from the left tip. */
export function umbrellaCanopy(u: UmbrellaDef): Vec2[] {
  const hub = { x: u.x, y: u.poleHeight };
  const steps = 6;
  const local: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const s = -1 + (2 * i) / steps;
    // A soft dome: flatter at the peak, dropping towards the edges.
    local.push({ x: s * u.canopyRadius, y: 0.18 - (0.18 + u.canopyDrop) * s * s });
  }
  // The dome's upper edge runs left to right; walk it right to left so the
  // outline is anticlockwise once the straight underside closes it.
  local.reverse();
  const a = -u.tilt * DEG;
  const c = dcos(a);
  const s = dsin(a);
  return local.map((p) => ({ x: hub.x + p.x * c - p.y * s, y: hub.y + p.x * s + p.y * c }));
}
