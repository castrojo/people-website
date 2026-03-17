import confetti from 'canvas-confetti';
const CNCF_LOGO_URLS = [
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/kubernetes.svg',      'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/prometheus-icon-color.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/envoy.svg',           'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/argo.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/helm.svg',            'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/flux.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/containerd.svg',      'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/etcd.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/core-dns.svg',        'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/jaeger.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/fluentd.svg',         'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/harbor.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/crossplane.svg',      'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/dapr.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/keda.svg',            'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/open-telemetry.svg',
];
const CNCF_COLORS = ['#0086FF', '#D62293', '#93EAFF', '#FFB300', '#00A86B', '#7B2FBE'];
let logoShapes: confetti.Shape[] | null = null, loadingLogos = false;
function loadLogoShapes(): void {
  if (loadingLogos || logoShapes !== null) return;
  loadingLogos = true;
  Promise.all(CNCF_LOGO_URLS.map(url => new Promise<confetti.Shape | null>(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(confetti.shapeFromImage({ src: url, width: 40, height: 40 }));
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(null), 4000);
  }))).then(shapes => {
    const valid = shapes.filter((s): s is confetti.Shape => s !== null);
    logoShapes = valid.length > 0 ? valid : ['square'];
  });
}
loadLogoShapes();
export function preloadOnHover(card: Element): void {
  card.addEventListener('mouseenter', loadLogoShapes, { once: true });
  card.addEventListener('touchstart', loadLogoShapes, { once: true, passive: true });
}
const lastFired = new WeakMap<Element, number>(), DEBOUNCE_MS = 300;
export function tryDebounce(card: Element): boolean {
  const now = Date.now();
  if ((lastFired.get(card) ?? 0) + DEBOUNCE_MS > now) return false;
  lastFired.set(card, now);
  return true;
}
export function cardOrigin(card: Element, yFraction = 0.5) {
  const rect = card.getBoundingClientRect();
  return {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height * yFraction) / window.innerHeight,
  };
}
export function fireHearts(card: Element): void {
  if (!tryDebounce(card)) return;
  const origin = cardOrigin(card);
  const b = confetti.shapeFromText({ text: '💙', scalar: 4 });
  const r = confetti.shapeFromText({ text: '❤️', scalar: 4 });
  const base = {
    origin,
    colors: ['#0086FF', '#CC0000', '#93EAFF', '#FF4444'],
    shapes: [b, r, b, r],
    scalar: 4, gravity: 0.8, ticks: 280,
  };
  confetti({ ...base, particleCount: 15, spread: 100, startVelocity: 40, angle: 90 });
  confetti({ ...base, particleCount:  8, spread:  80, startVelocity: 28, angle: 60 });
  confetti({ ...base, particleCount:  8, spread:  80, startVelocity: 28, angle: 120 });
}
export function fireStarburst(card: Element): void {
  if (!tryDebounce(card)) return;
  const origin = cardOrigin(card);
  const star = confetti.shapeFromText({ text: '⭐', scalar: 2.5 });
  const sparkle = confetti.shapeFromText({ text: '✨', scalar: 2.5 });
  confetti({ origin, colors: ['#0086FF', '#FFB300', '#D62293', '#00A86B', '#93EAFF'],
    shapes: [star, sparkle, star], scalar: 2.5, gravity: 0.65, ticks: 210,
    particleCount: 22, spread: 360, startVelocity: 28 });
}
export function fireFountain(card: Element): void {
  if (!tryDebounce(card)) return;
  const origin = cardOrigin(card, 0.3);
  const accent = (getComputedStyle(card as HTMLElement).getPropertyValue('--card-accent') || '#0086FF').trim();
  confetti({ origin, colors: [accent, '#0086FF', accent, '#93EAFF', accent + 'BB'],
    shapes: ['square', 'circle', 'square'], scalar: 1.0, gravity: 1.5, ticks: 190,
    particleCount: 45, spread: 55, startVelocity: 38, angle: 90 });
}
export function fireConfetti(card: Element): void {
  if (!tryDebounce(card)) return;
  const origin = cardOrigin(card);
  const base = { origin, colors: CNCF_COLORS, scalar: 1.4, gravity: 1.1, ticks: 220 };
  const fs: confetti.Shape[] = ['square', 'circle', 'square'];
  confetti({ ...base, shapes: fs, particleCount: 50, spread: 100, startVelocity: 50, angle: 90 });
  confetti({ ...base, shapes: fs, particleCount: 25, spread:  80, startVelocity: 35, angle: 60 });
  confetti({ ...base, shapes: fs, particleCount: 25, spread:  80, startVelocity: 35, angle: 120 });
  if (logoShapes?.length) {
    confetti({ ...base, shapes: [...logoShapes, 'square'], particleCount: 40, spread: 110, startVelocity: 45, angle: 90 });
  }
}
