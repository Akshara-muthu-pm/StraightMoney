// Damped spring response, sampled by the browser's Web Animations API.
export function springResponse(progress: number) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return 1 - Math.exp(-7 * progress) * (Math.cos(13 * progress) + 7 / 13 * Math.sin(13 * progress));
}
export function releaseFrames(from = 0.95): Keyframe[] {
  return Array.from({ length: 41 }, (_, index) => {
    const offset = index / 40;
    return { offset, scale: String(from + (1 - from) * springResponse(offset)) };
  });
}

// A quick tap still completes the anticipation phase before releasing.
export function tapFeedbackFrames(from = 1): Keyframe[] {
  return [
    { offset: 0, scale: String(from) },
    ...releaseFrames().map((frame) => ({ ...frame, offset: 0.16 + Number(frame.offset) * 0.84 })),
  ];
}
