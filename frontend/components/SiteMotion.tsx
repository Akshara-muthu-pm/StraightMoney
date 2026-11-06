"use client";

import { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { releaseFrames, tapFeedbackFrames } from "@/lib/spring-motion";

const MotionContext = createContext({ motion: false, reduced: true });
export const useSiteMotion = () => useContext(MotionContext);
function subscribePreference(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

export default function SiteMotion({ children }: { children: React.ReactNode }) {
  const reduced = useSyncExternalStore(subscribePreference, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const motion = !reduced;
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const surface = root.current;
    if (!surface || !motion) return;
    const animations = new Map<HTMLElement, Animation>();
    const pressed = new Set<HTMLElement>();
    const selector = "button, a[href], summary, .role-card";
    const control = (target: EventTarget | null) => {
      const element = target instanceof Element ? target.closest<HTMLElement>(selector) : null;
      if (!element || element.matches(":disabled, [aria-disabled='true']") || element.closest(".ag-root, [data-no-motion]")) return null;
      return element;
    };
    const animate = (element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      animations.get(element)?.cancel();
      const animation = element.animate(frames, options);
      animations.set(element, animation);
      animation.onfinish = () => { if (animations.get(element) === animation && !pressed.has(element)) { animation.cancel(); animations.delete(element); } };
    };
    const down = (element: HTMLElement) => {
      pressed.add(element);
      animate(element, [{ scale: getComputedStyle(element).scale === "none" ? "1" : getComputedStyle(element).scale }, { scale: "0.95" }], { duration: 110, easing: "ease-out", fill: "forwards" });
    };
    const release = (element: HTMLElement, bounce = true) => {
      if (!pressed.delete(element)) return;
      const scale = Number.parseFloat(getComputedStyle(element).scale) || 0.95;
      if (bounce && element.isConnected) animate(element, scale > 0.96 ? tapFeedbackFrames(scale) : releaseFrames(scale), { duration: scale > 0.96 ? 740 : 620, easing: "linear", fill: "forwards" });
      else { animations.get(element)?.cancel(); animations.delete(element); }
    };
    const onDown = (event: PointerEvent) => { if (event.button === 0) { const element = control(event.target); if (element) down(element); } };
    const onUp = () => { for (const element of pressed) release(element); };
    const onCancel = () => { for (const element of pressed) release(element, false); };
    const onKeyDown = (event: KeyboardEvent) => { if (!event.repeat && ["Enter", " "].includes(event.key)) { const element = control(event.target); if (element) down(element); } };
    const onKeyUp = (event: KeyboardEvent) => { if (["Enter", " "].includes(event.key)) onUp(); };
    const onClick = (event: MouseEvent) => {
      const element = control(event.target);
      if (!element) return;
      queueMicrotask(() => {
        if (surface.getAttribute("data-site-motion") !== "on" || !element.isConnected || element.getAttribute("aria-pressed") !== "true" && element.getAttribute("aria-checked") !== "true") return;
        const glyph = element.querySelector<HTMLElement>("svg, .experience-toggle-dot, .motion-indicator");
        if (glyph) animate(glyph, [{ scale: "1" }, { scale: "1.18", offset: 0.4 }, { scale: "1" }], { duration: 400, easing: "ease-out" });
      });
    };

    // Only off-screen content receives reveal styling. No-JS content stays visible.
    const observed = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.setAttribute("data-entered", "true"); observer.unobserve(entry.target); }
    }, { threshold: 0 });
    const prepare = (scope: Element) => {
      const candidates = [scope, ...scope.querySelectorAll(".surface-card, .section-space, .image-reveal")];
      for (const element of candidates) {
        if (!element.matches(".surface-card, .section-space, .image-reveal") || observed.has(element)) continue;
        observed.add(element);
        if (element.getBoundingClientRect().top >= window.innerHeight) {
          element.setAttribute("data-entered", "false");
          observer.observe(element);
        }
      }
    };
    prepare(surface);
    // Debounce the MutationObserver callback so many rapid React re-renders
    // are coalesced into a single prepare() call per animation frame,
    // preventing repeated synchronous layout reads (getBoundingClientRect).
    let mutationFrame = 0;
    const pendingNodes = new Set<Element>();
    const flushMutations = () => {
      mutationFrame = 0;
      for (const node of pendingNodes) prepare(node);
      pendingNodes.clear();
    };
    const mutations = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node instanceof Element) pendingNodes.add(node);
      if (pendingNodes.size > 0 && !mutationFrame)
        mutationFrame = requestAnimationFrame(flushMutations);
    });
    mutations.observe(surface, { childList: true, subtree: true });
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      for (let element: Element | null = event.target; element && surface.contains(element); element = element.parentElement) {
        if (element.hasAttribute("data-entered")) { element.setAttribute("data-entered", "true"); observer.unobserve(element); }
      }
    };
    surface.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    surface.addEventListener("keydown", onKeyDown);
    surface.addEventListener("keyup", onKeyUp);
    surface.addEventListener("click", onClick);
    surface.addEventListener("focusin", onFocus);
    return () => {
      surface.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
      surface.removeEventListener("keydown", onKeyDown);
      surface.removeEventListener("keyup", onKeyUp);
      surface.removeEventListener("click", onClick);
      surface.removeEventListener("focusin", onFocus);
      if (mutationFrame) cancelAnimationFrame(mutationFrame);
      observer.disconnect(); mutations.disconnect();
      for (const animation of animations.values()) animation.cancel();
      for (const element of observed) element.removeAttribute("data-entered");
    };
  }, [motion]);

  return <MotionContext.Provider value={{ motion, reduced }}><div ref={root} data-site-motion={motion ? "on" : "off"}>{children}</div></MotionContext.Provider>;
}
