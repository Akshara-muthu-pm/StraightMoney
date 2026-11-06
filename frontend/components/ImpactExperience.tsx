"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useSiteMotion } from "./SiteMotion";
import { springResponse } from "@/lib/spring-motion";
import { impactShapes, interpolatePoints, shapePath, type Point } from "@/lib/impact-motion";

const moments = [
  { label: "Give", title: "Fund a clear plan", text: "Choose a project and review its published budget before giving.", image: "/images/community-volunteers.jpg", alt: "Volunteers working together to carry donated supplies" },
  { label: "Follow", title: "See the progress", text: "Track delivery evidence, reviews, and payment status.", image: "/images/hero-planning.jpg", alt: "People planning work together around a table" },
  { label: "Grow", title: "See the outcome", text: "Explore what the community received and how funds were used.", image: "/images/hero-growing.jpg", alt: "Gardening tools and soil ready for new plants" },
];
export default function ImpactExperience() {
  const [active, setActive] = useState(0);
  const { motion } = useSiteMotion();
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const figureRef = useRef<HTMLElement>(null);
  const playing = motion && !paused && !hovered && !focused;
  useEffect(() => {
    if (!playing) return;
    // Use the Page Visibility API to fully stop the timer (not just skip the
    // callback) when the tab is hidden, saving CPU wakeups.
    let timerId: number | null = null;

    const advance = () => {
      const bounds = figureRef.current?.getBoundingClientRect();
      if (bounds && bounds.bottom > 0 && bounds.top < window.innerHeight)
        setActive((value) => (value + 1) % moments.length);
    };

    const start = () => {
      if (timerId === null) timerId = window.setInterval(advance, 6000);
    };
    const stop = () => {
      if (timerId !== null) { window.clearInterval(timerId); timerId = null; }
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [playing, active]);
  const pathRef = useRef<SVGPathElement>(null);
  const currentPoints = useRef<readonly Point[]>(impactShapes[0]);

  useEffect(() => {
    const target = impactShapes[active];
    const from = currentPoints.current;
    let frame = 0;
    if (!motion) {
      currentPoints.current = target;
      pathRef.current?.setAttribute("d", shapePath(target));
      return;
    }
    const start = performance.now();
    const animate = (time: number) => {
      const progress = Math.min(1, (time - start) / 800);
      const points = interpolatePoints(from, target, springResponse(progress), false);
      currentPoints.current = points;
      pathRef.current?.setAttribute("d", shapePath(points));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active, motion]);

  return <figure ref={figureRef} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={(event) => setFocused(!(event.target as Element).closest("[data-carousel-playback]"))} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }} className="impact-experience" data-motion={motion ? "on" : "off"} data-moment={active}>
    <div className="experience-photo-stack">{moments.map((moment, index) => <div key={moment.label} className="experience-photo-layer" data-active={index === active} aria-hidden={index !== active}><Image src={moment.image} alt={index === active ? moment.alt : ""} fill sizes="(max-width: 1024px) 100vw, 55vw" preload={index === 0} className="object-cover" /></div>)}</div>
    <div className="experience-shade" aria-hidden="true" />
    <div className="experience-vector" aria-hidden="true"><svg viewBox="0 0 100 100"><path ref={pathRef} d={shapePath(impactShapes[0])} /></svg></div>
    {motion && <button type="button" data-carousel-playback className="slideshow-playback" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Play automatic slideshow" : "Pause automatic slideshow"} title={paused ? "Play slideshow" : "Pause slideshow"}><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">{paused ? <path d="M8 4v16l12-8Z" /> : <path d="M6 4h4v16H6zm8 0h4v16h-4z" />}</svg></button>}
    <figcaption className="experience-caption">
      <p className="eyebrow">See the impact, one step at a time</p>
      <div className="experience-toggles" role="group" aria-label="Explore giving and community impact">{moments.map((moment, index) => <button key={moment.label} type="button" aria-pressed={active === index} aria-controls="experience-story" onClick={() => setActive(index)}><span className="experience-toggle-dot" aria-hidden="true" />{moment.label}</button>)}</div>
      <div id="experience-story" aria-live={playing ? "off" : "polite"} aria-atomic="true"><h2 className="display-heading mt-4 text-xl sm:text-2xl">{moments[active].title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{moments[active].text}</p></div>
    </figcaption>
  </figure>;
}
