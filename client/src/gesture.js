// client/src/gestures.js

// ---------- vector helpers ----------
const v2   = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
const dot  = (u, v) => u.x * v.x + u.y * v.y;
const mag2 = (u)    => u.x * u.x + u.y * u.y;

// A finger is "extended" when the vectors PIP->TIP and PIP->MCP are
// nearly opposite (angle ~ 180°), i.e., cosine close to -1.
function isExtended(lm, tipIdx, pipIdx, mcpIdx, cosThresh = -0.6) {
  const u = v2(lm[pipIdx], lm[tipIdx]); // PIP -> TIP
  const w = v2(lm[pipIdx], lm[mcpIdx]); // PIP -> MCP
  const denom = Math.sqrt(mag2(u) * mag2(w)) + 1e-6;
  const c = dot(u, w) / denom;          // cosine in [-1, 1]
  return c <= cosThresh;                // e.g., ≤ -0.6 means fairly straight
}

// Thumb proxy: compare distances TIP–IP vs TIP–MCP.
// Larger TIP–IP suggests thumb is opened/extended away from palm.
// Tune factor (0.7) to your camera/lighting if needed.
function thumbExtended(lm, factor = 0.7) {
  const dTipIp  = Math.hypot(lm[4].x - lm[3].x, lm[4].y - lm[3].y);
  const dTipMcp = Math.hypot(lm[4].x - lm[2].x, lm[4].y - lm[2].y);
  return dTipIp > dTipMcp * factor;
}

export function interFingers(lm) {
  return {
    thumb:  thumbExtended(lm),
    index:  isExtended(lm, 8, 6, 5),    // 8 tip, 6 pip, 5 mcp
    middle: isExtended(lm, 12,10, 9),
    ring:   isExtended(lm, 16,14,13),
    pinky:  isExtended(lm, 20,18,17),
  };
}

// Gesture policy (keep it simple and high-signal)
export function classifyGesture(f) {
  if (f.index && !f.middle && !f.ring && !f.pinky) return 'draw';         // index-only
  if (f.index && f.middle && !f.ring && !f.pinky) return 'erase';   // index+middle
  if (f.thumb && f.index && f.middle && f.ring && f.pinky) return 'clear'; // open palm
  return 'panzoom';
}
