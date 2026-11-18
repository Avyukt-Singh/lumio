// WCAG AA contrast audit for Lumio design tokens (docs/DESIGN.md evidence).
// Usage: node scripts/contrast-audit.mjs
const themes = {
  morning: {
    background: '#F4F3FF', foreground: '#1D1B3A',
    card: '#FFFFFF', 'card-foreground': '#1D1B3A',
    primary: '#4F46E5', 'primary-foreground': '#FFFFFF',
    secondary: '#7C3AED', 'secondary-foreground': '#FFFFFF',
    accent: '#EA580C', 'accent-foreground': '#000000',
    muted: '#EBEEF8', 'muted-foreground': '#475569',
    border: '#C7D2FE', ring: '#4F46E5',
    destructive: '#DC2626', 'destructive-foreground': '#FFFFFF',
    success: '#15803D', 'success-foreground': '#FFFFFF',
    'success-soft': '#DCFCE7', 'success-soft-foreground': '#14532D',
  },
  evening: {
    background: '#FFF1EA', foreground: '#3A1D1D',
    card: '#FFFAF6', 'card-foreground': '#3A1D1D',
    primary: '#C23B27', 'primary-foreground': '#FFFFFF',
    secondary: '#9A3AB8', 'secondary-foreground': '#FFFFFF',
    accent: '#B4230F', 'accent-foreground': '#FFFFFF',
    muted: '#F6E4D8', 'muted-foreground': '#6E4433',
    border: '#EBD0C2', ring: '#C23B27',
    destructive: '#B4230F', 'destructive-foreground': '#FFFFFF',
    success: '#15803D', 'success-foreground': '#FFFFFF',
    'success-soft': '#E7F7EC', 'success-soft-foreground': '#14532D',
  },
  night: {
    background: '#0F1024', foreground: '#ECEBFF',
    card: '#191A38', 'card-foreground': '#ECEBFF',
    primary: '#6C8CFF', 'primary-foreground': '#0F1024',
    secondary: '#A78BFA', 'secondary-foreground': '#0F1024',
    accent: '#FFB59D', 'accent-foreground': '#3A1D1D',
    muted: '#23244A', 'muted-foreground': '#A3A1CF',
    border: '#3A3B66', ring: '#6C8CFF',
    destructive: '#F87171', 'destructive-foreground': '#0F1024',
    success: '#4ADE80', 'success-foreground': '#0F1024',
    'success-soft': '#16321F', 'success-soft-foreground': '#86EFAC',
  },
};
function lum(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
let fails = 0, checks = 0;
for (const [theme, t] of Object.entries(themes)) {
  const pairs = [
    ['body text', t.foreground, t.background],
    ['card text', t['card-foreground'], t.card],
    ['primary button', t['primary-foreground'], t.primary],
    ['secondary button', t['secondary-foreground'], t.secondary],
    ['accent button', t['accent-foreground'], t.accent],
    ['muted text', t['muted-foreground'], t.background],
    ['muted text on card', t['muted-foreground'], t.card],
    ['destructive button', t['destructive-foreground'], t.destructive],
    ['success button', t['success-foreground'], t.success],
    ['success soft text', t['success-soft-foreground'], t['success-soft']],
    ['muted text on muted', t['muted-foreground'], t.muted],
  ];
  console.log(`Theme: ${theme}`);
  for (const [name, fg, bg] of pairs) {
    const r = ratio(fg, bg);
    checks++;
    const ok = r >= 4.5;
    if (!ok) fails++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${r.toFixed(2)}:1  ${name}  (${fg} on ${bg})`);
  }
}
console.log(`\n${checks - fails}/${checks} checks pass WCAG AA (4.5:1). ${fails} failures.`);
process.exit(fails ? 1 : 0);
