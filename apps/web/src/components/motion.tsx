import React, { useEffect, useRef, useState } from 'react';

/** True when the visitor asked the OS for reduced motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reports whether an element has scrolled into view. With `once` (default) it
 * latches true, so reveal animations play a single time.
 */
export function useInView<T extends Element>(options: { once?: boolean; margin?: string; threshold?: number } = {}) {
  const { once = true, margin = '0px 0px -10% 0px', threshold = 0.15 } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { rootMargin: margin, threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once, margin, threshold]);

  return { ref, inView };
}

interface RevealProps {
  children: React.ReactNode;
  /** Delay in milliseconds; use it to stagger siblings. */
  delay?: number;
  from?: 'up' | 'left' | 'right' | 'scale' | 'none';
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article' | 'span';
}

/** Fades and slides its children in the first time they enter the viewport. */
export const Reveal: React.FC<RevealProps> = ({ children, delay = 0, from = 'up', className = '', as = 'div' }) => {
  const { ref, inView } = useInView<HTMLElement>();
  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${from} ${inView ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
};

interface CountUpProps {
  to: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

/** Counts from zero to `to` once the number scrolls into view. */
export const CountUp: React.FC<CountUpProps> = ({ to, durationMs = 1400, prefix = '', suffix = '', decimals = 0, className }) => {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(to * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, durationMs]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
};

interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/** A card whose soft highlight follows the pointer. Styling lives in `.spotlight`. */
export const Spotlight: React.FC<SpotlightProps> = ({ children, className = '', ...rest }) => {
  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--spot-x', `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty('--spot-y', `${event.clientY - rect.top}px`);
  };
  return (
    <div {...rest} onMouseMove={handleMove} className={`spotlight ${className}`}>
      {children}
    </div>
  );
};

/**
 * Cycles through `count` steps on a timer. Pauses while `paused`, while the tab
 * is hidden, and never auto-advances for visitors who prefer reduced motion.
 */
export function useAutoStep(count: number, intervalMs: number, paused = false) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setStep((current) => (current + 1) % count);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [count, intervalMs, paused]);

  return [step, setStep] as const;
}
