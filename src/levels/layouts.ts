import type { GarageDef, HoopDef, LayoutDef, RoofDef } from "../props/defs.ts";

// Three authored layouts in the same driveway. The garage, its roof and the
// wall-mounted hoop stay put; the props between the kid and the hoop change.
//
// x runs from the kerb (0) to the garage (about 14.3); y is up from the
// driveway. Geometry is tuned with `npm run sweep` so the routes below are
// all achievable with forgiving aim windows.

export const HOOP: HoopDef = {
  type: "hoop",
  id: "backboard",
  label: "Backboard",
  boardX: 14.2,
  boardThickness: 0.1,
  boardBottom: 2.95,
  boardTop: 4.5,
  rimY: 3.3,
  rimHalf: 0.55,
  tubeR: 0.055,
  gap: 0.22,
};

export const GARAGE: GarageDef = {
  type: "garage",
  id: "garage",
  label: "Garage",
  x0: 14.3,
  x1: 19,
  wallTop: 5.3,
};

export const GARAGE_ROOF: RoofDef = {
  type: "roof",
  id: "roof",
  label: "Roof",
  eave: { x: 13.6, y: 5.05 },
  ridge: { x: 17.6, y: 7.2 },
  thickness: 0.3,
};

export const BIN_THERE: LayoutDef = {
  id: "bin-there",
  number: "01",
  name: "Bin There",
  tagline: "Bank it off the bin, the board or the roof.",
  launch: { x: 3.0, y: 1.5 },
  defaultAim: { angleTenths: 520, powerTenths: 700 },
  props: [
    HOOP,
    GARAGE,
    GARAGE_ROOF,
    {
      type: "bin",
      id: "bin",
      label: "Bin",
      x: 9.6,
      width: 0.72,
      height: 1.02,
      lidTilt: 8,
      lidRise: "left",
      body: "#2f7d4f",
      lid: "#e04a3a",
    },
  ],
  decor: [],
};

export const AIR_MAIL: LayoutDef = {
  id: "air-mail",
  number: "02",
  name: "Air Mail",
  tagline: "Big air off the trampoline. The brolly sends it back.",
  launch: { x: 3.0, y: 1.5 },
  defaultAim: { angleTenths: 560, powerTenths: 600 },
  props: [
    HOOP,
    GARAGE,
    GARAGE_ROOF,
    {
      type: "trampoline",
      id: "trampoline",
      label: "Trampoline",
      x: 7.2,
      width: 2.0,
      height: 0.8,
    },
    {
      type: "umbrella",
      id: "umbrella",
      label: "Umbrella",
      x: 10.2,
      poleHeight: 2.3,
      canopyRadius: 1.15,
      canopyDrop: 0.5,
      tilt: 10,
      colors: ["#e4432d", "#fbf8f0"],
    },
  ],
  decor: [],
};

export const FLIGHT_RISK: LayoutDef = {
  id: "flight-risk",
  number: "03",
  name: "Flight Risk",
  tagline: "A seagull on patrol. Time it, clip it, bank it.",
  launch: { x: 3.0, y: 1.5 },
  defaultAim: { angleTenths: 520, powerTenths: 680 },
  props: [
    HOOP,
    GARAGE,
    GARAGE_ROOF,
    {
      type: "trampoline",
      id: "trampoline",
      label: "Trampoline",
      x: 6.4,
      width: 2.0,
      height: 0.8,
    },
    {
      type: "bin",
      id: "bin",
      label: "Bin",
      x: 9.8,
      width: 0.72,
      height: 1.02,
      lidTilt: 8,
      lidRise: "left",
      body: "#2f7d4f",
      lid: "#e04a3a",
    },
    {
      type: "bird",
      id: "gull",
      label: "Seagull",
      radius: 0.42,
      path: { x0: 5.4, x1: 12.2, y: 5.3, bob: 0.18, period: 600, start: 0.1 },
    },
  ],
  decor: [],
};

export const LAYOUTS: LayoutDef[] = [BIN_THERE, AIR_MAIL, FLIGHT_RISK];

export function layoutById(id: string): LayoutDef {
  const l = LAYOUTS.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown layout ${id}`);
  return l;
}
