import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock canvas-confetti before importing hero-confetti
vi.mock('canvas-confetti', () => {
  const mockConfetti = vi.fn();
  (mockConfetti as any).shapeFromText = vi.fn(() => 'mock-shape');
  (mockConfetti as any).shapeFromImage = vi.fn(() => Promise.resolve('mock-shape'));
  return { default: mockConfetti };
});

describe('tryDebounce', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns true on the first call for a new element', async () => {
    const { tryDebounce } = await import('../../src/lib/hero-confetti');
    const el = document.createElement('div');
    expect(tryDebounce(el)).toBe(true);
  });

  it('returns false on a second immediate call for the same element', async () => {
    const { tryDebounce } = await import('../../src/lib/hero-confetti');
    const el = document.createElement('div');
    tryDebounce(el); // first call — sets timestamp
    expect(tryDebounce(el)).toBe(false); // within debounce window
  });

  it('returns true again after the debounce window has elapsed', async () => {
    vi.useFakeTimers();
    const { tryDebounce } = await import('../../src/lib/hero-confetti');
    const el = document.createElement('div');
    tryDebounce(el);
    vi.advanceTimersByTime(350); // 300ms debounce + buffer
    expect(tryDebounce(el)).toBe(true);
    vi.useRealTimers();
  });

  it('treats two distinct elements independently', async () => {
    const { tryDebounce } = await import('../../src/lib/hero-confetti');
    const el1 = document.createElement('div');
    const el2 = document.createElement('div');
    expect(tryDebounce(el1)).toBe(true);
    expect(tryDebounce(el2)).toBe(true); // different element — fresh debounce
  });
});

describe('cardOrigin', () => {
  beforeEach(() => {
    vi.resetModules();
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
  });

  it('returns x as the horizontal center of the card relative to window width', async () => {
    const { cardOrigin } = await import('../../src/lib/hero-confetti');
    const el = document.createElement('div');
    // Card at x=200, width=200 → center at 300 → 300/1000 = 0.3
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 200, top: 100, width: 200, height: 100,
      right: 400, bottom: 200, x: 200, y: 100, toJSON: () => ({})
    } as DOMRect);
    const origin = cardOrigin(el);
    expect(origin.x).toBeCloseTo(0.3);
  });

  it('returns y as the vertical midpoint of the card relative to window height by default', async () => {
    const { cardOrigin } = await import('../../src/lib/hero-confetti');
    const el = document.createElement('div');
    // Card at top=100, height=200 → y=0.5 → top + height*0.5 = 200 → 200/800 = 0.25
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 100, width: 100, height: 200,
      right: 100, bottom: 300, x: 0, y: 100, toJSON: () => ({})
    } as DOMRect);
    const origin = cardOrigin(el);
    expect(origin.y).toBeCloseTo(0.25);
  });

  it('respects a custom yFraction parameter', async () => {
    const { cardOrigin } = await import('../../src/lib/hero-confetti');
    const el = document.createElement('div');
    // top=0, height=800, yFraction=0.25 → y = (0 + 200)/800 = 0.25
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 100, height: 800,
      right: 100, bottom: 800, x: 0, y: 0, toJSON: () => ({})
    } as DOMRect);
    const origin = cardOrigin(el, 0.25);
    expect(origin.y).toBeCloseTo(0.25);
  });
});

describe('fire functions — confetti calls', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(window, 'innerWidth', { value: 1000, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true });
  });

  function makeCard() {
    const el = document.createElement('div');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      left: 400, top: 300, width: 200, height: 100,
      right: 600, bottom: 400, x: 400, y: 300, toJSON: () => ({})
    } as DOMRect);
    return el;
  }

  it('fireHearts calls confetti at least once on first invocation', async () => {
    const confettiModule = await import('canvas-confetti');
    const mockConfetti = confettiModule.default as unknown as ReturnType<typeof vi.fn>;
    mockConfetti.mockClear();
    const { fireHearts } = await import('../../src/lib/hero-confetti');
    const el = makeCard();
    fireHearts(el);
    expect(mockConfetti).toHaveBeenCalled();
  });

  it('fireHearts does NOT call confetti on immediate second invocation (debounced)', async () => {
    const confettiModule = await import('canvas-confetti');
    const mockConfetti = confettiModule.default as unknown as ReturnType<typeof vi.fn>;
    const { fireHearts } = await import('../../src/lib/hero-confetti');
    const el = makeCard();
    fireHearts(el); // prime the debounce
    mockConfetti.mockClear();
    fireHearts(el); // should be blocked
    expect(mockConfetti).not.toHaveBeenCalled();
  });

  it('fireStarburst calls confetti once on first invocation', async () => {
    const confettiModule = await import('canvas-confetti');
    const mockConfetti = confettiModule.default as unknown as ReturnType<typeof vi.fn>;
    mockConfetti.mockClear();
    const { fireStarburst } = await import('../../src/lib/hero-confetti');
    const el = makeCard();
    fireStarburst(el);
    expect(mockConfetti).toHaveBeenCalledTimes(1);
  });

  it('fireFountain calls confetti once on first invocation', async () => {
    const confettiModule = await import('canvas-confetti');
    const mockConfetti = confettiModule.default as unknown as ReturnType<typeof vi.fn>;
    mockConfetti.mockClear();
    // Need getComputedStyle to return something for --card-accent
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '#D62293',
    } as unknown as CSSStyleDeclaration);
    const { fireFountain } = await import('../../src/lib/hero-confetti');
    const el = makeCard();
    fireFountain(el);
    expect(mockConfetti).toHaveBeenCalledTimes(1);
  });

  it('fireConfetti calls confetti at least 3 times on first invocation', async () => {
    const confettiModule = await import('canvas-confetti');
    const mockConfetti = confettiModule.default as unknown as ReturnType<typeof vi.fn>;
    mockConfetti.mockClear();
    const { fireConfetti } = await import('../../src/lib/hero-confetti');
    const el = makeCard();
    fireConfetti(el);
    expect(mockConfetti.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
