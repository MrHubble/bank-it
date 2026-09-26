import {
  ANGLE_MAX_TENTHS,
  ANGLE_MIN_TENTHS,
  POWER_MAX_TENTHS,
  POWER_MIN_TENTHS,
  SPEED_MAX,
  SPEED_MIN,
} from "./constants.ts";
import { DEG, clamp, dcos, dsin } from "./dmath.ts";
import type { Aim, Vec2 } from "./types.ts";

/** The one place aim becomes velocity. The real shot and the preview both use it. */
export function launchVelocity(aim: Aim): Vec2 {
  const a = (aim.angleTenths / 10) * DEG;
  const speed = launchSpeed(aim.powerTenths);
  return { x: speed * dcos(a), y: speed * dsin(a) };
}

export function launchSpeed(powerTenths: number): number {
  return SPEED_MIN + (SPEED_MAX - SPEED_MIN) * (powerTenths / 1000);
}

export function clampAim(aim: Aim): Aim {
  return {
    angleTenths: Math.round(clamp(aim.angleTenths, ANGLE_MIN_TENTHS, ANGLE_MAX_TENTHS)),
    powerTenths: Math.round(clamp(aim.powerTenths, POWER_MIN_TENTHS, POWER_MAX_TENTHS)),
  };
}

export function formatAngle(aim: Aim): string {
  return `${(aim.angleTenths / 10).toFixed(1)}°`;
}

export function formatPower(aim: Aim): string {
  return `${(aim.powerTenths / 10).toFixed(1)}%`;
}
