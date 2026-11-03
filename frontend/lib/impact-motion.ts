export type Point = readonly [number, number];

// Identical point counts let the same vector continuously morph between states.
export const impactShapes: readonly (readonly Point[])[] = [
  [[50, 24], [64, 12], [82, 17], [91, 33], [87, 51], [72, 68], [50, 88], [28, 68], [13, 51], [9, 33], [18, 17], [36, 12]],
  [[50, 10], [64, 17], [78, 22], [85, 27], [83, 47], [74, 65], [50, 89], [26, 65], [17, 47], [15, 27], [22, 22], [36, 17]],
  Array.from({ length: 12 }, (_, index): Point => {
    const angle = index * Math.PI / 6 - Math.PI / 2;
    const radius = index % 2 === 0 ? 40 : 24;
    return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius];
  }),
];

export function interpolatePoints(from: readonly Point[], to: readonly Point[], progress: number, clamp = true): Point[] {
  const amount = clamp ? Math.max(0, Math.min(1, progress)) : progress;
  return from.map(([x, y], index) => [x + (to[index][0] - x) * amount, y + (to[index][1] - y) * amount]);
}

// Closed Catmull–Rom spline, expressed as cubic Bézier segments for SVG.
export function shapePath(points: readonly Point[]) {
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 0; index < points.length; index++) {
    const a = points[(index - 1 + points.length) % points.length];
    const b = points[index];
    const c = points[(index + 1) % points.length];
    const d = points[(index + 2) % points.length];
    path += ` C ${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6}, ${c[0] - (d[0] - b[0]) / 6} ${c[1] - (d[1] - b[1]) / 6}, ${c[0]} ${c[1]}`;
  }
  return `${path} Z`;
}
