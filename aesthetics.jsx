// Aesthetic palettes — each theme has paired light + dark variants.
// `mode` of 'auto' at the top level is resolved in app.jsx based on hour of day.

const AESTHETICS = {
  dispatch: {
    label: 'Dispatch',
    pair: 'dispatch',
    // dark is the original
    dark: {
      label: 'Dispatch · Night',
      mode: 'dark',
      bg: '#0e0e10',
      surface: '#17171a',
      colBg: '#1a1a1e',
      text: '#f2efe8',
      muted: '#8a8680',
      faint: '#4a4844',
      accent: '#d4a24c',
      gridLine: 'rgba(255,255,255,0.06)',
      chrome: '#0a0a0c',
      display: '"GT America", "Neue Haas Grotesk", Helvetica, -apple-system, sans-serif',
      sans: 'Helvetica, -apple-system, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    },
    // light — same type system, inverted surfaces, slightly deeper gold
    light: {
      label: 'Dispatch · Day',
      mode: 'light',
      bg: '#fafaf7',
      surface: '#ffffff',
      colBg: '#eeece4',
      text: '#17171a',
      muted: '#6d685f',
      faint: '#b0aba1',
      accent: '#b07a1e',
      gridLine: 'rgba(0,0,0,0.08)',
      chrome: '#f2f0e8',
      display: '"GT America", "Neue Haas Grotesk", Helvetica, -apple-system, sans-serif',
      sans: 'Helvetica, -apple-system, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    },
  },
  paper: {
    label: 'Paper',
    pair: 'paper',
    light: {
      label: 'Paper · Day',
      mode: 'light',
      bg: '#f7f4ee',
      surface: '#ffffff',
      colBg: '#efebe3',
      text: '#1a1814',
      muted: '#6b665e',
      faint: '#b5afa4',
      accent: '#9b4f2d',
      gridLine: 'rgba(26,24,20,0.08)',
      chrome: '#ebe6dc',
      display: '"Canela", "Tiempos Headline", Georgia, serif',
      sans: '"Söhne", Helvetica, -apple-system, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    },
    dark: {
      label: 'Paper · Night',
      mode: 'dark',
      bg: '#1a1814',
      surface: '#24211c',
      colBg: '#2a2620',
      text: '#f2ede3',
      muted: '#9a9288',
      faint: '#55504a',
      accent: '#c77a4d',
      gridLine: 'rgba(255,255,255,0.07)',
      chrome: '#14120e',
      display: '"Canela", "Tiempos Headline", Georgia, serif',
      sans: '"Söhne", Helvetica, -apple-system, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
    },
  },
  signal: {
    label: 'Signal',
    pair: 'signal',
    light: {
      label: 'Signal · Day',
      mode: 'light',
      bg: '#ededed',
      surface: '#ffffff',
      colBg: '#e0e0e0',
      text: '#0a0a0a',
      muted: '#5a5a5a',
      faint: '#9a9a9a',
      accent: '#e85c1a',
      gridLine: 'rgba(0,0,0,0.1)',
      chrome: '#d4d4d4',
      display: '"Inter Tight", Helvetica, -apple-system, sans-serif',
      sans: 'Helvetica, -apple-system, sans-serif',
      mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
    },
    dark: {
      label: 'Signal · Night',
      mode: 'dark',
      bg: '#0a0a0a',
      surface: '#151515',
      colBg: '#1c1c1c',
      text: '#ededed',
      muted: '#8a8a8a',
      faint: '#4a4a4a',
      accent: '#ff7a3d',
      gridLine: 'rgba(255,255,255,0.08)',
      chrome: '#050505',
      display: '"Inter Tight", Helvetica, -apple-system, sans-serif',
      sans: 'Helvetica, -apple-system, sans-serif',
      mono: '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace',
    },
  },
};

// Resolve a palette given the aesthetic key and a theme mode ('auto' | 'light' | 'dark').
// When 'auto', pick based on current hour: 19:00–06:59 = dark, 07:00–18:59 = light.
function resolveAesthetic(key, themeMode, hour) {
  const pair = AESTHETICS[key] || AESTHETICS.dispatch;
  let mode = themeMode;
  if (mode === 'auto') {
    const h = typeof hour === 'number' ? hour : new Date().getHours();
    mode = (h >= 19 || h < 7) ? 'dark' : 'light';
  }
  return pair[mode] || pair.dark || pair.light;
}

window.AESTHETICS = AESTHETICS;
window.resolveAesthetic = resolveAesthetic;
