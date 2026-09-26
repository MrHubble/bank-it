// Physics tuning shared by the game, the tests and the shot sweeper.
// Units are metres and seconds. The world is a vertical plane: x runs from
// the kerb (left) to the garage (right) and y is up from the driveway.

/** Fixed simulation step. Everything that affects a shot advances in these ticks. */
export const TICK_RATE = 120;
export const DT = 1 / TICK_RATE;

/** Arcade gravity: snappier than 9.8 so shots take one to two seconds. */
export const GRAVITY = -18;

export const BALL_RADIUS = 0.24;

/** Launch speed at 0% and 100% power. */
export const SPEED_MIN = 4;
export const SPEED_MAX = 20;

/** Aim is stored as whole tenths so it can be shown, saved and replayed exactly. */
export const ANGLE_MIN_TENTHS = 0;
export const ANGLE_MAX_TENTHS = 1800;
export const POWER_MIN_TENTHS = 0;
export const POWER_MAX_TENTHS = 1000;

/** Give up on a shot after this long, whatever the ball is doing. */
export const MAX_SHOT_TICKS = TICK_RATE * 11;

/** A ball slower than this for SETTLE_TICKS has stopped. */
export const SETTLE_SPEED = 0.45;
export const SETTLE_TICKS = 30;

/** A ball rolling low on the driveway that can no longer reach this far below the rim is done. */
export const LOW_ROLL_MARGIN = 0.9;
export const LOW_ROLL_TICKS = 42;

/** Horizontal limits: past these the ball has left the property. */
export const WORLD_MIN_X = -1.2;
export const WORLD_MAX_X = 17.4;
export const WORLD_MIN_Y = -1;

/** The camera keeps this rectangle of the play plane on screen. */
export const VIEW_RECT = { minX: -0.3, maxX: 16.4, minY: -0.35, maxY: 8.3 };

/** Trajectory preview: short, and it stops at the first predicted contact. */
export const PREVIEW_MAX_TICKS = 54;
export const PREVIEW_MAX_LENGTH = 3.4;
