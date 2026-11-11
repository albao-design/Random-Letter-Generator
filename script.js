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
const CHAOS_LOOP = 4000;        // chaos motion repeats every 4s (so videos loop cleanly)
const TYPE_RATE = 8 / 1000;     // typewriter: 8 letters per second at 1x
const TYPE_HOLD = 800;          // typewriter: 0.8s pause on the full message before replaying
const SHUFFLE_STEP = 200;       // shuffle: new font mix every 200ms at 1x
const SHUFFLE_VERSIONS = 6;     // shuffle: number of font mixes it cycles through
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
        text(window.fontsReady ? t('emptyCanvas') : t('loadingFonts'), width / 2, height / 2);
    }
}

// ------------------------------------------------------------
// Generating the note
// ------------------------------------------------------------
// Pick a random font, avoiding any in `exclude` when possible
function randomFont(exclude = []) {
    const fonts = window.availableFonts.length ? window.availableFonts : ['Arial'];
    const choices = fonts.filter(f => !exclude.includes(f));
    const pool = choices.length ? choices : fonts;
    return pool[Math.floor(Math.random() * pool.length)];
}

// `avoid` is a list of other versions of the same message: each letter gets a font
// different from the one at the same position in those versions
function makeLetters(text, avoid = []) {
    return Array.from(text).map((char, i) => {
        if (char.trim() === '') return { char: ' ', isSpace: true };
        const exclude = avoid.map(version => version[i] && version[i].font).filter(Boolean);
        return {
            char,
            isSpace: false,
            font: randomFont(exclude),
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
    // Shuffle versions: no letter keeps the same font from one flip to the next,
    // including when the sequence loops from the last version back to the first
    shuffleVersions = [generatedLetters];
    for (let v = 1; v < SHUFFLE_VERSIONS; v++) {
        const avoid = [shuffleVersions[v - 1]];
        if (v === SHUFFLE_VERSIONS - 1) avoid.push(shuffleVersions[0]);
        shuffleVersions.push(makeLetters(currentText, avoid));
    }
    chaosParams = makeChaosParams(generatedLetters.filter(l => !l.isSpace).length);

    // If an animation is selected, play it straight away from the beginning
    animationState.time = 0;
    animationState.playing = animationState.type !== 'none';
    resetPreparedVideo();
    updateAnimationButtons();
    updateExportButtons();
}

// ------------------------------------------------------------
// Drawing (shared by the live canvas and the PNG/MP4 exports)
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

    if (transparent) g.clear();
    else if (opts.background) g.background(...opts.background);
    else g.background(paperColor());

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

    // On screen: shrink to fit if the note is wider or taller than the canvas
    const screenFit = (w, h) => Math.min(
        1,
        (w - 80) / Math.max(totalWidth, 1),
        (h * 0.7) / Math.max(tallest * 1.2, 1)
    );

    let fit;
    if (opts.fill) {
        // Square video: scale the letters up or down to fill the frame, with a margin
        fit = Math.min(
            (g.width * 0.84) / Math.max(totalWidth, 1),
            (g.height * 0.6) / Math.max(tallest * 1.2, 1)
        );
        // Keep blur looking the same as on screen at the new scale
        blurScale = fit / screenFit(width, height);
    } else {
        fit = screenFit(g.width, g.height);
        blurScale = 1;
    }

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

// How much to scale blur by (1 on screen; larger when letters are scaled up for video)
let blurScale = 1;

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
    ctx.shadowBlur = effects.blur * 2 * g.pixelDensity() * blurScale;

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
    updateExportButtons();
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
// Export: PNG
// ------------------------------------------------------------
function updateExportButtons() {
    const hasNote = generatedLetters.length > 0;
    const hasAnimation = animationState.type !== 'none';
    document.getElementById('exportPngBtn').disabled = !hasNote;
    document.getElementById('exportMp4Btn').disabled = !hasNote || !hasAnimation || videoBusy;

    if (hasNote && !hasAnimation && !lastStatus) setExportStatus('mp4Hint');
    if ((hasAnimation || !hasNote) && lastStatus && lastStatus.key === 'mp4Hint') setExportStatus(null);
}

// Status line under the export buttons. Messages are stored by name (see translations.js)
// so they switch language along with everything else.
let lastStatus = null;

function setExportStatus(key, vars = {}, tipKey = null) {
    lastStatus = key ? { key, vars, tipKey } : null;
    renderExportStatus();
}

function renderExportStatus() {
    const el = document.getElementById('exportStatus');
    if (!el) return;
    el.textContent = lastStatus
        ? t(lastStatus.key, lastStatus.vars) + (lastStatus.tipKey ? ' ' + t(lastStatus.tipKey) : '')
        : '';
}

function updateMp4ButtonLabel() {
    const btn = document.getElementById('exportMp4Btn');
    if (btn) btn.textContent = preparedVideo ? t('saveMp4') : t('downloadMp4');
}

function isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
}

// Turn a canvas image into a file right away (keeps the tap "fresh" for the share sheet)
function dataUrlToFile(dataUrl, name) {
    const [header, base64] = dataUrl.split(',');
    const type = header.match(/:(.*?);/)[1];
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new File([arr], name, { type });
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

// PNG export: square, same framing as the MP4, saved at double resolution for sharpness
const PNG_SIZE = 1080;
const PNG_DENSITY = 2; // 2160 × 2160 pixels

function exportPNG() {
    if (!generatedLetters.length) return;
    const g = createGraphics(PNG_SIZE, PNG_SIZE);
    g.pixelDensity(PNG_DENSITY);

    // The current frame, laid out to fill the square like the video
    drawScene(g, {
        time: animationState.time,
        animate: animationState.playing,
        type: animationState.type,
        transparent: transparentBackground,
        fill: true
    });

    const out = document.createElement('canvas');
    out.width = g.elt.width;
    out.height = g.elt.height;
    out.getContext('2d').drawImage(g.elt, 0, 0);
    g.remove();

    const name = fileName('png');
    const size = { w: out.width, h: out.height };

    // Phones: open the share sheet so "Save Image" puts it straight into Photos/Gallery
    if (isTouchDevice() && navigator.canShare) {
        const file = dataUrlToFile(out.toDataURL('image/png'), name);
        if (navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file] })
                .then(() => setExportStatus('pngShared'))
                .catch(err => {
                    if (err && err.name === 'AbortError') {
                        setExportStatus('pngCancelled');
                    } else {
                        downloadBlob(file, name);
                        setExportStatus('pngSaved', size);
                    }
                });
            return;
        }
    }

    out.toBlob(blob => {
        downloadBlob(blob, name);
        setExportStatus('pngSaved', size);
    }, 'image/png');
}

const nextTick = () => new Promise(r => setTimeout(r, 0));

// ------------------------------------------------------------
// MP4 export: 1080 x 1080, 30fps, about 8 seconds of complete loops
// ------------------------------------------------------------
const VIDEO_SIZE = 1080;
const VIDEO_FPS = 30;
const VIDEO_TARGET_MS = 8000;
const CHROMA_GREEN = [0, 255, 0]; // green-screen background used when "Transparent" is ticked
const H264_CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.420028']; // High, Main, Baseline

let preparedVideo = null; // finished video waiting for the user to tap "Save MP4" (phones)
let videoBusy = false;

// Work out frames so the video is made of whole loops (seamless when platforms repeat it)
function videoTimeline(type) {
    const speed = animationState.speed;
    const letterCount = generatedLetters.filter(l => !l.isSpace).length;
    let start = 0;
    let span; // animation time of one loop

    switch (type) {
        case 'bounce':
            start = (letterCount - 1) * BOUNCE_DELAY + 1;   // every letter already hopping
            span = 2 * Math.PI / BOUNCE_RATE;
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
            span = 2 * Math.PI / 0.01;
            break;
        case 'typewriter':
            span = generatedLetters.length / TYPE_RATE + TYPE_HOLD * speed;
            break;
        case 'shuffle':
            span = SHUFFLE_STEP * shuffleVersions.length;
            break;
        default:
            return null;
    }

    const loopMs = span / speed;                                    // one loop in real time
    const loops = Math.max(1, Math.round(VIDEO_TARGET_MS / loopMs));
    const frames = Math.max(VIDEO_FPS, Math.round(loops * loopMs * VIDEO_FPS / 1000));
    return { start, step: (loops * span) / frames, frames };
}

async function pickH264Codec() {
    for (const codec of H264_CODECS) {
        try {
            const res = await VideoEncoder.isConfigSupported({
                codec, width: VIDEO_SIZE, height: VIDEO_SIZE, bitrate: 8e6, framerate: VIDEO_FPS
            });
            if (res.supported) return codec;
        } catch (e) { /* try the next one */ }
    }
    return null;
}

// Phones get the share sheet (Save Video / Instagram / TikTok…); computers get a download
function shouldUseShareSheet(file) {
    return isTouchDevice() && navigator.canShare && navigator.canShare({ files: [file] });
}

function resetPreparedVideo() {
    if (!preparedVideo) return;
    preparedVideo = null;
    document.getElementById('exportMp4Btn').classList.remove('ready');
    updateMp4ButtonLabel();
    setExportStatus(null);
    updateExportButtons();
}

async function shareVideo() {
    try {
        await navigator.share({ files: [preparedVideo] });
        setExportStatus('shareDone');
    } catch (err) {
        if (err && err.name === 'AbortError') {
            setExportStatus('shareCancelled');
        } else {
            downloadBlob(preparedVideo, preparedVideo.name); // share sheet unavailable: plain download
            setExportStatus('mp4Downloaded');
        }
    }
}

async function exportMP4() {
    if (preparedVideo) return shareVideo();
    if (!generatedLetters.length || animationState.type === 'none' || videoBusy) return;

    if (!window.VideoEncoder || !window.VideoFrame || !window.Mp4Muxer) {
        setExportStatus('mp4Unsupported');
        return;
    }
    const codec = await pickH264Codec();
    if (!codec) {
        setExportStatus('mp4Unsupported');
        return;
    }

    const btn = document.getElementById('exportMp4Btn');
    videoBusy = true;
    updateExportButtons();

    const type = animationState.type;
    const timeline = videoTimeline(type);
    const greenScreen = transparentBackground; // MP4 can't be see-through, so use a green screen
    const g = createGraphics(VIDEO_SIZE, VIDEO_SIZE);
    g.pixelDensity(1);

    try {
        const muxer = new Mp4Muxer.Muxer({
            target: new Mp4Muxer.ArrayBufferTarget(),
            video: { codec: 'avc', width: VIDEO_SIZE, height: VIDEO_SIZE, frameRate: VIDEO_FPS },
            fastStart: 'in-memory'
        });

        let encodeError = null;
        const encoder = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
            error: e => { encodeError = e; }
        });
        encoder.configure({
            codec,
            width: VIDEO_SIZE,
            height: VIDEO_SIZE,
            bitrate: 8e6,
            framerate: VIDEO_FPS
        });

        const frameDuration = 1e6 / VIDEO_FPS; // microseconds
        for (let f = 0; f < timeline.frames; f++) {
            if (encodeError) throw encodeError;
            drawScene(g, {
                time: timeline.start + f * timeline.step,
                animate: true,
                type,
                transparent: false,
                background: greenScreen ? CHROMA_GREEN : null,
                fill: true
            });
            const frame = new VideoFrame(g.elt, {
                timestamp: Math.round(f * frameDuration),
                duration: Math.round(frameDuration)
            });
            encoder.encode(frame, { keyFrame: f % (VIDEO_FPS * 2) === 0 });
            frame.close();

            // Don't let the encoder fall too far behind
            while (encoder.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 5));
            if (f % 10 === 0) {
                setExportStatus('creatingMp4', { p: Math.round(f / timeline.frames * 100) });
                await nextTick();
            }
        }

        await encoder.flush();
        if (encodeError) throw encodeError;
        encoder.close();
        muxer.finalize();

        const seconds = (timeline.frames / VIDEO_FPS).toFixed(1);
        const name = greenScreen ? fileName('mp4').replace(/\.mp4$/, '-greenscreen.mp4') : fileName('mp4');
        const file = new File([muxer.target.buffer], name, { type: 'video/mp4' });
        const tip = greenScreen ? 'chromaTip' : null;

        if (shouldUseShareSheet(file)) {
            // Phones need a fresh tap to open the share sheet
            preparedVideo = file;
            btn.classList.add('ready');
            updateMp4ButtonLabel();
            setExportStatus('videoReady', { s: seconds }, tip);
        } else {
            downloadBlob(file, file.name);
            setExportStatus('mp4Saved', { s: seconds }, tip);
        }
    } catch (err) {
        console.error(err);
        setExportStatus('mp4Error');
    } finally {
        g.remove();
        videoBusy = false;
        updateExportButtons();
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
    document.getElementById('exportMp4Btn').addEventListener('click', exportMP4);

    // Any change to the message or settings makes a prepared video out of date
    const panel = document.querySelector('.controls-panel');
    panel.addEventListener('input', resetPreparedVideo);
    panel.addEventListener('change', resetPreparedVideo);

    // Switching language re-shows the status line and button labels
    document.addEventListener('languagechange-app', () => {
        renderExportStatus();
        updateMp4ButtonLabel();
    });

    updateMp4ButtonLabel();
    updateAnimationButtons();
    updateExportButtons();
});
