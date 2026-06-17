export const MIN_LOOK_COUNT = 1;
export const MAX_LOOK_COUNT = 7;
export const DEFAULT_LOOK_COUNT = 1;
export const MAX_PIECES_PER_LOOK = 7;

export function clampLookCount(count: number) {
  return Math.max(MIN_LOOK_COUNT, Math.min(MAX_LOOK_COUNT, Math.floor(count || DEFAULT_LOOK_COUNT)));
}
