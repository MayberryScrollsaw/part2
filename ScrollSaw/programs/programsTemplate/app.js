/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  ScrollSaw Designer — app.js                                    ║
 * ║  Foundation layer for a scroll saw pattern design program       ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  WHAT THIS FILE DOES                                            ║
 * ║  Everything. All program logic lives here:                      ║
 * ║  - Manages application state (zoom, pan, tool, work area size)  ║
 * ║  - Draws the grid, rulers, dimension labels on the canvas       ║
 * ║  - Handles all mouse events (pan, zoom, draw, erase)            ║
 * ║  - Listens to sidebar input changes and redraws                 ║
 * ║  - Provides stubs for PathLayer, SnapEngine, ToolManager        ║
 * ║                                                                  ║
 * ║  SECTIONS IN ORDER                                              ║
 * ║  1.  CONSTANTS          — fixed numbers used throughout         ║
 * ║  2.  STATE              — the single source of truth            ║
 * ║  3.  ELEMENT REFS       — cached DOM element handles            ║
 * ║  4.  GridRenderer       — draws everything on the canvas        ║
 * ║  5.  PathLayer          — stores and draws user-drawn paths     ║
 * ║  6.  SnapEngine         — snaps coordinates to grid             ║
 * ║  7.  ToolManager        — manages active tool state             ║
 * ║  8.  COORDINATE HELPERS — inch ↔ canvas pixel conversion        ║
 * ║  9.  CANVAS SIZING      — resizes canvas to fit wrapper         ║
 * ║  10. FIT TO WINDOW      — scales/centers work area              ║
 * ║  11. ZOOM               — zoom in/out with focal point          ║
 * ║  12. STATUS BAR         — updates the bottom status text        ║
 * ║  13. MOUSE EVENTS       — mousemove, mousedown, wheel, etc.     ║
 * ║  14. CONTROL EVENTS     — sidebar input listeners               ║
 * ║  15. RESIZE OBSERVER    — redraws when window resizes           ║
 * ║  16. INIT               — startup sequence                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

'use strict'; // Strict mode catches common JS mistakes at runtime


/* ═══════════════════════════════════════════════════════════
   1. CONSTANTS
   Fixed values that don't change at runtime.
   PX_PER_INCH: how many CSS pixels equal 1 inch at 100% zoom.
   96 is the standard screen DPI for CSS, making math straightforward.
   e.g. a 12" work area = 12 × 96 = 1152 pixels at zoom 1.0
   ═══════════════════════════════════════════════════════════ */
const PX_PER_INCH = 96;   // CSS pixels per inch at 100% zoom (standard screen DPI)
const ZOOM_MIN = 0.25; // Minimum zoom level (25%) — prevents zooming out too far
const ZOOM_MAX = 8.0;  // Maximum zoom level (800%) — prevents zooming in too far
const ZOOM_STEP = 0.25; // How much zoom changes per click or scroll tick


/* ═══════════════════════════════════════════════════════════
   2. STATE
   The single source of truth for the entire application.
   Every piece of mutable data lives here.
   When you want to change behavior, change state values and
   call GridRenderer.draw() to reflect the change visually.

   HOW TO ADD NEW STATE:
   Just add a property here, then reference it in your code.
   Example: state.showBladeEntryPoints = false;
   ═══════════════════════════════════════════════════════════ */
const state = {
    // ── Work area dimensions (in inches) ──
    // These define the size of the grid rectangle drawn on canvas.
    // Changed by the Width/Height inputs in the sidebar.
    workWidth: 12,
    workHeight: 12,

    // ── Grid settings ──
    // gridSpacing: distance between minor (thin) grid lines, in inches
    // majorEvery:  draw a bold major line every N minor lines
    // Example: spacing=0.5, majorEvery=4 → bold line every 2 inches
    gridSpacing: 0.5,
    majorEvery: 4,

    // ── Zoom & Pan ──
    // zoom: multiplier applied to all canvas drawing (1.0 = 100%)
    // pan:  offset in canvas pixels from top-left of canvas to the
    //       top-left corner (origin) of the work area
    zoom: 1.0,
    pan: { x: 60, y: 60 },

    // ── Active tool ──
    // One of: 'select', 'draw', 'erase'
    // Changed by ToolManager.activate()
    activeTool: 'select',

    // ── Panning state (internal — don't set manually) ──
    // Set to true while the user is dragging to pan the view.
    // panStart: mouse position when pan began (screen pixels)
    // panOrigin: pan value when pan began (canvas pixels)
    isPanning: false,
    panStart: { x: 0, y: 0 },
    panOrigin: { x: 0, y: 0 },

    // ── Drawing state (internal — for the draw tool) ──
    // isDrawing: true while a path is being built point by point
    // drawPoints: array of {x, y} inch coordinates placed so far
    // Double-click finishes and commits to PathLayer.
    // Right-click cancels and discards drawPoints.
    isDrawing: false,
    drawPoints: [],

    // ── Mouse position in inches ──
    // Updated every mousemove. Displayed in the sidebar cursor readout.
    // Use this anywhere you need to know where the cursor is in real units.
    mouseInch: { x: 0, y: 0 },
};


/* ═══════════════════════════════════════════════════════════
   3. ELEMENT REFS
   Cached references to DOM elements.
   Grabbing them once at startup is faster than calling
   getElementById() repeatedly inside draw loops.

   Naming convention: el + PascalCase description of the element.
   ═══════════════════════════════════════════════════════════ */
const canvas = document.getElementById('work-canvas'); // The drawing canvas
const ctx = canvas.getContext('2d');                 // 2D drawing context
const wrapper = document.getElementById('canvas-wrapper'); // Canvas container div

// Sidebar inputs
const elWidth = document.getElementById('wa-width');     // Work area width input
const elHeight = document.getElementById('wa-height');    // Work area height input
const elSpacing = document.getElementById('grid-spacing'); // Grid spacing dropdown
const elMajor = document.getElementById('major-every');  // Major line interval dropdown

// Display elements
const elZoomLbl = document.getElementById('zoom-label');  // "100%" zoom text
const elCursorX = document.getElementById('cursor-x');    // X coordinate readout
const elCursorY = document.getElementById('cursor-y');    // Y coordinate readout

// Status bar spans
const elStatusTool = document.getElementById('status-tool'); // e.g. "Tool: Draw"
const elStatusSize = document.getElementById('status-size'); // e.g. "Work Area: 12" × 12""
const elStatusGrid = document.getElementById('status-grid'); // e.g. "Grid: ½""


/* ═══════════════════════════════════════════════════════════
   4. GridRenderer
   Responsible for drawing everything on the canvas.
   Call GridRenderer.draw() whenever state changes and
   you need the canvas to reflect the new state.

   DRAW ORDER (painter's algorithm — later = on top):
   1. Clear canvas
   2. Work area shadow + fill
   3. Grid lines (minor then major)
   4. Origin marker (corner crosshair)
   5. Ruler tick marks and labels
   6. Work area border rectangle
   7. Dimension labels (width/height arrows)
   8. PathLayer (user-drawn paths) — always last, on top of grid
   ═══════════════════════════════════════════════════════════ */
const GridRenderer = {

    /**
     * Main draw entry point.
     * Call this any time state changes and the canvas needs to update.
     * It clears the canvas and redraws everything from scratch.
     */
    draw() {
        const { zoom, pan, workWidth, workHeight, gridSpacing, majorEvery } = state;

        // Work area size in canvas pixels
        // Formula: inches × pixels-per-inch × zoom-multiplier
        const waW = workWidth * PX_PER_INCH * zoom;
        const waH = workHeight * PX_PER_INCH * zoom;

        // Origin: top-left corner of work area in canvas pixels
        const ox = pan.x;
        const oy = pan.y;

        // Step 1: Clear the entire canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Step 2: Draw work area background (dark filled rect with shadow)
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#1a2028'; // dark blue-grey work surface
        ctx.fillRect(ox, oy, waW, waH);
        ctx.restore();

        // Step 3: Draw the grid lines
        this._drawGrid(ox, oy, waW, waH, gridSpacing, majorEvery, zoom);

        // Step 4: Draw the origin marker (crosshair at top-left corner)
        this._drawOrigin(ox, oy);

        // Step 5: Draw ruler ticks and inch labels along top and left edges
        this._drawRulers(ox, oy, waW, waH, gridSpacing, majorEvery, zoom);

        // Step 6: Draw the work area border rectangle
        ctx.strokeStyle = 'rgba(240,165,0,0.9)'; // gold border
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ox, oy, waW, waH);

        // Step 7: Draw width/height dimension labels
        this._drawDimLabels(ox, oy, waW, waH);

        // Step 8: Draw user paths on top of everything
        // TO ADD MORE LAYERS: call additional draw functions here
        PathLayer.draw(ctx, state);
    },


    /**
     * _drawGrid — draws minor and major grid lines inside the work area.
     *
     * @param {number} ox           Canvas X of work area top-left (pixels)
     * @param {number} oy           Canvas Y of work area top-left (pixels)
     * @param {number} waW          Work area width in canvas pixels
     * @param {number} waH          Work area height in canvas pixels
     * @param {number} spacing      Minor grid spacing in inches
     * @param {number} majorEvery   Bold line every N minor lines
     * @param {number} zoom         Current zoom level
     *
     * HOW IT WORKS:
     * 1. Calculate cellPx: how many pixels one grid cell spans at this zoom
     * 2. Loop through columns and rows
     * 3. Every majorEvery-th line is drawn thicker and brighter
     * 4. Lines are clipped to the work area rectangle (ctx.clip)
     */
    _drawGrid(ox, oy, waW, waH, spacing, majorEvery, zoom) {
        const cellPx = spacing * PX_PER_INCH * zoom; // pixels per grid cell
        const cols = Math.ceil(state.workWidth / spacing); // total column count
        const rows = Math.ceil(state.workHeight / spacing); // total row count

        ctx.save();

        // Clip drawing to the work area so grid lines don't spill outside
        ctx.beginPath();
        ctx.rect(ox, oy, waW, waH);
        ctx.clip();

        // Draw vertical lines (one per column)
        for (let c = 0; c <= cols; c++) {
            const x = ox + c * cellPx;
            const isMajor = c % majorEvery === 0; // every Nth line is a major line

            ctx.beginPath();
            ctx.moveTo(x, oy);
            ctx.lineTo(x, oy + waH);

            // Major lines: more opaque and slightly thicker
            ctx.strokeStyle = isMajor
                ? 'rgba(80,160,200,0.42)' // major — brighter blue
                : 'rgba(80,160,200,0.15)'; // minor — subtle blue
            ctx.lineWidth = isMajor ? 0.8 : 0.4;
            ctx.stroke();
        }

        // Draw horizontal lines (one per row)
        for (let r = 0; r <= rows; r++) {
            const y = oy + r * cellPx;
            const isMajor = r % majorEvery === 0;

            ctx.beginPath();
            ctx.moveTo(ox, y);
            ctx.lineTo(ox + waW, y);

            ctx.strokeStyle = isMajor
                ? 'rgba(80,160,200,0.42)'
                : 'rgba(80,160,200,0.15)';
            ctx.lineWidth = isMajor ? 0.8 : 0.4;
            ctx.stroke();
        }

        ctx.restore(); // Remove clip region
    },


    /**
     * _drawOrigin — draws a crosshair + dot at the work area origin (0,0).
     * This marks the top-left corner of the work area as the reference point.
     * In a scroll saw program this is typically where you register your material.
     *
     * TO MOVE THE ORIGIN to center: change pan offsets, not this function.
     */
    _drawOrigin(ox, oy) {
        const r = 6; // tick arm length in pixels
        ctx.save();
        ctx.strokeStyle = 'rgba(240,165,0,0.85)'; // gold crosshair
        ctx.lineWidth = 1;

        // Horizontal arm of the crosshair
        ctx.beginPath();
        ctx.moveTo(ox - r, oy);
        ctx.lineTo(ox + r, oy);
        ctx.stroke();

        // Vertical arm
        ctx.beginPath();
        ctx.moveTo(ox, oy - r);
        ctx.lineTo(ox, oy + r);
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(ox, oy, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240,165,0,0.9)';
        ctx.fill();

        ctx.restore();
    },


    /**
     * _drawRulers — draws tick marks and inch labels along the top and left
     * edges of the work area, outside the grid rectangle.
     *
     * Major ticks are taller and have text labels showing the inch value.
     * Minor ticks are short and unlabeled.
     *
     * TO ADD A BOTTOM OR RIGHT RULER:
     * Duplicate the top/left loops and adjust the y/x position to
     * oy + waH (bottom) or ox + waW (right), flipping the tick direction.
     */
    _drawRulers(ox, oy, waW, waH, spacing, majorEvery, zoom) {
        const cellPx = spacing * PX_PER_INCH * zoom;
        const cols = Math.ceil(state.workWidth / spacing);
        const rows = Math.ceil(state.workHeight / spacing);
        const tickMinor = 4;  // short tick height in pixels
        const tickMajor = 9;  // tall tick height in pixels

        // Font size scales slightly with zoom but has a minimum for readability
        const fontSize = Math.max(9, 10 * zoom);

        ctx.save();
        ctx.font = `${fontSize}px 'Share Tech Mono', monospace`;
        ctx.fillStyle = 'rgba(138,143,150,0.9)';

        // ── TOP RULER (X axis, horizontal) ──
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        for (let c = 0; c <= cols; c++) {
            const x = ox + c * cellPx;         // canvas X position
            const isMajor = c % majorEvery === 0;
            const tick = isMajor ? tickMajor : tickMinor;

            // Draw the tick mark upward from the work area top edge
            ctx.strokeStyle = isMajor
                ? 'rgba(138,143,150,0.6)'
                : 'rgba(138,143,150,0.25)';
            ctx.lineWidth = isMajor ? 1 : 0.5;

            ctx.beginPath();
            ctx.moveTo(x, oy - tick); // above the work area top edge
            ctx.lineTo(x, oy);
            ctx.stroke();

            // Label on major ticks (e.g. "0"", "2"", "4"")
            if (isMajor) {
                const inchVal = (c * spacing);
                // Format: no decimal for whole numbers, 1 decimal for fractions
                const label = (Number.isInteger(inchVal) ? inchVal : inchVal.toFixed(1)) + '"';
                ctx.fillText(label, x, oy - tickMajor - 2);
            }
        }

        // ── LEFT RULER (Y axis, vertical) ──
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let r = 0; r <= rows; r++) {
            const y = oy + r * cellPx;
            const isMajor = r % majorEvery === 0;
            const tick = isMajor ? tickMajor : tickMinor;

            ctx.strokeStyle = isMajor
                ? 'rgba(138,143,150,0.6)'
                : 'rgba(138,143,150,0.25)';
            ctx.lineWidth = isMajor ? 1 : 0.5;

            // Draw tick leftward from the work area left edge
            ctx.beginPath();
            ctx.moveTo(ox - tick, y);
            ctx.lineTo(ox, y);
            ctx.stroke();

            // Label on major ticks
            if (isMajor) {
                const inchVal = (r * spacing);
                const label = (Number.isInteger(inchVal) ? inchVal : inchVal.toFixed(1)) + '"';
                ctx.fillText(label, ox - tickMajor - 4, y);
            }
        }

        ctx.restore();
    },


    /**
     * _drawDimLabels — draws the "WIDTH: 12"" and "HEIGHT: 12"" labels
     * outside the work area border to show the total dimensions at a glance.
     *
     * Width label appears below the bottom edge, centered.
     * Height label appears to the right of the right edge, rotated 90°.
     *
     * TO CHANGE LABEL STYLE: edit the font, fillStyle, or template string below.
     */
    _drawDimLabels(ox, oy, waW, waH) {
        ctx.save();
        ctx.font = "bold 13px 'Barlow Condensed', sans-serif";
        ctx.fillStyle = 'rgba(240,165,0,0.85)'; // gold text
        ctx.textAlign = 'center';

        // Width label: centered below the work area
        const wLabel = `WIDTH: ${state.workWidth}"`;
        ctx.fillText(wLabel, ox + waW / 2, oy + waH + 22);

        // Height label: rotated 90°, centered to the right of work area
        ctx.save();
        ctx.translate(ox + waW + 22, oy + waH / 2);
        ctx.rotate(Math.PI / 2); // rotate 90 degrees clockwise
        ctx.fillText(`HEIGHT: ${state.workHeight}"`, 0, 0);
        ctx.restore();

        ctx.restore();
    },
};


/* ═══════════════════════════════════════════════════════════
   5. PathLayer
   Stores and renders user-drawn vector paths.
   This is the main data layer for scroll saw patterns.

   CURRENT STATE: Functional stub.
   - Supports basic polyline paths (click points → dbl-click to finish)
   - Paths stored as arrays of inch-coordinate points
   - Drawn on top of the grid by GridRenderer.draw()

   HOW TO EXTEND FOR SCROLL SAW PATTERNS:
   - Add path.color to support cut-line color coding (interior, exterior, etc.)
   - Add path.kerf to store blade kerf width per path
   - Add path.closed boolean for closed shapes
   - Add path.type for "entry point", "cut path", "decoration", etc.
   - Replace drawPoints with a proper Bezier curve system for smooth paths
   - Add import: parse SVG <path d="..."> into this.paths format

   DATA STRUCTURE:
   this.paths = [
     {
       points:    [{x, y}, {x, y}, ...],  // inch coordinates
       color:     '#f0a500',              // stroke color
       lineWidth: 1.5,                    // logical width (scaled by zoom)
       closed:    false,                  // close path back to start?
     },
     ...
   ]
   ═══════════════════════════════════════════════════════════ */
const PathLayer = {

    // Array of path objects. Each path is a polyline through inch-space points.
    paths: [],

    /**
     * draw — renders all stored paths on the canvas.
     * Called by GridRenderer.draw() as the final step.
     *
     * @param {CanvasRenderingContext2D} ctx   2D canvas context
     * @param {object}                  state  Global state object
     *
     * COORDINATE CONVERSION:
     * Paths are stored in inches. Before drawing, each point is converted
     * to canvas pixels using inchToCanvas(). This means paths stay in the
     * right place when you zoom or pan — the stored data never changes,
     * only the rendered position changes.
     */
    draw(ctx, state) {
        if (this.paths.length === 0) return; // nothing to draw

        ctx.save();

        for (const path of this.paths) {
            if (path.points.length < 2) continue; // need at least 2 points for a line

            ctx.beginPath();
            ctx.strokeStyle = path.color || '#f0a500';
            ctx.lineWidth = (path.lineWidth || 1.5) * state.zoom; // scale line with zoom
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Move to first point
            const p0 = inchToCanvas(path.points[0], state);
            ctx.moveTo(p0.x, p0.y);

            // Line to each subsequent point
            for (let i = 1; i < path.points.length; i++) {
                const p = inchToCanvas(path.points[i], state);
                ctx.lineTo(p.x, p.y);
            }

            // Close the path if flagged (connects last point back to first)
            if (path.closed) ctx.closePath();

            ctx.stroke();
        }

        ctx.restore();
    },

    /**
     * addPath — adds a completed path to the layer.
     * Call this when the user finishes drawing (double-click).
     *
     * @param {Array}  points  Array of {x, y} in inches
     * @param {object} opts    Optional overrides: { color, lineWidth, closed }
     *
     * USAGE EXAMPLE:
     *   PathLayer.addPath([{x:0,y:0},{x:6,y:3}], { color: '#ff0000' });
     */
    addPath(points, opts = {}) {
        this.paths.push({
            points: points,
            color: opts.color || '#f0a500',
            lineWidth: opts.lineWidth || 1.5,
            closed: opts.closed || false,
        });
    },

    /**
     * clear — removes all paths.
     * Called by the Clear button (btn-clear) in the header.
     */
    clear() {
        this.paths = [];
    },

    /**
     * STUB: removePathAt(inchX, inchY)
     * TO IMPLEMENT THE ERASE TOOL:
     * Loop through this.paths, check if (inchX, inchY) is within
     * some threshold distance of any segment, and splice it out.
     *
     * Example hit-test for a line segment from p1 to p2:
     *   dist = pointToSegmentDistance({x,y}, p1, p2)
     *   if (dist < threshold) → remove that path
     */
    removePathAt(inchX, inchY) {
        // TODO: implement hit detection for erase tool
        console.log('Erase at:', inchX, inchY, '— not yet implemented');
    },

    /**
     * STUB: exportSVG()
     * TO IMPLEMENT SVG EXPORT:
     * Build an SVG string from this.paths.
     * Each path becomes an SVG <polyline> or <path> element.
     * Scale inch coordinates to SVG user units (e.g. 1 inch = 96px).
     */
    exportSVG() {
        // TODO: build SVG string and trigger download
        console.log('SVG export not yet implemented');
    },

    /**
     * STUB: exportDXF()
     * TO IMPLEMENT DXF EXPORT (for CNC / scroll saw machines):
     * Build a DXF file string from this.paths.
     * Use LWPOLYLINE entities. 1 inch = 1 DXF unit (standard).
     */
    exportDXF() {
        // TODO: build DXF string and trigger download
        console.log('DXF export not yet implemented');
    },
};


/* ═══════════════════════════════════════════════════════════
   6. SnapEngine
   Snaps inch coordinates to the nearest grid intersection.
   Used during drawing so points land precisely on the grid.

   CURRENT STATE: Basic grid snap only.

   HOW TO EXTEND:
   - Add snap-to-path: find nearest point on existing paths
   - Add snap-to-endpoint: snap to path start/end points
   - Add snap toggle: respect state.snapEnabled
   - Add custom snap distance: only snap if within N pixels
   ═══════════════════════════════════════════════════════════ */
const SnapEngine = {

    /**
     * snap — rounds inch coordinates to the nearest grid intersection.
     *
     * @param   {number} x    Raw X in inches
     * @param   {number} y    Raw Y in inches
     * @returns {{x, y}}      Snapped X, Y in inches
     *
     * HOW IT WORKS:
     * Divides by grid spacing, rounds to nearest integer, multiplies back.
     * Example: x=1.37, spacing=0.5 → 1.37/0.5=2.74 → round=3 → 3*0.5=1.5
     */
    snap(x, y) {
        const s = state.gridSpacing;
        return {
            x: Math.round(x / s) * s,
            y: Math.round(y / s) * s,
        };
    },

    /**
     * STUB: snapToPath(x, y, threshold)
     * Snap to the nearest point on any existing path if within threshold inches.
     * Useful for connecting paths end-to-end precisely.
     */
    snapToPath(x, y, thresholdInch = 0.1) {
        // TODO: iterate PathLayer.paths, find nearest point on each segment
        return { x, y }; // returns unsnapped for now
    },
};


/* ═══════════════════════════════════════════════════════════
   7. ToolManager
   Manages which tool is active and what behavior that enables.
   When a tool button is clicked, ToolManager.activate(name) is called.

   CURRENT TOOLS:
   - 'select': pan the view (alt+drag or middle mouse). Default.
   - 'draw':   click to place path points, double-click to finish.
   - 'erase':  stub — wire to PathLayer.removePathAt() to implement.

   HOW TO ADD A NEW TOOL:
   1. Add an entry to this.tools with cursor and label.
   2. Add a <button> in index.html with a unique id.
   3. Add a click listener at the bottom of this file.
   4. Handle the tool's behavior in the mouse event section below.
   ═══════════════════════════════════════════════════════════ */
const ToolManager = {

    // Tool definitions: name → { cursor style, display label }
    tools: {
        select: {
            cursor: 'grab',      // CSS cursor when this tool is active
            label: 'Select',    // Shown in the status bar
        },
        draw: {
            cursor: 'crosshair',
            label: 'Draw Path',
        },
        erase: {
            cursor: 'cell',
            label: 'Erase',
        },
        // TO ADD A TOOL: copy one of the above and add behavior in mouse events
    },

    /**
     * activate — switches the active tool.
     * Updates: state.activeTool, cursor style, status bar, button highlight.
     *
     * @param {string} name   Tool name (must match a key in this.tools)
     */
    activate(name) {
        if (!this.tools[name]) {
            console.warn('ToolManager: unknown tool:', name);
            return;
        }

        state.activeTool = name;
        wrapper.style.cursor = this.tools[name].cursor;
        elStatusTool.textContent = 'Tool: ' + this.tools[name].label;

        // Remove 'active' class from all tool buttons, then add to the right one
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        const idMap = { select: 'btn-select', draw: 'btn-draw', erase: 'btn-erase' };
        if (idMap[name]) {
            document.getElementById(idMap[name])?.classList.add('active');
        }
    },
};


/* ═══════════════════════════════════════════════════════════
   8. COORDINATE HELPERS
   Convert between two coordinate systems:

   INCH SPACE:
   - Origin (0,0) = top-left corner of the work area
   - X increases right, Y increases down
   - Used for storing path data, cursor readout, snap calculations
   - Independent of zoom/pan — "real world" coordinates

   CANVAS PIXEL SPACE:
   - Origin (0,0) = top-left corner of the <canvas> element
   - X increases right, Y increases down
   - Used for all canvas drawing commands (ctx.moveTo, ctx.lineTo, etc.)
   - Changes with zoom and pan

   CONVERSION FORMULA:
   canvas_x = pan.x + inch_x × PX_PER_INCH × zoom
   inch_x   = (canvas_x − pan.x) / (PX_PER_INCH × zoom)
   ═══════════════════════════════════════════════════════════ */

/**
 * canvasToInch — converts canvas pixel coordinates to inch coordinates.
 * Use when you have a mouse position and want the real-world position.
 *
 * @param   {number} cx    Canvas X in pixels
 * @param   {number} cy    Canvas Y in pixels
 * @param   {object} [st]  Optional state override (defaults to global state)
 * @returns {{x, y}}       Position in inches from work area origin
 */
function canvasToInch(cx, cy, st) {
    const { zoom, pan } = st || state;
    return {
        x: (cx - pan.x) / (PX_PER_INCH * zoom),
        y: (cy - pan.y) / (PX_PER_INCH * zoom),
    };
}

/**
 * inchToCanvas — converts inch coordinates to canvas pixel coordinates.
 * Use when you have stored path data and need to draw it on screen.
 *
 * @param   {{x, y}} pt    Point in inches
 * @param   {object} [st]  Optional state override (defaults to global state)
 * @returns {{x, y}}       Position in canvas pixels
 */
function inchToCanvas(pt, st) {
    const { zoom, pan } = st || state;
    return {
        x: pan.x + pt.x * PX_PER_INCH * zoom,
        y: pan.y + pt.y * PX_PER_INCH * zoom,
    };
}

/**
 * eventToCanvas — converts a mouse event's screen coordinates to
 * canvas-relative pixel coordinates.
 * Accounts for the canvas element's position on the page.
 *
 * @param   {MouseEvent} e   The mouse event
 * @returns {{x, y}}         Canvas pixel position
 */
function eventToCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
    };
}


/* ═══════════════════════════════════════════════════════════
   9. CANVAS SIZING
   The canvas element must be sized to exactly fill its
   wrapper div. This is handled by resizeCanvas(), which is
   called on startup and whenever the window changes size
   (via ResizeObserver at the bottom of this file).

   WHY NOT SET SIZE IN CSS:
   CSS can scale a canvas visually, but that blurs the drawing.
   The canvas width/height attributes must match the pixel size
   for crisp rendering. We read the wrapper's size and apply it.
   ═══════════════════════════════════════════════════════════ */

/**
 * resizeCanvas — sizes the canvas to fill the wrapper div, then redraws.
 * Called on startup and every time the wrapper changes size.
 */
function resizeCanvas() {
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    GridRenderer.draw(); // redraw after resize
}


/* ═══════════════════════════════════════════════════════════
   10. FIT TO WINDOW
   Scales the work area to fill ~85% of the canvas wrapper,
   and centers it. Called by the "Fit to Window" button and
   on initial load (with a small delay for sizing to settle).

   HOW IT WORKS:
   1. Calculate how much zoom is needed for the work area to
      fill 85% of the wrapper width AND height.
   2. Use the smaller of the two scales (so it fits in both dimensions).
   3. Clamp to valid zoom range.
   4. Calculate pan offset to center the scaled work area.
   ═══════════════════════════════════════════════════════════ */
function fitToWindow() {
    const rect = wrapper.getBoundingClientRect();

    // Target 85% of wrapper dimensions
    const targetW = rect.width * 0.85;
    const targetH = rect.height * 0.85;

    // Calculate required zoom to fit width and height separately
    const scaleX = targetW / (state.workWidth * PX_PER_INCH);
    const scaleY = targetH / (state.workHeight * PX_PER_INCH);

    // Use the smaller scale so the work area fits in both dimensions
    state.zoom = Math.min(scaleX, scaleY, ZOOM_MAX);
    state.zoom = Math.max(state.zoom, ZOOM_MIN);

    // Center the work area in the wrapper
    const waW = state.workWidth * PX_PER_INCH * state.zoom;
    const waH = state.workHeight * PX_PER_INCH * state.zoom;
    state.pan.x = (rect.width - waW) / 2;
    state.pan.y = (rect.height - waH) / 2;

    updateZoomLabel();
    GridRenderer.draw();
}


/* ═══════════════════════════════════════════════════════════
   11. ZOOM
   Zooming scales the entire work area around a focal point.
   The focal point is where the cursor is (or the canvas center
   if no cursor position is given).

   FOCAL POINT MATH:
   When zoom changes by ratio r, the focal point fp must stay
   at the same canvas pixel. Before zoom: fp = pan + fp_inch * old_zoom.
   After: fp = new_pan + fp_inch * new_zoom.
   Solving: new_pan = fp - r * (fp - old_pan)

   Zoom can be triggered by:
   - Mouse wheel (eventToCanvas gives the focal point)
   - +/- buttons (no focal point → center of canvas)
   ═══════════════════════════════════════════════════════════ */

/**
 * applyZoom — changes zoom level by delta, keeping focusPx stationary.
 *
 * @param {number}   delta    How much to change zoom (positive = zoom in)
 * @param {{x,y}}  [focusPx] Canvas pixel to zoom toward (default: center)
 */
function applyZoom(delta, focusPx) {
    const oldZoom = state.zoom;

    // Snap zoom to multiples of ZOOM_STEP and clamp to range
    state.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN,
        Math.round((state.zoom + delta) / ZOOM_STEP) * ZOOM_STEP
    ));

    if (state.zoom === oldZoom) return; // no change, skip redraw

    // Default focal point: center of canvas
    const fp = focusPx || {
        x: canvas.width / 2,
        y: canvas.height / 2,
    };

    // Adjust pan so the focal point stays fixed
    const ratio = state.zoom / oldZoom;
    state.pan.x = fp.x - ratio * (fp.x - state.pan.x);
    state.pan.y = fp.y - ratio * (fp.y - state.pan.y);

    updateZoomLabel();
    GridRenderer.draw();
}

/**
 * updateZoomLabel — updates the "100%" text in the sidebar.
 * Called whenever state.zoom changes.
 */
function updateZoomLabel() {
    elZoomLbl.textContent = Math.round(state.zoom * 100) + '%';
}


/* ═══════════════════════════════════════════════════════════
   12. STATUS BAR
   Updates the three text spans in the footer bar.
   Call this whenever workWidth, workHeight, or gridSpacing changes.
   Tool name is updated by ToolManager.activate() separately.
   ═══════════════════════════════════════════════════════════ */

/**
 * updateStatus — refreshes size and grid labels in the footer.
 */
function updateStatus() {
    // Format grid spacing as a fraction if it's a common value
    const sp = state.gridSpacing;
    const gridLabel = sp === 0.25 ? '¼"'
        : sp === 0.5 ? '½"'
            : sp + '"';

    elStatusSize.textContent = `Work Area: ${state.workWidth}" × ${state.workHeight}"`;
    elStatusGrid.textContent = `Grid: ${gridLabel}`;
}


/* ═══════════════════════════════════════════════════════════
   13. MOUSE / POINTER EVENTS
   All canvas interaction is handled here.

   EVENT SUMMARY:
   mousemove  → update cursor coordinates; handle active pan/draw
   mousedown  → start pan (middle/alt) or place draw point (left)
   mouseup    → end pan
   dblclick   → finish a draw path
   wheel      → zoom in/out toward cursor
   contextmenu → cancel current draw path (right-click)
   ═══════════════════════════════════════════════════════════ */

// ── Mouse Move ──
// Runs on every mouse movement over the canvas.
// Handles: coordinate display, active panning, draw preview line.
canvas.addEventListener('mousemove', e => {
    // Convert mouse screen position → canvas pixels → inches
    const cp = eventToCanvas(e);
    const ip = canvasToInch(cp.x, cp.y);
    state.mouseInch = ip;

    // Update the X/Y coordinate readout in the sidebar
    elCursorX.textContent = ip.x.toFixed(3) + '"';
    elCursorY.textContent = ip.y.toFixed(3) + '"';

    // ── Handle active panning ──
    // If the user is currently dragging to pan, update pan offset.
    // Delta from panStart (screen pixels) is added to panOrigin.
    if (state.isPanning) {
        state.pan.x = state.panOrigin.x + (e.clientX - state.panStart.x);
        state.pan.y = state.panOrigin.y + (e.clientY - state.panStart.y);
        GridRenderer.draw();
        return; // don't do draw preview while panning
    }

    // ── Handle draw tool preview line ──
    // While drawing, show a dashed line from the last placed point
    // to the current cursor position (snapped to grid).
    if (state.isDrawing && state.activeTool === 'draw' && state.drawPoints.length > 0) {
        GridRenderer.draw(); // redraw grid + all committed paths first

        // Draw the live preview segment on top
        const lastPoint = state.drawPoints[state.drawPoints.length - 1];
        const snapped = SnapEngine.snap(ip.x, ip.y);
        const lastCanvas = inchToCanvas(lastPoint);
        const curCanvas = inchToCanvas(snapped);

        ctx.save();
        ctx.setLineDash([4, 4]);            // dashed line for preview
        ctx.strokeStyle = 'rgba(240,165,0,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lastCanvas.x, lastCanvas.y);
        ctx.lineTo(curCanvas.x, curCanvas.y);
        ctx.stroke();
        ctx.restore();
    }
});


// ── Mouse Down ──
// Handles: starting a pan drag, placing a draw point.
canvas.addEventListener('mousedown', e => {
    const cp = eventToCanvas(e);

    // Middle mouse button (button=1) OR Alt + left click → start panning
    // This works regardless of which tool is active.
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY };
        state.panOrigin = { x: state.pan.x, y: state.pan.y };
        wrapper.style.cursor = 'grabbing'; // change cursor while dragging
        e.preventDefault(); // prevent middle-click scroll behavior
        return;
    }

    // Left click with draw tool → place a point
    if (e.button === 0 && state.activeTool === 'draw') {
        const ip = canvasToInch(cp.x, cp.y);
        const snapped = SnapEngine.snap(ip.x, ip.y); // snap to grid
        state.isDrawing = true;
        state.drawPoints.push(snapped);              // add point to current path
        GridRenderer.draw();                          // redraw to show the new dot
    }

    // Left click with erase tool → find and remove nearest path
    // TO IMPLEMENT: call PathLayer.removePathAt(ip.x, ip.y) here
    if (e.button === 0 && state.activeTool === 'erase') {
        const ip = canvasToInch(cp.x, cp.y);
        PathLayer.removePathAt(ip.x, ip.y);
        GridRenderer.draw();
    }
});


// ── Mouse Up ──
// Ends a pan drag and restores the cursor.
canvas.addEventListener('mouseup', e => {
    if (state.isPanning) {
        state.isPanning = false;
        // Restore cursor to the active tool's cursor
        wrapper.style.cursor = ToolManager.tools[state.activeTool]?.cursor || 'crosshair';
    }
});


// ── Double Click ──
// Finishes a draw path and commits it to PathLayer.
canvas.addEventListener('dblclick', e => {
    if (state.activeTool === 'draw' && state.drawPoints.length >= 2) {
        // Commit the drawn points as a permanent path
        PathLayer.addPath([...state.drawPoints], {
            color: '#f0a500', // default gold color — change for different cut types
            lineWidth: 1.5,
        });

        // Reset draw state
        state.drawPoints = [];
        state.isDrawing = false;

        GridRenderer.draw();
    }
});


// ── Mouse Wheel ──
// Zooms in or out centered on the cursor position.
// preventDefault() stops the page from scrolling.
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const cp = eventToCanvas(e);
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP; // scroll up = zoom in
    applyZoom(delta, cp); // pass cursor position as focal point
}, { passive: false }); // passive:false required to call preventDefault


// ── Right Click / Context Menu ──
// Cancels an in-progress draw path without committing it.
canvas.addEventListener('contextmenu', e => {
    e.preventDefault(); // prevent browser context menu from appearing
    if (state.activeTool === 'draw' && state.isDrawing) {
        state.drawPoints = [];
        state.isDrawing = false;
        GridRenderer.draw();
    }
});


/* ═══════════════════════════════════════════════════════════
   14. CONTROL EVENTS (sidebar inputs + header buttons)
   Each input is wired to update a state value and redraw.

   PATTERN FOR ALL CONTROLS:
   element.addEventListener('change', () => {
     state.someValue = parse(element.value);
     updateStatus();          // if it affects status bar
     GridRenderer.draw();     // always redraw
   });
   ═══════════════════════════════════════════════════════════ */

// Work area width input → state.workWidth
elWidth.addEventListener('change', () => {
    state.workWidth = Math.max(1, parseFloat(elWidth.value) || 12);
    updateStatus();
    GridRenderer.draw();
});

// Work area height input → state.workHeight
elHeight.addEventListener('change', () => {
    state.workHeight = Math.max(1, parseFloat(elHeight.value) || 12);
    updateStatus();
    GridRenderer.draw();
});

// Grid spacing dropdown → state.gridSpacing
elSpacing.addEventListener('change', () => {
    state.gridSpacing = parseFloat(elSpacing.value);
    updateStatus();
    GridRenderer.draw();
});

// Major line interval dropdown → state.majorEvery
elMajor.addEventListener('change', () => {
    state.majorEvery = parseInt(elMajor.value, 10);
    GridRenderer.draw();
});

// Zoom buttons → applyZoom with no focal point (zooms to canvas center)
document.getElementById('zoom-in').addEventListener('click', () => applyZoom(ZOOM_STEP));
document.getElementById('zoom-out').addEventListener('click', () => applyZoom(-ZOOM_STEP));

// Fit to Window button
document.getElementById('btn-fit').addEventListener('click', fitToWindow);

// Tool buttons → ToolManager.activate()
document.getElementById('btn-select').addEventListener('click', () => ToolManager.activate('select'));
document.getElementById('btn-draw').addEventListener('click', () => ToolManager.activate('draw'));
document.getElementById('btn-erase').addEventListener('click', () => ToolManager.activate('erase'));

// Clear all paths button → confirm dialog first to prevent accidents
document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Clear all drawn paths? This cannot be undone.')) {
        PathLayer.clear();
        state.drawPoints = [];
        state.isDrawing = false;
        GridRenderer.draw();
    }
});


/* ═══════════════════════════════════════════════════════════
   15. RESIZE OBSERVER
   Watches the canvas wrapper for size changes (window resize,
   sidebar toggle, etc.) and calls resizeCanvas() to keep the
   canvas pixel dimensions in sync with the actual element size.
   This prevents blurry/distorted rendering.
   ═══════════════════════════════════════════════════════════ */
new ResizeObserver(resizeCanvas).observe(wrapper);


/* ═══════════════════════════════════════════════════════════
   16. INIT — Startup sequence
   Runs once when the page loads.
   Order matters: canvas must be sized before we can draw on it.
   fitToWindow uses a small delay so the ResizeObserver has fired
   and set the canvas size before we try to center the work area.
   ═══════════════════════════════════════════════════════════ */
(function init() {
    resizeCanvas();              // 1. Size the canvas to fill wrapper
    ToolManager.activate('select'); // 2. Set default tool (select/pan)
    updateStatus();              // 3. Populate status bar text
    updateZoomLabel();           // 4. Set initial zoom label

    // 5. Fit + center the work area after a short delay
    //    (ensures the wrapper has its final size from the browser layout pass)
    setTimeout(fitToWindow, 80);
})();