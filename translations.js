// Interface text in English and Latin American Spanish.
// To change any wording, edit the text in quotes. {curly} words are filled in automatically.
const TRANSLATIONS = {
    en: {
        pageTitle: 'Random Letter Generator',
        title: 'Random Letter Generator',
        subtitle: 'Create expressive typography with mixed fonts and effects',
        language: 'Language',
        yourMessage: 'Your Message',
        placeholder: 'Enter your message...',
        generate: 'Generate',

        textEffects: 'Text Effects',
        blur: 'Blur',
        spacing: 'Spacing',
        stretch: 'Stretch',
        size: 'Size',
        strokeWeight: 'Stroke Weight',
        tilt: 'Tilt',

        animations: 'Animations',
        animationType: 'Animation Type',
        animNone: 'None',
        animBounce: 'Bounce',
        animChaos: 'Chaos',
        animFloat: 'Float',
        animPulse: 'Pulse',
        animTypewriter: 'Typewriter',
        animShuffle: 'Shuffle',
        speed: 'Speed',
        play: 'Play',
        stop: 'Stop',
        playAria: 'Play animation',
        stopAria: 'Stop animation',

        export: 'Export',
        downloadPng: 'Download PNG',
        downloadMp4: 'Download MP4',
        saveMp4: 'Save MP4',
        invert: 'Invert (white on black)',
        transparent: 'Transparent background (green screen for MP4)',

        canvasAria: 'Generated letters display',
        loadingFonts: 'Loading fonts…',
        emptyCanvas: 'Enter your message and click Generate',

        mp4Hint: 'Pick an animation to export an MP4.',
        pngSaved: 'PNG saved ({w} × {h}px)',
        pngShared: 'Done.',
        pngCancelled: 'Cancelled. Tap Download PNG to try again.',
        creatingMp4: 'Creating MP4… {p}%',
        mp4Unsupported: 'This browser can’t create MP4 video. Please try the latest Chrome or Safari.',
        mp4Error: 'The video couldn’t be created. Try a shorter message or reload the page.',
        videoReady: 'Video ready ({s}s). Tap Save MP4 to save or share it.',
        mp4Saved: 'MP4 saved ({s}s, 1080 × 1080).',
        chromaTip: 'Use Chroma Key in your editing app to remove the green.',
        shareDone: 'Done. Tap Save MP4 again to share it somewhere else.',
        shareCancelled: 'Cancelled. Tap Save MP4 to try again.',
        mp4Downloaded: 'MP4 downloaded.'
    },

    es: {
        pageTitle: 'Generador de Letras Aleatorias',
        title: 'Generador de Letras Aleatorias',
        subtitle: 'Crea tipografía expresiva con fuentes y efectos mezclados',
        language: 'Idioma',
        yourMessage: 'Tu mensaje',
        placeholder: 'Escribe tu mensaje...',
        generate: 'Generar',

        textEffects: 'Efectos de texto',
        blur: 'Desenfoque',
        spacing: 'Espaciado',
        stretch: 'Estirar',
        size: 'Tamaño',
        strokeWeight: 'Grosor del trazo',
        tilt: 'Inclinación',

        animations: 'Animaciones',
        animationType: 'Tipo de animación',
        animNone: 'Ninguna',
        animBounce: 'Rebote',
        animChaos: 'Caos',
        animFloat: 'Flotar',
        animPulse: 'Pulso',
        animTypewriter: 'Máquina de escribir',
        animShuffle: 'Mezclar',
        speed: 'Velocidad',
        play: 'Reproducir',
        stop: 'Detener',
        playAria: 'Reproducir animación',
        stopAria: 'Detener animación',

        export: 'Exportar',
        downloadPng: 'Descargar PNG',
        downloadMp4: 'Descargar MP4',
        saveMp4: 'Guardar MP4',
        invert: 'Invertir (blanco sobre negro)',
        transparent: 'Fondo transparente (pantalla verde en MP4)',

        canvasAria: 'Letras generadas',
        loadingFonts: 'Cargando fuentes…',
        emptyCanvas: 'Escribe tu mensaje y presiona Generar',

        mp4Hint: 'Elige una animación para exportar un MP4.',
        pngSaved: 'PNG guardado ({w} × {h} px)',
        pngShared: 'Listo.',
        pngCancelled: 'Cancelado. Toca Descargar PNG para intentarlo de nuevo.',
        creatingMp4: 'Creando MP4… {p}%',
        mp4Unsupported: 'Este navegador no puede crear videos MP4. Prueba con la versión más reciente de Chrome o Safari.',
        mp4Error: 'No se pudo crear el video. Prueba con un mensaje más corto o recarga la página.',
        videoReady: 'Video listo ({s} s). Toca Guardar MP4 para guardarlo o compartirlo.',
        mp4Saved: 'MP4 guardado ({s} s, 1080 × 1080).',
        chromaTip: 'Usa Chroma Key en tu app de edición para quitar el verde.',
        shareDone: 'Listo. Toca Guardar MP4 otra vez para compartirlo en otro lugar.',
        shareCancelled: 'Cancelado. Toca Guardar MP4 para intentarlo de nuevo.',
        mp4Downloaded: 'MP4 descargado.'
    }
};

const LANG_STORAGE_KEY = 'random-letters-language';

// Saved choice first, then the device language, then English
function initialLanguage() {
    try {
        const saved = localStorage.getItem(LANG_STORAGE_KEY);
        if (saved && TRANSLATIONS[saved]) return saved;
    } catch (e) { /* storage unavailable */ }
    const device = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return device.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let currentLang = 'en';

// Look up a piece of text, filling in any {placeholders}
function t(key, vars = {}) {
    const text = (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) ?? TRANSLATIONS.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? vars[name] : m));
}

// Update every marked element on the page
function applyTranslations() {
    document.documentElement.lang = currentLang === 'es' ? 'es-419' : 'en';
    document.title = t('pageTitle');

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
        const active = btn.dataset.lang === currentLang;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });

    document.dispatchEvent(new Event('languagechange-app'));
}

function setLanguage(lang) {
    if (!TRANSLATIONS[lang]) return;
    currentLang = lang;
    try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
    applyTranslations();
}

document.addEventListener('DOMContentLoaded', () => {
    currentLang = initialLanguage();
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });
    applyTranslations();
});
