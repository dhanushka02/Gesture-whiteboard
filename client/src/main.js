// client/src/main.js

console.log('[gesture-whiteboard] main.js loaded');

import { StrokeBuffer, CanvasRenderer } from './draw.js';
import { classifyGesture, interFingers } from './gesture.js'; // <-- fixed file/name

// --- Config ---
const MIRROR = true;       // flip X for selfie UX
const BRUSH_DRAW = 3;
const BRUSH_ERASE = 40;
const MOVE_EPS = 0.004;    // ignore micro-jitter (normalized units)

// --- DOM ---
const video    = document.getElementById('cam');
const canvas   = document.getElementById('board');
const overlay  = document.getElementById('overlay');
const clearBtn = document.getElementById('clear');
const modeBtn  = document.getElementById('mode');
const fpsEl    = document.getElementById('fps');

// --- MediaPipe globals from CDN ---
const HandsClass = window.Hands;
const Camera     = window.Camera;

// --- Drawing helpers ---
const renderer = new CanvasRenderer(canvas);
const buffer   = new StrokeBuffer();

// clear mode
let lastClearAt = 0;
const CLEAR_COOLDOWN_MS = 800; // 0.8 seconds

// --- Overlay (cursor) ---
let octx;
let oDpi = Math.max(1, window.devicePixelRatio || 1);
function resizeOverlay() {
  if (!overlay) return;
  const r = overlay.getBoundingClientRect();
  overlay.width  = Math.round(r.width  * oDpi);
  overlay.height = Math.round(r.height * oDpi);
}
function clearOverlay() {
  if (overlay && octx) octx.clearRect(0, 0, overlay.width, overlay.height);
}
function drawCursor(cx, cy, sizePx, mode) {
  if (!overlay) return;
  if (!octx) octx = overlay.getContext('2d');
  if (!octx) return;
  clearOverlay();
  octx.save();
  octx.lineWidth   = 2 * oDpi;
  octx.strokeStyle = mode === 'erase' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(34, 197, 94, 0.9)';
  octx.fillStyle   = mode === 'erase' ? 'rgba(220, 38, 38, 0.12)' : 'rgba(34, 197, 94, 0.12)';
  octx.beginPath();
  octx.arc(cx, cy, sizePx / 2, 0, Math.PI * 2);
  octx.fill();
  octx.stroke();
  octx.restore();
}
window.addEventListener('resize', resizeOverlay);
resizeOverlay();

// --- Gesture hysteresis ---
class ModeStabilizer {
  constructor(startFrames = 3, stopFrames = 3) {
    this.startFrames = startFrames;
    this.stopFrames  = stopFrames;
    this._stable     = 'panzoom';
    this._counter    = 0;
  }
  update(raw) {
    if (raw === this._stable) { this._counter = 0; return this._stable; }
    this._counter++;
    const needed = (this._stable === 'draw' && raw !== 'draw')
      ? this.stopFrames
      : (raw === 'draw' ? this.startFrames : 2);
    if (this._counter >= needed) { this._stable = raw; this._counter = 0; }
    return this._stable;
  }
}
const modeStab = new ModeStabilizer(3, 3); // <-- persist across frames

// --- State ---
let drawing = false;
let mode = 'draw';
let lastNorm = null;  // <-- DECLARED AT MODULE SCOPE

function movedEnough(nx, ny) {
  if (!lastNorm) { lastNorm = { x: nx, y: ny }; return true; }
  const dx = nx - lastNorm.x, dy = ny - lastNorm.y;
  const far = (dx*dx + dy*dy) > (MOVE_EPS * MOVE_EPS);
  if (far) lastNorm = { x: nx, y: ny };
  return far;
}

// --- UI events ---
clearBtn.addEventListener('click', () => { renderer.clear(); clearOverlay(); });
modeBtn.addEventListener('click', () => {
  mode = mode === 'draw' ? 'erase' : 'draw';
  modeBtn.textContent = `Mode: ${mode}`;
});

// --- FPS ticker ---
let last = performance.now();
(function tick() {
  const now = performance.now();
  const fps = 1000 / (now - last);
  last = now;
  fpsEl.textContent = `${fps.toFixed(0)} fps`;
  requestAnimationFrame(tick);
})();

// --- MediaPipe Hands ---
const hands = new HandsClass({
  locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults((res) => {
  // No hand → end stroke, clear cursor, reset movement history
  if (!res.multiHandLandmarks || !res.multiHandLandmarks[0]) {
    if (drawing) { renderer.drawStroke(buffer.end()); drawing = false; }
    clearOverlay();
    lastNorm = null;                // <-- SAFE: declared above
    modeBtn.textContent = `Mode: panzoom`;
    return;
  }

  const lm = res.multiHandLandmarks[0];

  // Gesture classification with hysteresis
  const fingers = interFingers(lm); // <-- correct function
  const rawMode = classifyGesture(fingers);
  mode = modeStab.update(rawMode);
  modeBtn.textContent = `Mode: ${mode}`;

  // Index tip, mirrored X for selfie mode
  const tip = lm[8];
  const x = MIRROR ? (1 - tip.x) : tip.x;
  const y = tip.y;

  // Cursor (overlay)
  if (overlay) {
    const cx = x * overlay.width;
    const cy = y * overlay.height;
    const cursorPx = (mode === 'erase' ? BRUSH_ERASE : BRUSH_DRAW) * (window.devicePixelRatio || 1) * 4;
    drawCursor(cx, cy, cursorPx, mode);
  }

  // Drawing / Erasing with movement gate
  if (mode === 'draw' || mode === 'erase') {
    if (!drawing) {
      buffer.begin({
        color: '#111',
        width: mode === 'draw' ? BRUSH_DRAW : BRUSH_ERASE,
        erase: mode === 'erase',
      });
      drawing = true;
    }
    if (movedEnough(x, y)) {
      buffer.push(x, y);
      if (buffer.current && buffer.current.points.length > 1) {
        renderer.drawStroke(buffer.current);
      }
    }
  } else if (mode === 'clear'){
      const now = performance.now();
      if (now - lastClearAt > CLEAR_COOLDOWN_MS) {
        if (drawing) { renderer.drawStroke(buffer.end()); drawing = false; }
        renderer.clear();
        clearOverlay();
        lastNorm = null; // reset movement history
        lastClearAt = now;
      }
      return;
  }
  else {
    if (drawing) { renderer.drawStroke(buffer.end()); drawing = false; }
  }
});

// --- Boot ---
async function boot() {
  try {
    console.log('[gesture-whiteboard] requesting camera…');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    const cam = new Camera(video, {
      onFrame: async () => { await hands.send({ image: video }); },
      width: 640, height: 480,
    });
    cam.start();
    console.log('[gesture-whiteboard] camera live');
  } catch (e) {
    console.error('Boot failed:', e);
    alert('Camera access is required: ' + e.message);
  }
}
boot();
