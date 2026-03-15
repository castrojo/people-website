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

// Cache preloaded shapes so subsequent clicks are instant.
let cachedShapes: confetti.Shape[] | null = null;

async function loadLogoShapes(): Promise<confetti.Shape[]> {
  if (cachedShapes) return cachedShapes;

  const shapes = await Promise.all(
    CNCF_LOGO_URLS.map(url =>
      new Promise<confetti.Shape | null>(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(confetti.shapeFromImage({ src: url, width: 40, height: 40 }));
        img.onerror = () => resolve(null);
        img.src = url;
        // Timeout: skip logos that don't load within 3s
        setTimeout(() => resolve(null), 3000);
      })
    )
  );

  cachedShapes = shapes.filter((s): s is confetti.Shape => s !== null);
  // Fall back to squares if no logos loaded (e.g. offline)
  if (cachedShapes.length === 0) cachedShapes = ['square'];
  return cachedShapes;
}

// Preload in the background as soon as this module is imported.
loadLogoShapes();

// Per-element debounce: track last fire time by card element.
const lastFired = new WeakMap<Element, number>();
const DEBOUNCE_MS = 1200;

export async function fireConfetti(card: Element): Promise<void> {
  const now = Date.now();
  if ((lastFired.get(card) ?? 0) + DEBOUNCE_MS > now) return;
  lastFired.set(card, now);

  const rect = card.getBoundingClientRect();
  const origin = {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 2) / window.innerHeight,
  };

  const shapes = await loadLogoShapes();

  // Mix logo shapes with colored squares for density & festivity
  const mixed: confetti.Shape[] = [...shapes, 'square', 'square', 'circle'];

  const base = {
    origin,
    colors: CNCF_COLORS,
    shapes: mixed,
    scalar: 1.4,
    gravity: 1.1,
    drift: 0,
    ticks: 220,
  };

  // Pinata burst: three volleys in different directions
  confetti({ ...base, particleCount: 50, spread: 100, startVelocity: 50, angle: 90 });
  confetti({ ...base, particleCount: 30, spread: 80,  startVelocity: 35, angle: 60 });
  confetti({ ...base, particleCount: 30, spread: 80,  startVelocity: 35, angle: 120 });
}
