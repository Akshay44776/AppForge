export const RB_CONFIG = {
  INTRO_SVH: 100,
  STEP_SVH: 70,
  ORRERY_SVH: 100,
  STEPS: 12,
};

// Calculate z-position of gate `i` (0..11)
// "gate i at z = -14*i (extra -10 between chambers)"
export function getGateZ(i: number) {
  let z = -14 * i;
  if (i >= 3) z -= 10;
  if (i >= 6) z -= 10;
  if (i >= 9) z -= 10;
  return z;
}

// "gentle S-curve x = 0.6*sin(i*0.7)"
export function getGateX(i: number) {
  return 0.6 * Math.sin(i * 0.7);
}

// 1.0 = total scroll distance. We have intro, 12 steps, orrery.
// Total svh = 100 + 12*70 + 100 = 1040.
// Intro is 100/1040 ≈ 0.09615
// Orrery is 100/1040 ≈ 0.09615
const TOTAL_SVH = 1040;
const INTRO = 100 / TOTAL_SVH;
const ORRERY = 100 / TOTAL_SVH;
const N = 12;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function smootherstep(edge0: number, edge1: number, x: number) {
  // Scale, and clamp x to 0..1 range
  x = clamp01((x - edge0) / (edge1 - edge0));
  // Evaluate polynomial
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function mapProgress(p: number) {
  // If p is in the orrery zone, map it 0..1
  const orreryP = clamp01((p - (1 - ORRERY)) / ORRERY);
  
  const x = clamp01((p - INTRO) / (1 - INTRO - ORRERY)) * (N - 1); // gate space 0..11
  const i = Math.min(Math.floor(x), N - 2);
  const f = x - i;                                  // 0..1 inside the step
  const gate = i + smootherstep(0.30, 0.75, f);     // plateau, then glide
  
  // Mix in orrery push back. When orreryP > 0, we pull the camera back from gate 11.
  return { gate, i, f, x, orreryP };
}
