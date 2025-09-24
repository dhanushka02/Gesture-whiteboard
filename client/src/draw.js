// draw.js

const lerp = (a, b, w) => a * (1 - w) + b * w;

export class StrokeBuffer {
  constructor() {
    this.current = null;
    this.last = undefined;
    this.smoothing = 0.35; // exponential moving average
  }
  begin({ color = '#111', width = 3, erase = false } = {}) {
    this.current = { points: [], width, color, erase };
    this.last = undefined;
  }
  push(x, y) {
    if (!this.current) return;
    const p = { x, y, t: performance.now() };
    if (this.last) {
      p.x = lerp(this.last.x, p.x, this.smoothing);
      p.y = lerp(this.last.y, p.y, this.smoothing);
    }
    this.current.points.push(p);
    this.last = p;
  }
  end() {
    const out = this.current;
    this.current = null;
    return out || null;
  }
}

export class CanvasRenderer {
  constructor(canvas) {
    if (!canvas) {
      throw new Error('Canvas element not found (expected #board).');
    }
    // Acquire context safely and avoid shadowing the name "ctx"
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) {
      throw new Error('Failed to acquire 2D rendering context.');
    }

    this.canvas = canvas;
    this.ctx = ctx2d;
    this.dpi = Math.max(1, window.devicePixelRatio || 1);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.round(r.width * this.dpi);
    this.canvas.height = Math.round(r.height * this.dpi);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawStroke(s) {
    if (!s || s.points.length < 2) return;

    const { ctx } = this;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = s.width * this.dpi;
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.erase ? 'rgba(0,0,0,1)' : s.color;

    ctx.beginPath();
    s.points.forEach((p, i) => {
      const x = p.x * this.canvas.width;
      const y = p.y * this.canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }
}
