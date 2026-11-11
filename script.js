// ============================================================
// Random Letter Generator
// ============================================================

const MAX_CHARS = 30;

// Message and generated letters
let currentText = '';
let generatedLetters = [];   // one entry per character
let shuffleVersions = [];    // alternative font mixes for the Shuffle animation
let chaosParams = [];        // per-letter random motion for the Chaos animation
let pendingGenerate = false; // Generate was clicked before fonts finished loading

// Effect settings - controlled by the sliders
let effects = {
    blur: 0,
    spacing: 6,
    stretch: 100,
    size: 64,
    strokeWeight: 0,
    tilt: 0
};

let transparentBackground = false;
let invertColors = false; // white letters on black instead of black on white

// Letter colour and background colour (0 = black, 255 = white)
const inkColor = () => invertColors ? 255 : 0;
const paperColor = () => invertColors ? 0 : 255;

// Animation state. `time` is animation time in ms (real time x speed).
let animationState = {
    type: 'none',
    playing: false,
    speed: 1,
    time: 0
};

// Animation timing constants
const BOUNCE_DELAY = 90;        // ms between each letter starting, left to right
const BOUNCE_RATE = 0.006;      // hop speed
const CHAOS_LOOP = 4000;        // chaos motion repeats every 4s (so GIFs loop cleanly)
const TYPE_RATE = 8 / 1000;     // typewriter: 8 letters per second at 1x
const TYPE_HOLD = 800;          // typewriter: 0.8s pause on the full message before replaying
const SHUFFLE_STEP = 200;       // shuffle: new font mix every 200ms at 1x
const FLOAT_DELAY = 120;        // float: ms between each letter starting, left to right
const FLOAT_RATE = 0.004;       // float: one gentle bob about every 1.6s at 1x
const PULSE_DELAY = 80;         // pulse: ms between each letter starting, left to right

// ------------------------------------------------------------
// p5.js setup / draw
// ------------------------------------------------------------
function setup() {
    const container = document.getElementById('p5-container');
    const canvas = createCanvas(container.clientWidth, container.clientHeight);
    canvas.parent('p5-container');

    // Keep the canvas exactly the size of its area (window resize, panels, mobile bars)
    if (window.ResizeObserver) {
        new ResizeObserver(fitCanvasToContainer).observe(container);
    }
}

function windowResized() {
    fitCanvasToContainer();
}

function fitCanvasToContainer() {
    const container = document.getElementById('p5-container');
    if (!container || typeof resizeCanvas !== 'function') return;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    if (w !== width || h !== height) resizeCanvas(w, h);
}

function draw() {
    if (animationState.playing) {
        // deltaTime is capped so returning to a background tab doesn't jump ahead
        animationState.time += Math.min(deltaTime, 100) * animationState.speed;
    }

    const p = p5.instance;

    if (generatedLetters.length > 0) {
        drawScene(p, {
            time: animationState.time,
            animate: animationState.playing,
            type: animationState.type,
            transparent: transparentBackground
        });
    } else {
        if (transparentBackground) clear(); else background(paperColor());
        fill(150);
        noStroke();
        textAlign(CENTER, CENTER);
        textFont('Arial');
        textSize(16);
        text(window.fontsReady ? 'Enter your message and click Generate' : 'Loading fonts…', width / 2, height / 2);
    }
}

// ------------------------------------------------------------
// Generating the note
// ------------------------------------------------------------
function randomFont() {
    const fonts = window.availableFonts.length ? window.availableFonts : ['Arial'];
    return fonts[Math.floor(Math.random() * fonts.length)];
}

function makeLetters(text) {
    return Array.from(text).map(char => {
        if (char.trim() === '') return { char: ' ', isSpace: true };
        return {
            char,
            isSpace: false,
            font: randomFont(),
            sizeFactor: 0.75 + Math.random() * 0.55, // each letter's own size, relative to the Size slider
            tiltDir: Math.random() * 2 - 1           // each letter's own tilt direction/amount
        };
    });
}

function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
}

function makeChaosParams(count) {
    const params = [];
    for (let i = 0; i < count; i++) {
        params.push({
            ax: 0.12 + Math.random() * 0.28,         // horizontal range (x letter size)
            ay: 0.12 + Math.random() * 0.28,         // vertical range
            kx1: randInt(1, 4), kx2: randInt(4, 8),  // whole-number speeds so the motion loops
            ky1: randInt(1, 4), ky2: randInt(4, 8),
            px1: Math.random() * TWO_PI, px2: Math.random() * TWO_PI,
            py1: Math.random() * TWO_PI, py2: Math.random() * TWO_PI,
            rot: (4 + Math.random() * 16) * (Math.random() < 0.5 ? -1 : 1), // degrees
            kr: randInt(1, 4), pr: Math.random() * TWO_PI,
            scl: Math.random() * 0.18,
            ks: randInt(1, 5), ps: Math.random() * TWO_PI
        });
    }
    return params;
}

function generateLetters() {
    currentText = sanitizeText(document.getElementById('textInput').value);
    if (currentText.trim() === '') return;

    if (!window.fontsReady) {
        pendingGenerate = true;
        showLoading(true);
        return;
    }

    generatedLetters = makeLetters(currentText);
    shuffleVersions = [generatedLetters];
    for (let v = 0; v < 5; v++) shuffleVersions.push(makeLetters(currentText));
    chaosParams = makeChaosParams(generatedLetters.filter(l => !l.isSpace).length);

    // If an animation is selected, play it straight away from the beginning
    animationState.time = 0;
    animationState.playing = animationState.type !== 'none';
    updateAnimationButtons();
    updateExportButtons();
}

// ------------------------------------------------------------
// Drawing (shared by the live canvas and the PNG/GIF exports)
// ------------------------------------------------------------
function typewriterVisibleCount(t, total) {
    const typeDuration = total / TYPE_RATE;
    const cycle = typeDuration + TYPE_HOLD * animationState.speed;
    const tc = t % cycle;
    if (tc >= typeDuration) return total;
    return Math.min(total, Math.floor(tc * TYPE_RATE) + 1);
}

// g is any p5 drawing surface: the main sketch or an offscreen graphics buffer
function drawScene(g, opts) {
    const { time, animate, type, transparent } = opts;

    if (transparent) g.clear(); else g.background(paperColor());

    let letters = generatedLetters;
    if (animate && type === 'shuffle' && shuffleVersions.length) {
        letters = shuffleVersions[Math.floor(time / SHUFFLE_STEP) % shuffleVersions.length];
    }

    let visibleCount = letters.length;
    if (animate && type === 'typewriter') {
        visibleCount = typewriterVisibleCount(time, letters.length);
    }

    const stretchX = effects.stretch / 100;
    g.textAlign(CENTER, CENTER);

    // Measure each letter's real width so letters don't overlap
    const items = letters.map(l => {
        if (l.isSpace) {
            return { l, size: effects.size, w: effects.size * 0.4 * stretchX };
        }
        const size = effects.size * l.sizeFactor;
        g.textFont(cssFont(l.font));
        g.textSize(size);
        return { l, size, w: g.textWidth(l.char) * stretchX };
    });

    const totalWidth = items.reduce((sum, it) => sum + it.w, 0) +
        effects.spacing * Math.max(0, items.length - 1);
    const tallest = items.reduce((m, it) => Math.max(m, it.size), 0);

    // Shrink to fit if the note is wider or taller than the canvas
    const fit = Math.min(
        1,
        (g.width - 80) / Math.max(totalWidth, 1),
        (g.height * 0.7) / Math.max(tallest * 1.2, 1)
    );

    g.push();
    g.translate(g.width / 2, g.height / 2);
    g.scale(fit);

    let x = -totalWidth / 2;
    let letterIndex = 0;
    items.forEach((it, idx) => {
        if (!it.l.isSpace) {
            if (idx < visibleCount) {
                drawLetter(g, it, x + it.w / 2, letterIndex, time, animate ? type : 'none');
            }
            letterIndex++;
        }
        x += it.w + effects.spacing;
    });

    g.pop();
}

// p5 doesn't quote font names, and names with numbers (e.g. "Exo 2") break without quotes
function cssFont(name) {
    return `"${name}"`;
}

function applyAnimation(g, i, t, type) {
    const S = effects.size;
    switch (type) {
        case 'bounce': {
            // A wave that starts at the first letter and travels left to right
            const local = t - i * BOUNCE_DELAY;
            if (local > 0) g.translate(0, -Math.abs(Math.sin(local * BOUNCE_RATE)) * S * 0.35);
            break;
        }
        case 'chaos': {
            const p = chaosParams[i];
            if (!p) break;
            const w = TWO_PI / CHAOS_LOOP;
            const dx = p.ax * S * (0.7 * Math.sin(p.kx1 * w * t + p.px1) + 0.3 * Math.sin(p.kx2 * w * t + p.px2));
            const dy = p.ay * S * (0.7 * Math.sin(p.ky1 * w * t + p.py1) + 0.3 * Math.sin(p.ky2 * w * t + p.py2));
            g.translate(dx, dy);
            g.rotate(p.rot * Math.PI / 180 * Math.sin(p.kr * w * t + p.pr));
            g.scale(1 + p.scl * Math.sin(p.ks * w * t + p.ps));
            break;
        }
        case 'float': {
            // Bobbing on water: each letter rides a small circular swell and rocks
            // gently, starting at the first letter and rippling left to right
            const local = t - i * FLOAT_DELAY;
            if (local > 0) {
                const a = local * FLOAT_RATE;
                const ease = Math.min(1, local / 600);       // drift in softly from rest
                g.translate(Math.cos(a) * S * 0.05 * ease, -Math.sin(a) * S * 0.12 * ease); // circular swell
                g.rotate(Math.sin(a + 0.9) * 0.1 * ease);                                   // gentle rock (~6°)
            }
            break;
        }
        case 'pulse': {
            // Starts at the first letter and ripples left to right
            const local = t - i * PULSE_DELAY;
            if (local > 0) g.scale(1 + Math.sin(local * 0.01) * 0.2);
            break;
        }
    }
}

function drawLetter(g, it, x, letterIndex, t, type) {
    const { l, size } = it;

    g.push();
    g.translate(x, 0);
    applyAnimation(g, letterIndex, t, type);

    if (effects.tilt > 0) g.rotate(l.tiltDir * effects.tilt * Math.PI / 180);
    g.scale(effects.stretch / 100, 1); // Stretch changes width only

    g.textFont(cssFont(l.font));
    g.textSize(size);

    const outlined = effects.strokeWeight > 0;

    if (effects.blur > 0) {
        drawBlurredText(g, l.char, outlined);
    } else {
        if (outlined) {
            g.fill(paperColor());
            g.stroke(inkColor());
            g.strokeWeight(effects.strokeWeight);
        } else {
            g.fill(inkColor());
            g.noStroke();
        }
        g.text(l.char, 0, 0);
    }

    g.pop();
}

// Blur that works in every browser, including Safari.
// The letter is drawn far off-canvas and only its blurred shadow is moved back into place.
function drawBlurredText(g, ch, outlined) {
    const ctx = g.drawingContext;
    const m = ctx.getTransform();
    const scaleLen = Math.hypot(m.a, m.b) || 1;
    const away = (ctx.canvas.width + ctx.canvas.height + 1000) / scaleLen;

    ctx.shadowOffsetX = -m.a * away;
    ctx.shadowOffsetY = -m.b * away;
    ctx.shadowBlur = effects.blur * 2 * g.pixelDensity();

    const ink = inkColor(), paper = paperColor();
    const hex = v => v ? '#ffffff' : '#000000';

    if (outlined) {
        ctx.shadowColor = hex(paper);
        g.noStroke();
        g.fill(paper);
        g.text(ch, away, 0);

        ctx.shadowColor = hex(ink);
        g.noFill();
        g.stroke(ink);
        g.strokeWeight(effects.strokeWeight);
        g.text(ch, away, 0);
    } else {
        ctx.shadowColor = hex(ink);
        g.noStroke();
        g.fill(ink);
        g.text(ch, away, 0);
    }
    // push()/pop() around each letter restores the shadow settings
}

// ------------------------------------------------------------
// Animation controls (Play / Stop)
// ------------------------------------------------------------
function playAnimation() {
    if (generatedLetters.length === 0 || animationState.type === 'none') return;
    animationState.time = 0;
    animationState.playing = true;
    updateAnimationButtons();
}

function stopAnimation() {
    animationState.playing = false;
    animationState.time = 0;
    updateAnimationButtons();
}

function changeAnimationType(newType) {
    animationState.type = newType;
    animationState.time = 0;
    // Picking an animation starts it right away (once there's a note to animate)
    animationState.playing = newType !== 'none' && generatedLetters.length > 0;
    updateAnimationButtons();
}

function updateAnimationButtons() {
    const playBtn = document.getElementById('playBtn');
    const stopBtn = document.getElementById('stopBtn');
    if (!playBtn || !stopBtn) return;

    const canPlay = generatedLetters.length > 0 && animationState.type !== 'none';
    playBtn.classList.toggle('active', animationState.playing);
    playBtn.disabled = !canPlay || animationState.playing;
    stopBtn.disabled = !animationState.playing;
}

// ------------------------------------------------------------
// Export: PNG and GIF
// ------------------------------------------------------------
function updateExportButtons() {
    const hasNote = generatedLetters.length > 0;
    document.getElementById('exportPngBtn').disabled = !hasNote;
    document.getElementById('exportGifBtn').disabled = !hasNote;
}

function setExportStatus(msg) {
    document.getElementById('exportStatus').textContent = msg;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function fileName(ext) {
    const slug = currentText.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    return `random-letters${slug ? '-' + slug : ''}.${ext}`;
}

// Find the area that actually has letters in it, so exports are cropped neatly
function contentBounds(imageData, bounds) {
    const { data, width: w, height: h } = imageData;
    let { minX, minY, maxX, maxY } = bounds;
    for (let y = 0; y < h; y++) {
        const row = y * w * 4;
        for (let x = 0; x < w; x++) {
            if (data[row + x * 4 + 3] > 8) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    return { minX, minY, maxX, maxY };
}

function emptyBounds() {
    return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function padBounds(b, pad, w, h) {
    if (!isFinite(b.minX)) return { x: 0, y: 0, w, h };
    const x = Math.max(0, b.minX - pad);
    const y = Math.max(0, b.minY - pad);
    return {
        x, y,
        w: Math.min(w, b.maxX + pad + 1) - x,
        h: Math.min(h, b.maxY + pad + 1) - y
    };
}

function exportPNG() {
    if (!generatedLetters.length) return;
    const density = 3; // high resolution
    const g = createGraphics(width, height);
    g.pixelDensity(density);

    // Draw on a transparent buffer first to find where the letters are
    drawScene(g, {
        time: animationState.time,
        animate: animationState.playing,
        type: animationState.type,
        transparent: true
    });
    const src = g.elt;
    const ctx = src.getContext('2d');
    const bounds = contentBounds(ctx.getImageData(0, 0, src.width, src.height), emptyBounds());
    const crop = padBounds(bounds, 40 * density, src.width, src.height);

    const out = document.createElement('canvas');
    out.width = crop.w;
    out.height = crop.h;
    const octx = out.getContext('2d');
    if (!transparentBackground) {
        octx.fillStyle = invertColors ? '#000000' : '#ffffff';
        octx.fillRect(0, 0, out.width, out.height);
    }
    octx.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    g.remove();

    out.toBlob(blob => {
        downloadBlob(blob, fileName('png'));
        setExportStatus(`PNG saved (${out.width} × ${out.height}px)`);
    }, 'image/png');
}

// Work out how many frames to record so the GIF loops smoothly
function gifTimeline(type) {
    const speed = animationState.speed;
    const frameMs = 50; // 20 frames per second
    const letterCount = generatedLetters.filter(l => !l.isSpace).length;
    let start = 0;
    let span; // animation time covered by the GIF

    switch (type) {
        case 'bounce':
            start = (letterCount - 1) * BOUNCE_DELAY + 1;  // every letter already hopping
            span = 2 * Math.PI / BOUNCE_RATE;               // two hops
            break;
        case 'chaos':
            span = CHAOS_LOOP;
            break;
        case 'float':
            start = (letterCount - 1) * FLOAT_DELAY + 600;  // every letter already bobbing
            span = 2 * Math.PI / FLOAT_RATE;
            break;
        case 'pulse':
            start = (letterCount - 1) * PULSE_DELAY + 1;
            span = 2 * (2 * Math.PI / 0.01);
            break;
        case 'typewriter':
            span = generatedLetters.length / TYPE_RATE + TYPE_HOLD * speed;
            break;
        case 'shuffle':
            span = SHUFFLE_STEP * shuffleVersions.length;
            break;
        default:
            return { start: 0, step: 0, frames: 1, delayCs: 100 };
    }

    let frames = Math.round(span / speed / frameMs);
    frames = Math.max(2, Math.min(frames, 200));
    const step = span / frames;
    const delayCs = Math.max(2, Math.round((span / speed / frames) / 10));
    return { start, step, frames, delayCs };
}

const nextTick = () => new Promise(r => setTimeout(r, 0));

async function exportGIF() {
    if (!generatedLetters.length) return;
    const btn = document.getElementById('exportGifBtn');
    btn.disabled = true;

    try {
        const type = animationState.type;
        const timeline = gifTimeline(type);
        const g = createGraphics(width, height);
        g.pixelDensity(1);
        const src = g.elt;
        const ctx = src.getContext('2d', { willReadFrequently: true });
        const render = f => drawScene(g, {
            time: timeline.start + f * timeline.step,
            animate: type !== 'none',
            type,
            transparent: true
        });

        // Pass 1: find the area the letters move through
        let bounds = emptyBounds();
        for (let f = 0; f < timeline.frames; f++) {
            render(f);
            bounds = contentBounds(ctx.getImageData(0, 0, src.width, src.height), bounds);
            if (f % 5 === 0) {
                setExportStatus(`Preparing GIF… ${Math.round(f / timeline.frames * 50)}%`);
                await nextTick();
            }
        }
        const crop = padBounds(bounds, 30, src.width, src.height);

        // Pass 2: capture each frame
        const frames = [];
        for (let f = 0; f < timeline.frames; f++) {
            render(f);
            const img = ctx.getImageData(crop.x, crop.y, crop.w, crop.h);
            frames.push(toGrayIndices(img.data, transparentBackground));
            if (f % 5 === 0) {
                setExportStatus(`Creating GIF… ${50 + Math.round(f / timeline.frames * 50)}%`);
                await nextTick();
            }
        }
        g.remove();

        const bytes = encodeGIF(frames, crop.w, crop.h, timeline.delayCs, transparentBackground);
        downloadBlob(new Blob([bytes], { type: 'image/gif' }), fileName('gif'));
        setExportStatus(type === 'none'
            ? 'GIF saved (still image — pick an animation to make it move)'
            : `GIF saved (${timeline.frames} frames)`);
    } catch (err) {
        console.error(err);
        setExportStatus('GIF could not be created. Try a shorter message or a smaller Size.');
    } finally {
        btn.disabled = generatedLetters.length === 0;
    }
}

// ------------------------------------------------------------
// Controls setup
// ------------------------------------------------------------
function setupCollapsible() {
    document.querySelectorAll('.section-header').forEach(header => {
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', 'false');

        const toggle = () => {
            const content = header.nextElementSibling;
            const chevron = header.querySelector('.chevron');
            const open = content.classList.toggle('expanded');
            header.classList.toggle('expanded', open);
            header.setAttribute('aria-expanded', String(open));
            chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
        };

        header.addEventListener('click', toggle);
        header.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });
    });
}

function setupSliders() {
    const sliders = [
        { id: 'blur', property: 'blur', suffix: 'px' },
        { id: 'spacing', property: 'spacing', suffix: 'px' },
        { id: 'stretch', property: 'stretch', suffix: '%' },
        { id: 'size', property: 'size', suffix: 'px' },
        { id: 'strokeWeight', property: 'strokeWeight', suffix: 'px' },
        { id: 'tilt', property: 'tilt', suffix: '°' }
    ];

    sliders.forEach(({ id, property, suffix }) => {
        const slider = document.getElementById(id);
        if (!slider) return;
        const valueSpan = slider.parentElement.querySelector('.range-value');

        effects[property] = parseFloat(slider.value);
        if (valueSpan) valueSpan.textContent = slider.value + suffix;

        slider.addEventListener('input', function () {
            effects[property] = parseFloat(this.value);
            if (valueSpan) valueSpan.textContent = this.value + suffix;
        });
    });

    const speedSlider = document.getElementById('animationSpeed');
    if (speedSlider) {
        const speedValue = speedSlider.parentElement.querySelector('.range-value');
        speedSlider.addEventListener('input', function () {
            animationState.speed = parseFloat(this.value);
            if (speedValue) speedValue.textContent = this.value + 'x';
        });
    }
}

// Single line only: turn line breaks into spaces and enforce the limit
function sanitizeText(value) {
    return Array.from(value.replace(/[\r\n]+/g, ' ')).slice(0, MAX_CHARS).join('');
}

function updateCharCounter(textInput) {
    const count = Array.from(textInput.value).length;
    const counter = document.getElementById('charCounter');
    document.getElementById('charCount').textContent = count;
    counter.classList.toggle('near', count >= MAX_CHARS - 5 && count < MAX_CHARS);
    counter.classList.toggle('full', count >= MAX_CHARS);
}

function showLoading(show) {
    const el = document.getElementById('loadingIndicator');
    if (el) el.style.display = show ? 'flex' : 'none';
}

document.addEventListener('fontsready', () => {
    showLoading(false);
    if (pendingGenerate) {
        pendingGenerate = false;
        generateLetters();
    }
});

document.addEventListener('DOMContentLoaded', function () {
    const textInput = document.getElementById('textInput');
    const generateBtn = document.getElementById('generateBtn');
    if (!textInput || !generateBtn) {
        console.error('Required page elements not found');
        return;
    }

    setupCollapsible();
    setupSliders();

    textInput.addEventListener('input', () => {
        const clean = sanitizeText(textInput.value);
        if (clean !== textInput.value) textInput.value = clean;
        updateCharCounter(textInput);
    });
    updateCharCounter(textInput);

    generateBtn.addEventListener('click', generateLetters);
    textInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            generateLetters();
        }
    });

    document.getElementById('playBtn').addEventListener('click', playAnimation);
    document.getElementById('stopBtn').addEventListener('click', stopAnimation);
    document.getElementById('animationType').addEventListener('change', function () {
        changeAnimationType(this.value);
    });

    document.getElementById('invertColors').addEventListener('change', function () {
        invertColors = this.checked;
        document.querySelector('.canvas-container').classList.toggle('inverted', this.checked);
        document.body.classList.toggle('menu-light', this.checked); // menu flips too
    });

    const transparentBox = document.getElementById('transparentBg');
    transparentBox.addEventListener('change', function () {
        transparentBackground = this.checked;
        document.querySelector('.canvas-container').classList.toggle('transparent-preview', this.checked);
    });

    document.getElementById('exportPngBtn').addEventListener('click', exportPNG);
    document.getElementById('exportGifBtn').addEventListener('click', exportGIF);

    updateAnimationButtons();
    updateExportButtons();
});

// ------------------------------------------------------------
// Minimal GIF encoder (grayscale palette — the notes are black and white)
// ------------------------------------------------------------
const GIF_TRANSPARENT_INDEX = 255;

// Convert RGBA pixels to palette indices
function toGrayIndices(rgba, transparent) {
    const n = rgba.length / 4;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        const r = rgba[i * 4], gr = rgba[i * 4 + 1], b = rgba[i * 4 + 2], a = rgba[i * 4 + 3];
        const lum = 0.299 * r + 0.587 * gr + 0.114 * b;
        if (transparent) {
            // GIF transparency is on/off only, so soft edges are cut at half opacity
            out[i] = a < 128 ? GIF_TRANSPARENT_INDEX : Math.round(lum * 254 / 255);
        } else {
            // Composite onto the background colour (white, or black when inverted)
            const v = lum * (a / 255) + paperColor() * (1 - a / 255);
            out[i] = Math.round(v);
        }
    }
    return out;
}

function gifPalette(transparent) {
    const pal = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
        const v = transparent ? Math.min(255, Math.round(i * 255 / 254)) : i;
        pal[i * 3] = pal[i * 3 + 1] = pal[i * 3 + 2] = v;
    }
    return pal;
}

function lzwEncode(indices, minCodeSize, out) {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;
    let dict = new Map();

    const bytes = [];
    let bitBuf = 0, bitCount = 0;
    const emit = code => {
        bitBuf |= code << bitCount;
        bitCount += codeSize;
        while (bitCount >= 8) {
            bytes.push(bitBuf & 0xff);
            bitBuf >>>= 8;
            bitCount -= 8;
        }
    };

    emit(clearCode);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
        const k = indices[i];
        const key = prefix * 256 + k;
        const found = dict.get(key);
        if (found !== undefined) {
            prefix = found;
            continue;
        }
        emit(prefix);
        if (nextCode < 4096) {
            dict.set(key, nextCode++);
            if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
        } else {
            emit(clearCode);
            dict = new Map();
            codeSize = minCodeSize + 1;
            nextCode = eoiCode + 1;
        }
        prefix = k;
    }
    emit(prefix);
    emit(eoiCode);
    if (bitCount > 0) bytes.push(bitBuf & 0xff);

    // Split into sub-blocks of up to 255 bytes
    out.push(minCodeSize);
    for (let i = 0; i < bytes.length; i += 255) {
        const chunk = bytes.slice(i, i + 255);
        out.push(chunk.length, ...chunk);
    }
    out.push(0);
}

function encodeGIF(frames, w, h, delayCs, transparent) {
    const out = [];
    const u16 = v => out.push(v & 0xff, (v >> 8) & 0xff);
    const str = s => { for (const c of s) out.push(c.charCodeAt(0)); };

    str('GIF89a');
    u16(w); u16(h);
    out.push(0xf7, 0, 0);                 // 256-colour global palette
    out.push(...gifPalette(transparent));

    if (frames.length > 1) {              // loop forever
        out.push(0x21, 0xff, 0x0b);
        str('NETSCAPE2.0');
        out.push(0x03, 0x01, 0x00, 0x00, 0x00);
    }

    for (const frame of frames) {
        // Graphic control: delay, and clear each frame when transparent
        out.push(0x21, 0xf9, 0x04, transparent ? (2 << 2) | 1 : (1 << 2));
        u16(delayCs);
        out.push(transparent ? GIF_TRANSPARENT_INDEX : 0, 0);
        // Image descriptor
        out.push(0x2c);
        u16(0); u16(0); u16(w); u16(h);
        out.push(0);
        lzwEncode(frame, 8, out);
    }
    out.push(0x3b);
    return new Uint8Array(out);
}
