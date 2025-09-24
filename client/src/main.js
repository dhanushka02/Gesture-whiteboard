// client/src/main.js

// --- entry probe ---
console.log('[gesture-whiteboard] main.js loaded');

// CHANGED: use explicit .js extensions + correct file names
import { StrokeBuffer, CanvasRenderer } from './draw.js';
import { classifyGesture, interFingers } from './gesture.js';

// NEW: selfie-mode mirroring (flip x only; keeps exports unflipped)
const MIRROR = true;

// NEW: brush sizing constants (keeps cursor + stroke aligned)
const BRUSH_DRAW = 3;
const BRUSH_ERASE = 40;

// DOM hooks
const video   = document.getElementById('cam');
const canvas  = document.getElementById('board');
const overlay = document.getElementById('overlay'); // NEW: overlay for live cursor
const clearBtn = document.getElementById('clear');
const modeBtn  = document.getElementById('mode');
const fpsEl    = document.getElementById('fps');

// MediaPipe via CDN globals
// CHANGED: class direct from global (no namespace)
const HandsClass = window.Hands;
const Camera     = window.Camera;

// Drawing helpers
const renderer = new CanvasRenderer(canvas);
const buffer   = new StrokeBuffer();

// --- NEW: overlay context + helpers (DPI aware) ---
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
  octx.strokeStyle = mode === 'erase' ? 'rgba(220, 38, 38, 0.9)'  // red
                                      : 'rgba(34, 197, 94, 0.9)'; // green
  octx.fillStyle   = mode === 'erase' ? 'rgba(220, 38, 38, 0.12)'
                                      : 'rgba(34, 197, 94, 0.12)';
  octx.beginPath();
  octx.arc(cx, cy, sizePx / 2, 0, Math.PI * 2);
  octx.fill();
  octx.stroke();
  octx.restore();
}
window.addEventListener('resize', resizeOverlay);
resizeOverlay();

// State
let drawing = false;
let mode = 'draw';

// UI events
clearBtn.addEventListener('click', () => {
  renderer.clear();
  clearOverlay(); // NEW: also clear cursor ring
});
modeBtn.addEventListener('click', () => {
  mode = mode === 'draw' ? 'erase' : 'draw';
  modeBtn.textContent = `Mode: ${mode}`;
});

// FPS ticker (unchanged)
let last = performance.now();
(function tick() {
  const now = performance.now();
  const fps = 1000 / (now - last);
  last = now;
  fpsEl.textContent = `${fps.toFixed(0)} fps`;
  requestAnimationFrame(tick);
})();

// MediaPipe Hands (CHANGED: construct via class directly)
const hands = new HandsClass({
  locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

// Results handler
hands.onResults((res) => {
  // No hand → end stroke + clear cursor (NEW)
  if (!res.multiHandLandmarks || !res.multiHandLandmarks[0]) {
    if (drawing) { renderer.drawStroke(buffer.end()); drawing = false; }
    clearOverlay(); // NEW
    return;
  }

  const lm = res.multiHandLandmarks[0];

  // Landmarks → finger states → gesture
  const fingers = interFingers(lm);
  mode = classifyGesture(fingers);
  modeBtn.textContent = `Mode: ${mode}`;

  // CHANGED: mirror x for selfie UX; y unchanged
  const tip = lm[8];
  const x = MIRROR ? (1 - tip.x) : tip.x;
  const y = tip.y;

  // --- NEW: live cursor ring on overlay ---
  if (overlay) {
    // normalized → pixels on overlay
    const cx = x * overlay.width;
    const cy = y * overlay.height;
    const cursorPx = (mode === 'erase' ? BRUSH_ERASE : BRUSH_DRAW) * (window.devicePixelRatio || 1) * 4;
    drawCursor(cx, cy, cursorPx, mode);
  }

  // Drawing / erasing
  if (mode === 'draw' || mode === 'erase') {
    if (!drawing) {
      buffer.begin({
        color: '#111',
        width: mode === 'draw' ? BRUSH_DRAW : BRUSH_ERASE, // CHANGED: use constants
        erase: mode === 'erase',
      });
      drawing = true;
    }
    buffer.push(x, y);
    if (buffer.current && buffer.current.points.length > 1) {
      renderer.drawStroke(buffer.current);
    }
  } else {
    if (drawing) { renderer.drawStroke(buffer.end()); drawing = false; }
  }
});

// Boot
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
      width: 640,
      height: 480,
    });
    cam.start();
    console.log('[gesture-whiteboard] camera live');
  } catch (e) {
    console.error('Boot failed:', e);
    alert('Camera access is required: ' + e.message);
  }
}

boot();
