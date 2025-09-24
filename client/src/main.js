// Import required libraries and modules

import { Hands } from '@mediapipe/hands'; // MediaPipe Hands for hand tracking
import { Camera } from '@mediapipe/camera_utils'; // Camera utilities for video input
import { StrokeBuffer, CanvasRenderer } from './draw'; // Custom drawing utilities
import { classifyGesture, interFingers } from './gesture'; // Gesture classification utilities

// Grab HTML elements
const video = document.getElementById('cam'); // video element for webcam feed
const canvas = document.getElementById('board'); // canvas element for drawing
const clearBtn = document.getElementById('clear'); // button to clear the canvas
const modeBtn = document.getElementById('mode'); // button to toggle modes (draw, erase, manual)
const fpsEl = document.getElementById('fps'); // element to display FPS

// Create helpers for drawing and rendering
const renderer = new CanvasRenderer(canvas);
const buffer = new StrokeBuffer();

// Track current state
let drawing = false; // whether we are currently drawing
let mode = 'draw'; // Default mode (gesture logic will override)

// Button Events
// Clear the canvas completely
clearBtn.addEventListener('click', () => renderer.clear());

// toggle mode manually
modeBtn.addEventListener('click', () => {
  mode = mode === 'draw' ? 'erase' : 'draw'; // toggle between draw and erase
  modeBtn.textContent = `Mode: ${mode}`; // update button text
});

// FPS Tracker (performance monitoring)

let last = performance.now(); // timestamp of last frame
(function tick() {
  const now = performance.now(); // current frame time
  const fps = 1000 / (now - last); // calculate FPS
  last = now; // update last frame time
  fpsEl.textContent = `${fps.toFixed(0)} fps`; // show rounded FPS on the screen
  requestAnimationFrame(tick); // loop continuously
})();

// MediaPipe Hands setup
const hands = new Hands({
  locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
  // Load model files from CDN

});

// Configure hand tracking model
hands.setOptions({
  maxNumHands: 1, // track only one hand
  modelComplexity: 1, // full model for better accuracy
  minDetectionConfidence: 0.7, // minimum confidence to detect hand
  minTrackingConfidence: 0.7, // minimum confidence to track hand
})

// When MediaPipe produces results
hands.onResults((res) => {
  // if no hand detected, stop drawing
  if (!res.multiHandLandmarks || !res.multiHandLandmarks[0]){
    // if we were in the middle of drawing -> end the stroke
    if (drawing){
      renderer.drawStroke(buffer.end());
      drawing = false;
    }
    return; // nothing more to do
  }

  // grab landmarks for the first detected hand
  const lm = res.multiHandLandmarks[0];

  // Turn landmarks -> finger states -> guesture (draw/erase/idle)
  const fingers = interFingers(lm);
  mode = classifyGesture(fingers);
  modeBtn.textContent = `Mode: ${mode}`; // show detected mode

  // Treack index finger tip position (landmark #8)
  const tip = lm[8];
  const x = tip.x; // Normalized X position (0..1)
  const y = tip.y; // Normalized Y position (0..1)

  // Drawing / Erasing logic
  if (mode === 'draw' || mode === 'erase') {
    // If starting a new stroke
    if (!drawing) {
      buffer.begin({
        color: '#111', // dark gray
        width: mode === 'draw' ? 3 : 16, erase: mode === 'erase'// thin line for drawing, thick for erasing
        
      });
      drawing = true; // now we are in drawing mode
    }

    // Add current finger tip position to the stroke
    buffer.push(x, y);

    // Render the current stroke if we have enough points
    if (buffer.current && buffer.current.points.length > 1){
      renderer.drawStroke(buffer.current);
    }
  } else {
    // Not in drawing/erasing mode -> end stroke if we were drawing
    if (drawing){
      renderer.drawStroke(buffer.end());
      drawing = false;
    }
    // TODO: implement pan/zoom logic
  } 
});

// Boot function to start the app
async function boot() {
  // Ask browser for camera stream (front-facing camera, no audio)
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user'},
    audio: false
  });

  // Play the stream in the video element
  video.srcObject = stream;
  await video.play();

  // MediaPipe Camera wrapper -> sends each frame to "hands" for processing
  const cam = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video})
    },
    width: 640, height: 480 // Input video resolution
  });

  cam.start(); // start the camera

}

// Start the app, catch errors (e.g. no camera access)
boot().catch((e) => {
  console.error(e);
  alert('Camera access is required for this app to work.');
})