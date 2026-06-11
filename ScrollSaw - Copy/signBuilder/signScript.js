// ── grab elements ──────────────────────────────────────────────
const nameEl = document.getElementById('sb-name');
const fontEl = document.getElementById('sb-font');
const borderSel = document.getElementById('sb-border');
const sizeSel = document.getElementById('sb-size');
const thickSel = document.getElementById('sb-thickness');
const previewSVG = document.getElementById('preview-svg');
const bottomSel = document.getElementById('sb-bottom');
// Real-world inches → preview pixels (96 dpi equivalent)
const sizeMap = { small: 432, medium: 720, large: 1008 };  // 6", 10", 14" at 96px/inch
const labelMap = { small: '6 inches', medium: '10 inches', large: '14 inches' };

// ── scalloped border path helper ──────────────────────────────
function scallopPath(x, y, w, h, bumps) {
    const r = h * 0.09;
    const seg = w / bumps;
    let d = `M${x},${y}`;
    for (let i = 0; i < bumps; i++) {
        const x1 = x + seg * i;
        const x2 = x + seg * (i + 1);
        const mx = (x1 + x2) / 2;
        d += ` Q${mx},${y - r} ${x2},${y}`;
    }
    d += ` L${x + w},${y + h} L${x},${y + h} Z`;
    return d;
}
function scallopPathBottom(x, y, w, h, bumps) {
    const r = h * 0.09;
    const seg = w / bumps;
    let d = `M${x},${y}`;
    for (let i = 0; i < bumps; i++) {
        const x1 = x + seg * i;
        const x2 = x + seg * (i + 1);
        const mx = (x1 + x2) / 2;
        d += ` Q${mx},${y + r} ${x2},${y}`;
    }
    d += ` L${x + w},${y - h} L${x},${y - h} Z`;
    return d;
}

// ── main draw function ─────────────────────────────────────────
function draw() {
    const text = nameEl.value.trim() || 'Your Sign';
    const font = fontEl.value;
    const border = borderSel.value;
    const sizeKey = sizeSel.value;
    const thickness = thickSel.value;
    const bottom = bottomSel.value;

    // Dimensions (preview scale: 1px = 1/96 inch, but we scale down for display)
    const DISPLAY_W = 560;   // max display width in px
    const ACTUAL_W = sizeMap[sizeKey];
    const ACTUAL_H = Math.round(ACTUAL_W * 0.28);

    // We draw at ACTUAL size but scale the SVG element visually
    const scale = Math.min(1, DISPLAY_W / ACTUAL_W);

    previewSVG.setAttribute('width', Math.round(ACTUAL_W * scale));
    previewSVG.setAttribute('height', Math.round(ACTUAL_H * scale));
    previewSVG.setAttribute('viewBox', `0 0 ${ACTUAL_W} ${ACTUAL_H}`);

    const pad = 30;
    const bx = pad, by = pad * 0.7;
    const bw = ACTUAL_W - pad * 2;
    const bh = ACTUAL_H - pad * 1.4;
    const cx = ACTUAL_W / 2;
    const cy = ACTUAL_H / 2;

    // Font size: fill ~70% of sign height, but shrink for long text
    const charEst = text.length * 0.55 + 1;
    const fontSize = Math.min(Math.round(bh * 0.60), Math.round(bw / charEst));
    const visualCY = cy;

    // Build border SVG
    let borderSVG = '';
    if (border === 'rect') {
        borderSVG = `
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8"
            fill="none" stroke="#3e2a14" stroke-width="3"/>
      <rect x="${bx - 8}" y="${by - 8}" width="${bw + 16}" height="${bh + 16}" rx="14"
            fill="none" stroke="#3e2a14" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.45"/>`;
    } else if (border === 'oval') {
        borderSVG = `
      <ellipse cx="${cx}" cy="${cy}" rx="${bw / 2}" ry="${bh / 2}"
               fill="none" stroke="#3e2a14" stroke-width="3"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${bw / 2 + 6}" ry="${bh / 2 + 6}"
               fill="none" stroke="#3e2a14" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.45"/>`;
    } else if (border === 'arch') {
        const arcH = bh * 0.55;
        borderSVG = `
      <path d="M${bx},${by + arcH} Q${bx},${by} ${cx},${by} Q${bx + bw},${by} ${bx + bw},${by + arcH} L${bx + bw},${by + bh} L${bx},${by + bh} Z"
            fill="none" stroke="#3e2a14" stroke-width="3"/>
      <path d="M${bx - 9},${by + arcH} Q${bx - 9},${by - 9} ${cx},${by - 9} Q${bx + bw + 9},${by - 9} ${bx + bw + 9},${by + arcH} L${bx + bw + 9},${by + bh + 9} L${bx - 9},${by + bh + 9} Z"
            fill="none" stroke="#3e2a14" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.45"/>`;
    } else if (border === 'scallop') {
        const bumps = Math.max(4, Math.round(bw / 55));
        borderSVG = `
      <path d="${scallopPath(bx, by, bw, bh, bumps)}"
            fill="none" stroke="#3e2a14" stroke-width="3"/>`;
        if (bottom === 'match') {
            borderSVG += `
      <path d="${scallopPathBottom(bx, by + bh, bw, bh, bumps)}"
            fill="none" stroke="#3e2a14" stroke-width="3"/>`;
        }
    } else if (border === 'bubbles') {
        const bumps = Math.max(4, Math.round(bw / 55));
        borderSVG = `
      <path d="${scallopPath(bx, by, bw, bh, bumps)}"
            fill="none" stroke="#3e2a14" stroke-width="3"/>
      <path d="${scallopPathBottom(bx, by + bh, bw, bh, bumps)}"
            fill="none" stroke="#3e2a14" stroke-width="3"/>`;
    } else if (border === 'fancy') {
        const p = borderPaths.fancy;
        const scaleX = bw / p.width;
        const scaleY = bh / p.height;
        const offsetX = bx - (p.originX * scaleX);
        const offsetY = by - (p.originY * scaleY);
        borderSVG = `
      <g transform="translate(${offsetX}, ${offsetY}) scale(${scaleX}, ${scaleY})">
        <path d="${p.d}" fill="none" stroke="#3e2a14"
              stroke-width="${3 / Math.min(scaleX, scaleY)}"/>
      </g>`;
    }


    // Inject into preview SVG
    previewSVG.innerHTML = `
    <rect width="${ACTUAL_W}" height="${ACTUAL_H}" fill="white"/>
    ${borderSVG}
    <text
      x="${cx}"
       y="${visualCY + fontSize * 0.37}"
      text-anchor="middle"
      font-family="${font}, serif"
      font-size="${fontSize}"
      fill="#3e2a14"
    >${escapeXML(text)}</text>`;

    // Update info tiles
    document.getElementById('info-width').textContent = labelMap[sizeKey];
    document.getElementById('info-height').textContent = Math.round(ACTUAL_H / 96 * 10) / 10 + ' inches';
    document.getElementById('info-thick').textContent = thickness + ' inch';
}

// ── XML escape for safe SVG text injection ─────────────────────
function escapeXML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── physical dimensions lookup ────────────────────────────────
const physicalWidthIn = { small: 6, medium: 10, large: 14 };  // inches
const PX_PER_IN = 96;  // SVG/CSS standard

// ── build true-size SVG inner markup (shared by download + print) ──
function buildTrueSizeSVG(sizeKey, text, font, border, thickness, bottom) {
    const wIn = physicalWidthIn[sizeKey];
    const W = wIn * PX_PER_IN;          // e.g. 960px = 10in at 96dpi
    const H = Math.round(W * 0.28);

    const pad = 30;
    const bx = pad, by = pad * 0.7;
    const bw = W - pad * 2;
    const bh = H - pad * 1.4;
    const cx = W / 2, cy = H / 2;

    const charEst = text.length * 0.55 + 1;
    const fontSize = Math.min(Math.round(bh * 0.60), Math.round(bw / charEst));
    const visualCY = cy;

    let borderStr = '';
    if (border === 'rect') {
        borderStr = `
  <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="none" stroke="#3e2a14" stroke-width="3"/>
  <rect x="${bx - 8}" y="${by - 8}" width="${bw + 16}" height="${bh + 16}" rx="14" fill="none" stroke="#3e2a14" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>`;

    } else if (border === 'oval') {
        borderStr = `
  <ellipse cx="${cx}" cy="${cy}" rx="${bw / 2}" ry="${bh / 2}" fill="none" stroke="#3e2a14" stroke-width="3"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${bw / 2 + 6}" ry="${bh / 2 + 6}" fill="none" stroke="#3e2a14" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>`;
        // oval is already symmetrical — match top has no effect

    } else if (border === 'arch') {
        const arcH = bh * 0.55;
        borderStr = `
  <path d="M${bx},${by + arcH} Q${bx},${by} ${cx},${by} Q${bx + bw},${by} ${bx + bw},${by + arcH} L${bx + bw},${by + bh} L${bx},${by + bh} Z"
        fill="none" stroke="#3e2a14" stroke-width="3"/>`;


    } else if (border === 'scallop') {
        const bumps = Math.max(4, Math.round(bw / 55));
        borderStr = `
  <path d="${scallopPath(bx, by, bw, bh, bumps)}" fill="none" stroke="#3e2a14" stroke-width="3"/>`;
        if (bottom === 'match') {
            borderStr += `
  <path d="${scallopPathBottom(bx, by + bh, bw, bh, bumps)}" fill="none" stroke="#3e2a14" stroke-width="3"/>`;
        }
    } else if (border === 'bubbles') {
        const bumps = Math.max(4, Math.round(bw / 55));
        borderStr = `
  <path d="${scallopPath(bx, by, bw, bh, bumps)}" fill="none" stroke="#3e2a14" stroke-width="3"/>
  <path d="${scallopPathBottom(bx, by + bh, bw, bh, bumps)}" fill="none" stroke="#3e2a14" stroke-width="3"/>`;
    } else if (border === 'fancy') {
        const p = borderPaths.fancy;
        const scaleX = bw / p.width;
        const scaleY = bh / p.height;
        const offsetX = bx - (p.originX * scaleX);
        const offsetY = by - (p.originY * scaleY);
        borderStr = `
      <g transform="translate(${offsetX}, ${offsetY}) scale(${scaleX}, ${scaleY})">
        <path d="${p.d}" fill="none" stroke="#3e2a14"
              stroke-width="${3 / Math.min(scaleX, scaleY)}"/>
      </g>`;
    }

    // width/height use physical inch units so any viewer prints true-size
    return {
        wIn, hIn: Math.round(H / PX_PER_IN * 100) / 100, W, H,
        svg: `<?xml version="1.0" encoding="UTF-8"?>
<!-- Name Sign Pattern | ${wIn}" wide | Wood thickness: ${thickness}" | Font: ${font} -->
<!-- PRINT AT 100% SCALE — DO NOT "FIT TO PAGE" -->
<svg xmlns="http://www.w3.org/2000/svg"
     width="${wIn}in" height="${Math.round(H / PX_PER_IN * 1000) / 1000}in"
     viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${borderStr}
  <text x="${cx}" y="${visualCY + fontSize * 0.37}" text-anchor="middle"
        font-family="${font}, serif" font-size="${fontSize}" fill="#3e2a14">${escapeXML(text)}</text>
</svg>`
    };
}

// ── download the pattern as a real-size SVG ───────────────────
function downloadSVG() {
    const text = nameEl.value.trim() || 'sign';
    const font = fontEl.value;
    const border = borderSel.value;
    const sizeKey = sizeSel.value;
    const thickness = thickSel.value;

    const { svg } = buildTrueSizeSVG(sizeKey, text, font, border, thickness, bottomSel.value);

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = text.replace(/\s+/g, '-').toLowerCase() + '-sign-pattern.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── print the pattern — tiles across pages if wider than printable area ─
function printPreview() {
    const text = nameEl.value.trim() || 'sign';
    const font = fontEl.value;
    const border = borderSel.value;
    const sizeKey = sizeSel.value;
    const thickness = thickSel.value;

    const { wIn, hIn, W, H, svg: svgContent } = buildTrueSizeSVG(sizeKey, text, font, border, thickness, bottomSel.value);

    // ── Page geometry (letter landscape) ───────────────────────
    // Physical paper size
    const PAPER_W_IN = 11;
    const PAPER_H_IN = 8.5;
    // Printer margins (what the browser @page rule sets)
    const MARGIN_IN = 0.375;
    // Usable printable area per page
    const PRINT_W_IN = PAPER_W_IN - MARGIN_IN * 2;   // 10.25"
    const PRINT_H_IN = PAPER_H_IN - MARGIN_IN * 2;   // 7.75"
    // Label strip at top of each tile (in inches, approx 10pt)
    const LABEL_H_IN = 0.18;
    // Usable drawing area per tile (below the label)
    const TILE_W_IN = PRINT_W_IN;                   // 10.25"
    const TILE_H_IN = PRINT_H_IN - LABEL_H_IN;      // ~7.57"
    // Overlap between adjacent tiles so no pattern is lost at seams
    const OVERLAP_IN = 0.375;  // 3/8" overlap on each shared edge

    // ── How many tiles do we need? ──────────────────────────────
    // Each tile covers (TILE_W_IN - OVERLAP_IN) of new content (except the first)
    // cols: first tile covers TILE_W_IN, each subsequent covers (TILE_W_IN - OVERLAP_IN)
    const cols = wIn <= TILE_W_IN ? 1 : 1 + Math.ceil((wIn - TILE_W_IN) / (TILE_W_IN - OVERLAP_IN));
    const rows = hIn <= TILE_H_IN ? 1 : 1 + Math.ceil((hIn - TILE_H_IN) / (TILE_H_IN - OVERLAP_IN));
    const totalPages = cols * rows;

    // Total tiled canvas size in px (sign + centering offset)
    // Center the sign within the full tiled canvas width
    const tiledCanvasW = cols * TILE_W_IN * PX_PER_IN;
    const tiledCanvasH = rows * TILE_H_IN * PX_PER_IN;
    // Offset to center the sign within the tiled canvas
    const centerX = (tiledCanvasW - W) / 2;
    const centerY = (tiledCanvasH - H) / 2;

    // Extract the inner SVG content (border + text, no outer <svg> tag)
    const svgInner = svgContent
        .replace(/[\s\S]*?<svg[^>]*>/, '')   // strip everything up to and including opening <svg>
        .replace(/<\/svg>[\s\S]*/, '');       // strip closing </svg> onward

    // ── Build each tile page ────────────────────────────────────
    let bodyHTML = '';

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const pageNum = row * cols + col + 1;

            // Top-left corner of this tile in the tiled canvas (px)
            // Each tile steps by (TILE - OVERLAP) except the first
            const tileOriginX = col === 0 ? 0 : TILE_W_IN * PX_PER_IN * col - OVERLAP_IN * PX_PER_IN * col;
            const tileOriginY = row === 0 ? 0 : TILE_H_IN * PX_PER_IN * row - OVERLAP_IN * PX_PER_IN * row;

            // The viewBox for this tile: what portion of the full canvas it shows
            const vbX = tileOriginX;
            const vbY = tileOriginY;
            const vbW = TILE_W_IN * PX_PER_IN;
            const vbH = TILE_H_IN * PX_PER_IN;

            // Assembly instruction
            const assemblyNote = totalPages > 1
                ? `Page ${pageNum} of ${totalPages} &nbsp;·&nbsp; Col ${col + 1}/${cols}, Row ${row + 1}/${rows} &nbsp;·&nbsp; Overlap seams ${OVERLAP_IN}" and align cut lines`
                : `Single page &nbsp;·&nbsp; Sign: ${wIn}" × ${hIn}" &nbsp;·&nbsp; Wood: ${thickness}"`;

            // Registration mark SVG (crosshair at seam corners, only on tiled pages)
            const showRegLeft = col > 0;
            const showRegRight = col < cols - 1;
            const regMarks = totalPages > 1 ? `
        ${showRegLeft ? `<line x1="0" y1="0" x2="0" y2="${vbH}" stroke="#e8d5b0" stroke-width="1" stroke-dasharray="8 6"/>` : ''}
        ${showRegRight ? `<line x1="${vbW}" y1="0" x2="${vbW}" y2="${vbH}" stroke="#e8d5b0" stroke-width="1" stroke-dasharray="8 6"/>` : ''}
        ${showRegLeft ? `<circle cx="${OVERLAP_IN * PX_PER_IN / 2}" cy="${vbH / 2}" r="6" fill="none" stroke="#c9a96e" stroke-width="1"/>
          <line x1="${OVERLAP_IN * PX_PER_IN / 2 - 9}" y1="${vbH / 2}" x2="${OVERLAP_IN * PX_PER_IN / 2 + 9}" y2="${vbH / 2}" stroke="#c9a96e" stroke-width="1"/>
          <line x1="${OVERLAP_IN * PX_PER_IN / 2}" y1="${vbH / 2 - 9}" x2="${OVERLAP_IN * PX_PER_IN / 2}" y2="${vbH / 2 + 9}" stroke="#c9a96e" stroke-width="1"/>` : ''}
        ${showRegRight ? `<circle cx="${vbW - OVERLAP_IN * PX_PER_IN / 2}" cy="${vbH / 2}" r="6" fill="none" stroke="#c9a96e" stroke-width="1"/>
          <line x1="${vbW - OVERLAP_IN * PX_PER_IN / 2 - 9}" y1="${vbH / 2}" x2="${vbW - OVERLAP_IN * PX_PER_IN / 2 + 9}" y2="${vbH / 2}" stroke="#c9a96e" stroke-width="1"/>
          <line x1="${vbW - OVERLAP_IN * PX_PER_IN / 2}" y1="${vbH / 2 - 9}" x2="${vbW - OVERLAP_IN * PX_PER_IN / 2}" y2="${vbH / 2 + 9}" stroke="#c9a96e" stroke-width="1"/>` : ''}
      ` : '';

            bodyHTML += `
      <div class="page">
        <div class="label">${assemblyNote}</div>
        <svg xmlns="http://www.w3.org/2000/svg"
             width="${TILE_W_IN}in" height="${TILE_H_IN}in"
             viewBox="${vbX} ${vbY} ${vbW} ${vbH}">
          <!-- white background for this tile -->
          <rect x="${vbX}" y="${vbY}" width="${vbW}" height="${vbH}" fill="white"/>
          <!-- sign content, translated to center within tiled canvas -->
          <g transform="translate(${centerX}, ${centerY})">
            ${svgInner}
          </g>
          <!-- seam guides and registration marks -->
          ${regMarks}
        </svg>
      </div>`;
        }
    }

    // ── Open print window ───────────────────────────────────────
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Sign Pattern — ${wIn}" wide · ${totalPages} page${totalPages > 1 ? 's' : ''}</title>
  <style>
      @font-face { font-family: 'Stencil-Regular'; src: url('../fonts/StardosStencil-Regular.ttf') format('truetype'); font-weight: 700; }
      
      @font-face { font-family: 'Stencil-Bold'; src: url('../fonts/StardosStencil-Bold.ttf') format('truetype'); font-weight: 700; }

      @font-face { font-family: 'Thin-Regular'; src: url('../fonts/postnobillscolombo-regular.ttf') format('truetype'); font-weight: 700; }

      @font-face { font-family: 'Thin-Light'; src: url('../fonts/postnobillscolombo-light.ttf') format('truetype'); font-weight: 700; }

      @font-face { font-family: 'Thin-Bold'; src: url('../fonts/postnobillscolombo-bold.ttf') format('truetype'); font-weight: 700; }

      @font-face { font-family: 'Thin-Extra'; src: url('../fonts/postnobillscolombo-extrabold.ttf') format('truetype'); font-weight: 700; }

      @font-face { font-family: 'Huge'; src: url('../fonts/Lintsec.ttf') format('truetype'); font-weight: 700; }
      
      @font-face { font-family: 'Chunk'; src: url('../fonts/gomarice_shibuya_zero.ttf') format('truetype'); font-weight: 700; }

      @font-face { font-family: 'South'; src: url('../fonts/Beon-Regular.ttf') format('truetype'); font-weight: 700; }



  </style><style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
   
    body {
      background: #ede5d0;
      font-family: 'Playfair Display', Georgia, serif;
      padding: 0.5in 0;
    }

    .page {
      position: relative;
      width: ${PRINT_W_IN}in;
      background: white;
      margin: 0.3in auto;
      padding: 0;
      /* shadow so pages look like paper on screen */
      box-shadow: 0 2px 12px rgba(0,0,0,0.18);
    }

    .label {
      font-size: 7pt;
      color: #7a6a52;
      padding: 4px 6px 2px;
      white-space: nowrap;
      overflow: hidden;
      border-bottom: 0.5pt solid #eee;
      height: ${LABEL_H_IN}in;
      display: flex;
      align-items: center;
    }

    svg { display: block; width: 100%; height: auto; }

    @page {
      size: letter landscape;
      margin: ${MARGIN_IN}in;
    }

    @media print {
      body {
        background: white;
        padding: 0;
      }
      .page {
        width: 100%;
        margin: 0;
        box-shadow: none;
        page-break-after: always;
        break-after: page;
      }
      .page:last-child {
        page-break-after: avoid;
        break-after: avoid;
      }
      .label { color: #c9a96e; border-bottom-color: #e8d5b0; }
    }
  </style>
</head>
<body>
  ${bodyHTML}
  <script>
    document.fonts.ready.then(() => {
      setTimeout(() => window.print(), 500);
    });
  <\/script>
</body>
</html>`);
    win.document.close();
}

// ── wire up all inputs ────────────────────────────────────────
nameEl.addEventListener('input', draw);
fontEl.addEventListener('change', draw);
borderSel.addEventListener('change', draw);
sizeSel.addEventListener('change', draw);
thickSel.addEventListener('change', draw);
bottomSel.addEventListener('change', draw);



// initial render
draw();