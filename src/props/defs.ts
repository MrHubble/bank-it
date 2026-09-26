import type { Aim, Vec2 } from "../sim/types.ts";

// Data definitions for everything that can sit in a layout. The simulation
// (src/props/*.ts) and the renderer (src/render/props/*.ts) both build from
// these, so the collision shapes and the models always agree.

export interface HoopDef {
  type: "hoop";
  id: string;
  label: string;
  /** x of the backboard's front face, which faces the shooter. */
  boardX: number;
  boardThickness: number;
  boardBottom: number;
  boardTop: number;
  rimY: number;
  /** Rim centre to each rim tube centre. */
  rimHalf: number;
  tubeR: number;
  /** Board face to the back rim tube centre. */
  gap: number;
}

export interface GarageDef {
  type: "garage";
  id: string;
  label: string;
  /** Front wall, facing the shooter. */
  x0: number;
  x1: number;
  wallTop: number;
}

export interface RoofDef {
  type: "roof";
  id: string;
  label: string;
  /** Low end of the slope, where the ball rolls off. */
  eave: Vec2;
  /** High end of the slope. */
  ridge: Vec2;
  /** Vertical thickness of the roof slab; its end face is the gutter board. */
  thickness: number;
  color?: string;
}

export interface BinDef {
  type: "bin";
  id: string;
  label: string;
  x: number;
  width: number;
  height: number;
  /** Lid angle in degrees. The lid is propped up on one side by the overflow. */
  lidTilt: number;
  lidRise: "left" | "right";
  body: string;
  lid: string;
}

export interface TrampolineDef {
  type: "trampoline";
  id: string;
  label: string;
  x: number;
  width: number;
  height: number;
}

export interface UmbrellaDef {
  type: "umbrella";
  id: string;
  label: string;
  x: number;
  poleHeight: number;
  canopyRadius: number;
  canopyDrop: number;
  /** Canopy tilt in degrees; positive tips the right-hand edge down. */
  tilt: number;
  colors: [string, string];
}

export interface BirdPath {
  /** Turnaround points of the patrol. */
  x0: number;
  x1: number;
  y: number;
  /** Height of the gentle up-and-down bob. */
  bob: number;
  /** Ticks for one full there-and-back loop. */
  period: number;
  /** Where in the loop the bird is when a new attempt starts (0 to 1). */
  start: number;
}

export interface BirdDef {
  type: "bird";
  id: string;
  label: string;
  path: BirdPath;
  radius: number;
}

export type PropDef = HoopDef | GarageDef | RoofDef | BinDef | TrampolineDef | UmbrellaDef | BirdDef;

/** Scenery that the ball cannot touch. Kept visually quieter than props. */
export interface DecorDef {
  type: string;
  x: number;
  z?: number;
  scale?: number;
  flip?: boolean;
  color?: string;
}

export interface LayoutDef {
  id: string;
  number: string;
  name: string;
  tagline: string;
  /** Where the ball sits before a shot. */
  launch: Vec2;
  defaultAim: Aim;
  props: PropDef[];
  decor: DecorDef[];
}

export function findProp<T extends PropDef["type"]>(
  layout: LayoutDef,
  type: T,
): Extract<PropDef, { type: T }> | undefined {
  return layout.props.find((p) => p.type === type) as Extract<PropDef, { type: T }> | undefined;
}

export function hoopOf(layout: LayoutDef): HoopDef {
  const hoop = findProp(layout, "hoop");
  if (!hoop) throw new Error(`Layout ${layout.id} has no hoop`);
  return hoop;
}

/** Centre of the rim opening. */
export function hoopCentre(h: HoopDef): Vec2 {
  return { x: h.boardX - h.gap - h.rimHalf, y: h.rimY };
}
