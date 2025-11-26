// Rectangle selection helper – returns an SVG path for a rectangle defined by two opposite corners
export function getRectanglePathFromPoints(start: [number, number], end: [number, number]): string {
    const [x1, y1] = start;
    const [x2, y2] = end;
    // Ensure proper ordering (top‑left to bottom‑right)
    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    return `M${left},${top} L${right},${top} L${right},${bottom} L${left},${bottom} Z`;
}
