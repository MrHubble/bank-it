import * as THREE from "three";

/** Nearer objects slide this far right and down per metre of depth. */
export const OBLIQUE = { kx: 0.16, ky: 0.24 };

/**
 * A fixed, side-on orthographic camera with an oblique (cabinet) projection.
 *
 * The play plane (z = 0) is drawn with no distortion at all: horizontal is
 * horizontal, angles on screen are the real launch angles and parabolas stay
 * parabolas. Depth only shifts things: nearer objects (z > 0) slide right and
 * down, so you see the tops and shooter-facing sides of the props and the
 * driveway surface, which gives the diorama its depth.
 */
export class ObliqueCamera extends THREE.OrthographicCamera {
  /** Screen shift per metre of depth (shared with the scenery). */
  kx = OBLIQUE.kx;
  ky = OBLIQUE.ky;
  /** Distance from the camera to the play plane. */
  readonly distance = 60;

  constructor() {
    super(-1, 1, 1, -1, 1, 200);
    this.position.set(8, 4, this.distance);
  }

  override updateProjectionMatrix(): void {
    super.updateProjectionMatrix();
    const D = this.distance;
    // View space z is world z minus D, so shear by (z_view + D) = world z.
    const shear = new THREE.Matrix4().set(1, 0, this.kx, this.kx * D, 0, 1, -this.ky, -this.ky * D, 0, 0, 1, 0, 0, 0, 0, 1);
    this.projectionMatrix.multiply(shear);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }

  /**
   * Frame a rectangle of the play plane inside a viewport, leaving `insets`
   * (CSS pixels) clear for the HUD. Returns pixels per metre.
   */
  frame(
    rect: { minX: number; maxX: number; minY: number; maxY: number },
    width: number,
    height: number,
    insets: { top: number; right: number; bottom: number; left: number },
  ): number {
    const availW = Math.max(40, width - insets.left - insets.right);
    const availH = Math.max(40, height - insets.top - insets.bottom);
    const rw = rect.maxX - rect.minX;
    const rh = rect.maxY - rect.minY;
    const scale = Math.min(availW / rw, availH / rh);
    // Centre of the rect lands in the centre of the free area.
    const cxPx = insets.left + availW / 2;
    const cyPx = insets.top + availH / 2;
    const cx = (rect.minX + rect.maxX) / 2;
    const cy = (rect.minY + rect.maxY) / 2;
    const halfW = width / 2 / scale;
    const halfH = height / 2 / scale;
    // Shift the camera so (cx, cy) maps to (cxPx, cyPx).
    const camX = cx - (cxPx - width / 2) / scale;
    const camY = cy + (cyPx - height / 2) / scale;
    this.left = -halfW;
    this.right = halfW;
    this.top = halfH;
    this.bottom = -halfH;
    this.position.set(camX, camY, this.distance);
    this.updateMatrixWorld();
    this.updateProjectionMatrix();
    return scale;
  }

  /** CSS pixel position (relative to the canvas) of a play-plane point. */
  toScreen(x: number, y: number, width: number, height: number, z = 0): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  }

  /** Play-plane point under a CSS pixel position on the canvas. */
  toWorld(px: number, py: number, width: number, height: number): { x: number; y: number } {
    const ndcX = (px / width) * 2 - 1;
    const ndcY = 1 - (py / height) * 2;
    // At z = 0 the shear vanishes, so this is a plain orthographic unproject.
    return {
      x: this.position.x + ndcX * (this.right - this.left) / 2,
      y: this.position.y + ndcY * (this.top - this.bottom) / 2,
    };
  }
}
