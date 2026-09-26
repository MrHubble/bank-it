// Small, safe wrapper over localStorage. Everything still works when storage
// is blocked (private windows, previews); it just isn't remembered.

const PREFIX = "bankit.v1.";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage unavailable: keep playing without persistence.
  }
}

export const keys = {
  muted: "muted",
  ghost: "ghost",
  aim: (layoutId: string) => `aim.${layoutId}`,
  best: (layoutId: string) => `best.${layoutId}`,
  challenge: (id: string) => `challenge.${id}`,
};

export interface BestRound {
  score: number;
  chain: string[];
  chainScore: number;
}
