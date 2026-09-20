import type { RuleCategory } from "./rules.data";

/**
 * §6.1 — four real clusters, two deliberately empty slots.
 *
 *   ELIGIBILITY & ENTRY                                   (row 1 right: empty)
 *   [01] [02] [03]
 *
 *   FORMAT & FAIR PLAY          ◆ FORGE CORE ◆            INTEGRITY & CONDUCT
 *   [04] [05] [06]                                        [07] [08] [09]
 *
 *   (row 3 left: empty)                                   JUDGING & AUTHORITY
 *                                                         [10] [11] [12]
 *
 * Rearrange here only. No animation code reads anything but this map.
 */
export type Side = "left" | "right";
export type Row = 1 | 2 | 3;

export interface ClusterSlot {
  side: Side;
  row: Row;
  category: RuleCategory | null;
}

export const CLUSTER_SLOTS: ClusterSlot[] = [
  { side: "left", row: 1, category: "Eligibility & Entry" },
  { side: "right", row: 1, category: null },
  { side: "left", row: 2, category: "Format & Fair Play" },
  { side: "right", row: 2, category: "Integrity & Conduct" },
  { side: "left", row: 3, category: null },
  { side: "right", row: 3, category: "Judging & Authority" },
];

/** §6.2 — measured from the 1280×720 reference frame, expressed as viewport shares. */
export const LAYOUT = {
  /** row centres as a share of stage height */
  rowY: { 1: 0.3, 2: 0.52, 3: 0.76 } as Record<Row, number>,
  /** cluster left edge as a share of stage width */
  clusterX: { left: 0.107, right: 0.605 } as Record<Side, number>,
  clusterW: 0.288,
  cardW: 0.09,
  /** height = 1.14 × width */
  cardAspect: 0.88,
  gap: 0.009,
  /** core height as a share of stage height, settled */
  coreH: 0.26,
} as const;

/**
 * Normalised (0..1 of stage) centre of the card at `index` (0,1,2) in a slot.
 * Used by the traces layer and by the scene to place shard landing points,
 * so both agree without measuring the DOM twice.
 */
export function cardCenter(side: Side, row: Row, index: number) {
  const w = LAYOUT.cardW;
  const h = (LAYOUT.cardW / LAYOUT.cardAspect) * (16 / 9); // w is vw, h needs vh
  const x = LAYOUT.clusterX[side] + index * (w + LAYOUT.gap) + w / 2;
  const y = LAYOUT.rowY[row];
  return { x, y, w, h };
}

export function slotFor(category: RuleCategory) {
  return CLUSTER_SLOTS.find((s) => s.category === category)!;
}
