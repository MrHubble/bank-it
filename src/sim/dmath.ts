// Deterministic trigonometry for anything that feeds the simulation.
//
// Math.sin and Math.cos are allowed to differ in the last bit between
// JavaScript engines, and a multi-bounce trick shot amplifies tiny
// differences. These versions only use +, -, * and Math.round, which are
// exact IEEE operations everywhere, so a recorded shot replays identically in
// Node, Chrome, Safari and Firefox.

const HALF_PI_HI = 1.5707963267948966;
const HALF_PI_LO = 6.123233995736766e-17;
const TWO_OVER_PI = 0.6366197723675814;

export const PI = 3.141592653589793;
export const DEG = PI / 180;

// Taylor series on [-pi/4, pi/4]; the error is far below double precision.
function sinPoly(r: number): number {
  const r2 = r * r;
  return (
    r *
    (1 +
      r2 *
        (-1 / 6 +
          r2 *
            (1 / 120 +
              r2 *
                (-1 / 5040 +
                  r2 *
                    (1 / 362880 +
                      r2 * (-1 / 39916800 + r2 * (1 / 6227020800 + r2 * (-1 / 1307674368000))))))))
  );
}

function cosPoly(r: number): number {
  const r2 = r * r;
  return (
    1 +
    r2 *
      (-1 / 2 +
        r2 *
          (1 / 24 +
            r2 *
              (-1 / 720 +
                r2 *
                  (1 / 40320 +
                    r2 * (-1 / 3628800 + r2 * (1 / 479001600 + r2 * (-1 / 87178291200 + r2 / 20922789888000)))))))
  );
}

function reduce(x: number): { r: number; q: number } {
  const k = Math.round(x * TWO_OVER_PI);
  const r = x - k * HALF_PI_HI - k * HALF_PI_LO;
  const q = ((k % 4) + 4) % 4;
  return { r, q };
}

export function dsin(x: number): number {
  const { r, q } = reduce(x);
  switch (q) {
    case 0:
      return sinPoly(r);
    case 1:
      return cosPoly(r);
    case 2:
      return -sinPoly(r);
    default:
      return -cosPoly(r);
  }
}

export function dcos(x: number): number {
  const { r, q } = reduce(x);
  switch (q) {
    case 0:
      return cosPoly(r);
    case 1:
      return -sinPoly(r);
    case 2:
      return -cosPoly(r);
    default:
      return sinPoly(r);
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Round to a fixed number of decimals using exact decimal steps. */
export function quantize(v: number, step: number): number {
  return Math.round(v / step) * step;
}
