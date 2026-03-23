import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ── Shared GSAP defaults ── */
export const gsapEase = 'power3.out';
export const gsapEaseBack = 'back.out(1.4)';
export const gsapEaseElastic = 'elastic.out(1, 0.5)';

/* ── Reusable animation presets ── */

/** Stagger-in children of a container from below */
export function useStaggerReveal(containerRef, selector = '.gsap-item', opts = {}) {
  useGSAP(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll(selector);
    if (!items.length) return;
    gsap.fromTo(items,
      { opacity: 0, y: opts.y ?? 30, scale: opts.scale ?? 0.97 },
      {
        opacity: 1, y: 0, scale: 1,
        duration: opts.duration ?? 0.6,
        stagger: opts.stagger ?? 0.08,
        ease: opts.ease ?? gsapEase,
        delay: opts.delay ?? 0.1,
      }
    );
  }, { scope: containerRef, dependencies: opts.deps ?? [] });
}

/** Animate stat numbers counting up */
export function useCountUp(ref, endValue, opts = {}) {
  useEffect(() => {
    if (!ref.current || endValue == null) return;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: endValue,
      duration: opts.duration ?? 1.2,
      ease: opts.ease ?? 'power2.out',
      delay: opts.delay ?? 0.3,
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = opts.format
            ? opts.format(obj.val)
            : Math.round(obj.val).toLocaleString();
        }
      },
    });
  }, [endValue]);
}

/** Magnetic hover effect for buttons/cards */
export function useMagneticHover(ref, strength = 0.3) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;
      gsap.to(el, { x, y, duration: 0.3, ease: 'power2.out' });
    };
    const leave = () => gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('mousemove', move);
    el.addEventListener('mouseleave', leave);
    return () => { el.removeEventListener('mousemove', move); el.removeEventListener('mouseleave', leave); };
  }, []);
}

/** Parallax float on scroll */
export function useParallax(ref, y = 40) {
  useGSAP(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { y },
      { y: -y, ease: 'none', scrollTrigger: { trigger: ref.current, scrub: 1 } }
    );
  }, { scope: ref });
}

/** Hero text split-reveal (word by word) */
export function animateTextReveal(container, selector = '.gsap-word') {
  const words = container.querySelectorAll(selector);
  if (!words.length) return;
  return gsap.fromTo(words,
    { opacity: 0, y: 20, rotateX: -40 },
    { opacity: 1, y: 0, rotateX: 0, duration: 0.7, stagger: 0.04, ease: gsapEaseBack }
  );
}

/** Glow pulse on an element */
export function glowPulse(el, color = 'rgba(37, 99, 235, 0.3)') {
  return gsap.fromTo(el,
    { boxShadow: `0 0 0 0 ${color}` },
    { boxShadow: `0 0 20px 6px transparent`, duration: 1.5, repeat: -1, yoyo: true, ease: 'sine.inOut' }
  );
}

/** Card entrance with 3D tilt */
export function cardEntrance(cards, opts = {}) {
  return gsap.fromTo(cards,
    { opacity: 0, y: 40, rotateY: opts.rotateY ?? 5, transformPerspective: 800 },
    {
      opacity: 1, y: 0, rotateY: 0,
      duration: opts.duration ?? 0.7,
      stagger: opts.stagger ?? 0.1,
      ease: gsapEaseBack,
      delay: opts.delay ?? 0,
    }
  );
}

/** Progress bar fill animation */
export function animateProgressBar(el, toWidth, opts = {}) {
  return gsap.fromTo(el,
    { width: '0%' },
    { width: toWidth, duration: opts.duration ?? 1, ease: 'power2.out', delay: opts.delay ?? 0.5 }
  );
}

/** Smooth number ticker for dashboard stats */
export function tickerAnimation(el, endVal, opts = {}) {
  const obj = { val: 0 };
  return gsap.to(obj, {
    val: endVal,
    duration: opts.duration ?? 1.5,
    ease: 'power2.out',
    delay: opts.delay ?? 0,
    onUpdate() {
      if (el) {
        const prefix = opts.prefix ?? '';
        const suffix = opts.suffix ?? '';
        el.textContent = `${prefix}${Math.round(obj.val).toLocaleString()}${suffix}`;
      }
    },
  });
}
