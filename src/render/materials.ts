import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Chunky cartoon materials: three-band toon shading, soft shadows and a thin
// ink outline on the things the ball can hit. Scenery gets no outline and
// softer colours, so props always read as "you can bank off this".

export const INK = "#1d1a17";

let gradient: THREE.DataTexture | null = null;
function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
/** Materials reused across layouts; never disposed. */
const shared = new WeakSet<THREE.Material>();

/** Shared toon material for a colour. Don't mutate shared ones; use toonUnique. */
export function toon(color: THREE.ColorRepresentation): THREE.MeshToonMaterial {
  const key = new THREE.Color(color).getHexString();
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
    toonCache.set(key, m);
    shared.add(m);
  }
  return m;
}

export function toonUnique(color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

/** Flat, unlit material for scenery far away and UI-ish meshes in the scene. */
export function flat(color: THREE.ColorRepresentation, extra: THREE.MeshBasicMaterialParameters = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

const outlineMaterials = new Map<number, THREE.MeshBasicMaterial>();

function outlineMaterial(thickness: number): THREE.MeshBasicMaterial {
  let m = outlineMaterials.get(thickness);
  if (m) return m;
  m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\n transformed += normalize(normal) * ${thickness.toFixed(4)};`,
    );
  };
  m.customProgramCacheKey = () => `outline-${thickness}`;
  outlineMaterials.set(thickness, m);
  shared.add(m);
  return m;
}

const outlineGeometryCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Inverted-hull outline with smoothed normals so box corners stay closed. */
export function addOutline(mesh: THREE.Mesh, thickness = 0.028): THREE.Mesh {
  let g = outlineGeometryCache.get(mesh.geometry);
  if (!g) {
    const src = mesh.geometry.clone();
    for (const name of Object.keys(src.attributes)) if (name !== "position") src.deleteAttribute(name);
    g = mergeVertices(src, 1e-3);
    g.computeVertexNormals();
    outlineGeometryCache.set(mesh.geometry, g);
  }
  const o = new THREE.Mesh(g, outlineMaterial(thickness));
  o.name = "outline";
  o.castShadow = false;
  o.receiveShadow = false;
  o.raycast = () => {};
  mesh.add(o);
  return o;
}

export interface MeshOpts {
  outline?: number | false;
  cast?: boolean;
  receive?: boolean;
}

/** Make a toon mesh with shadows and (by default) an outline. */
export function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  opts: MeshOpts = {},
): THREE.Mesh {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  if (opts.outline !== false) addOutline(m, typeof opts.outline === "number" ? opts.outline : 0.028);
  return m;
}

/** Extrude a 2D outline (play-plane x/y) along z, centred on z = 0. */
export function extrudeOutline(points: { x: number; y: number }[], depth: number, bevel = 0.02): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
  });
  g.translate(0, 0, -depth / 2 + bevel);
  return g;
}

/** Dispose every geometry, texture and per-view material under an object.
 * Shared (cached) toon and outline materials are kept for the next layout. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      if (shared.has(m)) continue;
      (m as THREE.MeshBasicMaterial).map?.dispose();
      m.dispose();
    }
  });
}
