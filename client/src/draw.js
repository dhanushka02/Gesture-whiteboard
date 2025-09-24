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