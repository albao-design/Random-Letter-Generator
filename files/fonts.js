// Google Fonts collection for the Random Letter Generator.
// Names must match Google Fonts exactly. Renamed families have been updated:
// Source Serif Pro -> Source Serif 4, Source Sans Pro -> Source Sans 3, Fredoka One -> Fredoka.
const serifFonts = [
    'Playfair Display', 'Cormorant Garamond', 'Crimson Text', 'Libre Baskerville',
    'Lora', 'Merriweather', 'Source Serif 4', 'Spectral', 'Vollkorn',
    'Cardo', 'Gentium Plus', 'Neuton', 'Old Standard TT', 'PT Serif',
    'Bitter', 'Domine', 'Noticia Text', 'Tinos', 'Gelasio', 'IBM Plex Serif'
];

const sansSerifFonts = [
    'Montserrat', 'Open Sans', 'Roboto', 'Lato', 'Source Sans 3', 'Nunito',
    'Raleway', 'Ubuntu', 'Poppins', 'Inter', 'Fira Sans', 'Work Sans',
    'Barlow', 'Rubik', 'DM Sans', 'Manrope', 'Red Hat Display', 'Outfit',
    'Plus Jakarta Sans', 'Space Grotesk', 'Archivo', 'Assistant', 'Heebo',
    'Karla', 'Oxygen', 'PT Sans', 'Quicksand', 'Titillium Web'
];

const displayFonts = [
    'Anton', 'Bebas Neue', 'Fredoka', 'Righteous', 'Oswald', 'Fjalla One',
    'Alfa Slab One', 'Bungee', 'Comfortaa', 'Pacifico', 'Lobster', 'Dancing Script',
    'Great Vibes', 'Satisfy', 'Kaushan Script', 'Amatic SC', 'Bangers',
    'Creepster', 'Eater', 'Nosifer', 'Butcherman', 'Chela One', 'Griffy'
];

const handwritingFonts = [
    'Caveat', 'Indie Flower', 'Permanent Marker', 'Shadows Into Light',
    'Homemade Apple', 'Covered By Your Grace', 'Kalam', 'Patrick Hand',
    'Architects Daughter', 'Coming Soon', 'Gloria Hallelujah', 'Handlee',
    'Reenie Beanie', 'Rock Salt', 'Schoolbell', 'Walter Turncoat'
];

const monospaceFonts = [
    'Roboto Mono', 'Source Code Pro', 'Fira Code', 'JetBrains Mono',
    'IBM Plex Mono', 'Inconsolata', 'Space Mono', 'Ubuntu Mono',
    'Courier Prime', 'Overpass Mono', 'PT Mono', 'Share Tech Mono'
];

const decorativeFonts = [
    'Orbitron', 'Black Ops One', 'Bungee Shade', 'Monoton', 'Stalinist One',
    'Wallpoet', 'Squada One', 'Audiowide', 'Iceberg', 'Jura', 'Michroma',
    'Russo One', 'Teko', 'Exo 2', 'Rajdhani', 'Saira Condensed',
    'Chakra Petch', 'Electrolize', 'Gugi', 'Hanalei Fill', 'Seymour One'
];

const vintageFonts = [
    'Fredericka the Great', 'Abril Fatface', 'Bungee Inline', 'Fascinate',
    'Rye', 'Salsa', 'Slackey', 'Smokum', 'Supermercado One', 'Trade Winds',
    'Vast Shadow', 'Vampiro One'
];

// Combined list (duplicates removed)
const allFonts = [...new Set([
    ...serifFonts, ...sansSerifFonts, ...displayFonts, ...handwritingFonts,
    ...monospaceFonts, ...decorativeFonts, ...vintageFonts
])];

// Used only if Google Fonts can't be reached at all (e.g. offline)
const fallbackFonts = [
    'Georgia', 'Times New Roman', 'Arial', 'Verdana', 'Courier New',
    'Trebuchet MS', 'Impact', 'Palatino', 'Helvetica', 'Tahoma'
];

// Fonts confirmed loaded and ready to draw with. Filled in by loadGoogleFonts().
window.availableFonts = [];
window.fontsReady = false;

const FONT_BATCH_SIZE = 12;      // fonts per Google request, so one bad name can't break everything
const FONT_TIMEOUT_MS = 8000;    // give up on any single font after this long

function withTimeout(promise, ms, fallbackValue) {
    return Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(fallbackValue), ms))
    ]);
}

// Load fonts in small batches, then keep only the ones that actually arrived.
function loadGoogleFonts() {
    const batches = [];
    for (let i = 0; i < allFonts.length; i += FONT_BATCH_SIZE) {
        batches.push(allFonts.slice(i, i + FONT_BATCH_SIZE));
    }

    const stylesheetsLoaded = batches.map(batch => new Promise(resolve => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=' +
            batch.map(font => encodeURIComponent(font).replace(/%20/g, '+')).join('&family=') +
            '&display=swap';
        link.onload = () => resolve(true);
        link.onerror = () => {
            console.warn('A font batch failed to load:', batch.join(', '));
            resolve(false);
        };
        document.head.appendChild(link);
    }));

    return withTimeout(Promise.all(stylesheetsLoaded), FONT_TIMEOUT_MS, [])
        .then(() => Promise.all(allFonts.map(font =>
            withTimeout(
                document.fonts.load(`40px "${font}"`, 'AaBbQq09')
                    .then(faces => (faces && faces.length > 0) ? font : null)
                    .catch(() => null),
                FONT_TIMEOUT_MS,
                null
            )
        )))
        .then(results => {
            const loaded = results.filter(Boolean);
            const missing = allFonts.filter(font => !loaded.includes(font));
            if (missing.length) console.warn(`${missing.length} fonts did not load:`, missing.join(', '));
            console.log(`${loaded.length} of ${allFonts.length} Google Fonts ready`);

            window.availableFonts = loaded.length > 0 ? loaded : fallbackFonts;
            window.fontsReady = true;
            document.dispatchEvent(new Event('fontsready'));
        });
}

window.loadGoogleFonts = loadGoogleFonts;

// Start loading as soon as the page is ready
document.addEventListener('DOMContentLoaded', loadGoogleFonts);
