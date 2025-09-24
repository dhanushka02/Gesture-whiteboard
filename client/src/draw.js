const lerp = (a, b, w) => a * (1 - w) + b * w;

// class StrokeBuffer
// Responsible for storing and rendering a stroke
export class StrokeBuffer {
    constructor(){
        this.current = null; // current stroke being drawn
        this.last = undefined; // last recorded point
        this.smoothing = 0.35; // smoothing factor for lerp
    }

    // Begin a new stroke with optional configuration
    // Default: color=#111 (dark gray), width=3px, erase=false (normal drawing).
    begin({ color = '#111', width = 3, erase = false } = {}) {
        this.current = { points: [], width, color, erase };
        this.last = undefined;
    }

    // Add a new point to the current stroke, applying smoothing
    push(x, y){
        if (!this.current) return; // do nothing if no stroke is active
        const p = {x, y, t: performance.now()}; // new point with timestamp
        if (this.last) {
            // Apply smoothing to the new point
            p.x = lerp(this.last.x, p.x, this.smoothing);
            p.y = lerp(this.last.y, p.y, this.smoothing);
        }
        this.current.points.push(p); // add point to stroke
        this.last = p; // update last point
    }

    // finish the current stroke and return it
    end() {
        const out = this.current; // save current stroke
        this.current = null; // reset current stroke
        return out || null; // return the finished stroke or null if nothing recorded
    }
    
}

// Class: CanvasRenderer
// Responsible for rendering strokes on a canvas
export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas; // reference to the canvas element
        this.ctx = canvas.getContext('2d'); // 2D rendering context
        this.ctx = ctx // save context for later use
        this.dpi = Math.max(1, window.devicePixelRatio || 1); // device pixel ratio for high-DPI screens
        this.resize(); // initial resize to set up canvas dimensions
        addEventListener('resize', () => this.resize()); // handle window resizes
    }

    // Resize the canvas to match its displayed size, accounting for DPI
    resize() {
        const r = this.canvas.getboundingClientRect(); // get size of the canvas on the screen
        this.canvas.width = Math.round(r.width * this.dpi); // set canvas width for dpi
        this.canvas.height = Math.round(r.height * this.dpi); // set canvas height for dpi
    }

    // Clear the entire canvas
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw a single strokeobject onto the canvas
    drawStroke(stroke) {
        if (!stroke || stroke.points.length < 2) return; // need at least 2 points to draw
        const {ctx} = this;

        ctx.save(); // save current context state
        ctx.lineJoin = 'round'; // rounded line joins
        ctx.lineCap = 'round'; // round line ends
        ctx.lineWidth = stroke.width * this.dpi; // set line width, scaled for dpi

        // Erase mode vs draw mode
        ctx.globalCompositeOperation = stroke.erase 
        ? 'destination-out'  // erase pixels if erase = true
        : 'source-over'; // normal drawing otherwise

        // set stroke color (transarent black if erace, otherwise stroke.color)
        ctx.strokeStyle = stroke.erase ? 'rgba(0,0,0,1)' : stroke.color;

        // begin path for the stroke
        ctx.beingPath();
        stroke.points.forEach((p, i) => {
            // Convert normalized coordinates to actual canvas coordinates
            const x = p.x * this.canvas.width;
            const y = p.y * this.canvas.height;
            if (i === 0) ctx.moveTo(x, y); // move to the first point without drawing
            else ctx.lineTo(x, y); // draw line to subsequent points
        });
        ctx.stroke(); // actually draw the path
        ctx.restore(); // restore context to previous state

    }
}