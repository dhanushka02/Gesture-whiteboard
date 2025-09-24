// Simple, explainable rules for v0
export function classifyGesture(f) {
    // Draw = index extended only
    if (f.index && !f.middle && !f.ring && !f.pinky) return 'draw';

    // Erase = open palm
    if (!f.thumb && f.index && f.middle && !f.ring && !f.pinky) return 'erase';

    // otherwise default to pan/zoom (future: more gestures)
    return 'panzoom';
}

export function interFingers(lm) {
    // Heuristic: finger extended if tip.y < pip.y (upright hand); thumb by distance
    const up = (tip, pip) => lm[tip].y < lm[pip].y;
    const dist = (a, b) => Math.hypot(lm[a].x - lm[b].x, lm[a].y - lm[b].y);

    return {
        thumb: dist(4, 3) > 0.04, // thumb extended if tip far from pip
        index: up(8, 6),
        middle: up(12, 10),
        ring: up(16, 14),
        pinky: up(20, 18),
    };
}