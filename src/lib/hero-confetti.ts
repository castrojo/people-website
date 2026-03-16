import confetti from 'canvas-confetti';

// Curated CNCF graduated/incubating project logos — stable cross-origin SVGs.
const CNCF_LOGO_URLS = [
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/kubernetes.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/prometheus-icon-color.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/envoy.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/argo.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/helm.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/flux.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/containerd.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/etcd.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/core-dns.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/jaeger.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/fluentd.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/harbor.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/crossplane.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/dapr.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/keda.svg',
  'https://raw.githubusercontent.com/cncf/landscape/master/hosted_logos/open-telemetry.svg',
];

const CNCF_COLORS = ['#0086FF', '#D62293', '#93EAFF', '#FFB300', '#00A86B', '#7B2FBE'];

// Logo shapes are loaded in the background. Once ready, subsequent clicks use them.
let logoShapes: confetti.Shape[] | null = null;
let loadingLogos = false;

function loadLogoShapes(): void {
  if (loadingLogos || logoShapes !== null) return;
  loadingLogos = true;
  Promise.all(
    CNCF_LOGO_URLS.map(url =>
      new Promise<confetti.Shape | null>(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(confetti.shapeFromImage({ src: url, width: 40, height: 40 }));
        img.onerror = () => resolve(null);
        img.src = url;
        setTimeout(() => resolve(null), 4000);
      })
    )
  ).then(shapes => {
    const valid = shapes.filter((s): s is confetti.Shape => s !== null);
    logoShapes = valid.length > 0 ? valid : ['square'];
  });
}

// Start loading logos immediately on module import.
loadLogoShapes();

// Also preload on first hero card hover for faster first-click response.
export function preloadOnHover(card: Element): void {
  card.addEventListener('mouseenter', loadLogoShapes, { once: true });
  card.addEventListener('touchstart', loadLogoShapes, { once: true, passive: true });
}

// Per-element debounce — snappy 300ms so rapid clicks feel responsive.
const lastFired = new WeakMap<Element, number>();
const DEBOUNCE_MS = 300;

export function fireHearts(card: Element): void {
  const now = Date.now();
  if ((lastFired.get(card) ?? 0) + DEBOUNCE_MS > now) return;
  lastFired.set(card, now);

  const rect = card.getBoundingClientRect();
  const origin = {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };

  const heart = confetti.shapeFromText({ text: '💙', scalar: 2 });
  const base = {
    origin,
    colors: ['#0086FF', '#93EAFF', '#4DB8FF', '#1E90FF'],
    shapes: [heart],
    scalar: 2,
    gravity: 0.8,
    ticks: 280,
  };

  confetti({ ...base, particleCount: 30, spread: 80,  startVelocity: 40, angle: 90 });
  confetti({ ...base, particleCount: 15, spread: 60,  startVelocity: 28, angle: 60 });
  confetti({ ...base, particleCount: 15, spread: 60,  startVelocity: 28, angle: 120 });
}

export function fireConfetti(card: Element): void {
  const now = Date.now();
  if ((lastFired.get(card) ?? 0) + DEBOUNCE_MS > now) return;
  lastFired.set(card, now);

  const rect = card.getBoundingClientRect();
  const origin = {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };

  const base = {
    origin,
    colors: CNCF_COLORS,
    scalar: 1.4,
    gravity: 1.1,
    ticks: 220,
  };

  // Phase 1: fire INSTANTLY with simple shapes — zero latency, always works.
  const fastShapes: confetti.Shape[] = ['square', 'circle', 'square'];
  confetti({ ...base, shapes: fastShapes, particleCount: 50, spread: 100, startVelocity: 50, angle: 90 });
  confetti({ ...base, shapes: fastShapes, particleCount: 25, spread: 80,  startVelocity: 35, angle: 60 });
  confetti({ ...base, shapes: fastShapes, particleCount: 25, spread: 80,  startVelocity: 35, angle: 120 });

  // Phase 2: if logos already loaded, add a logo burst on top immediately.
  if (logoShapes && logoShapes.length > 0) {
    const mixed = [...logoShapes, 'square'];
    confetti({ ...base, shapes: mixed, particleCount: 40, spread: 110, startVelocity: 45, angle: 90 });
  }
}
