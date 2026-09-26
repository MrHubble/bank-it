import * as THREE from "three";
import { VIEW_RECT } from "../sim/constants.ts";
import { ObliqueCamera } from "./camera.ts";
import { skyTexture } from "./scenery.ts";

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Renderer, lights and the fixed camera. The camera frames the play
 * rectangle inside whatever space the HUD leaves free and never moves while
 * you aim or shoot (the only motion is a small shake on big celebrations).
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new ObliqueCamera();
  readonly container: HTMLElement;
  width = 1;
  height = 1;
  pxPerMetre = 40;
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private readonly observer: ResizeObserver;
  private readonly sun: THREE.DirectionalLight;
  private camBase = new THREE.Vector3();
  onResize: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = "stage-canvas";
    container.appendChild(this.renderer.domElement);

    this.scene.background = skyTexture();
    const hemi = new THREE.HemisphereLight("#d7eeff", "#c9a57a", 1.35);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight("#fff4de", 2.1);
    this.sun.position.set(2, 16, 12);
    this.sun.target.position.set(8, 0, -1);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -12;
    sc.right = 12;
    sc.top = 10;
    sc.bottom = -8;
    sc.near = 1;
    sc.far = 45;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  setInsets(i: Insets): void {
    this.insets = i;
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.width = w;
    this.height = h;
    // Bound the pixel density: crisp on phones without drawing 3x the pixels.
    const dpr = Math.min(window.devicePixelRatio || 1, w * h > 1.4e6 ? 1.5 : 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    const small = Math.min(w, h) < 520;
    const mapSize = small ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== mapSize) {
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.pxPerMetre = this.camera.frame(VIEW_RECT, w, h, this.insets);
    this.camBase.copy(this.camera.position);
    this.onResize?.();
  }

  render(shake: { x: number; y: number }): void {
    this.camera.position.set(this.camBase.x + shake.x, this.camBase.y + shake.y, this.camBase.z);
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.observer.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
