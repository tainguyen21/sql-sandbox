/**
 * Convert cost ratio (0-1) to a heatmap color.
 * 0.0-0.3: green shades, 0.3-0.7: yellow, 0.7-1.0: red
 */
export function costToColor(ratio: number): string {
  const clamped = Math.max(0, Math.min(1, ratio));

  if (clamped <= 0.3) {
    // Green range: hsl(120, 60%, 85%) → hsl(90, 60%, 75%)
    const hue = 120 - (clamped / 0.3) * 30;
    return `hsl(${hue}, 60%, ${85 - clamped * 30}%)`;
  }
  if (clamped <= 0.7) {
    // Yellow range: hsl(60, 70%, 75%) → hsl(30, 80%, 65%)
    const t = (clamped - 0.3) / 0.4;
    const hue = 60 - t * 30;
    return `hsl(${hue}, ${70 + t * 10}%, ${75 - t * 10}%)`;
  }
  // Red range: hsl(15, 85%, 60%) → hsl(0, 90%, 50%)
  const t = (clamped - 0.7) / 0.3;
  const hue = 15 - t * 15;
  return `hsl(${hue}, ${85 + t * 5}%, ${60 - t * 10}%)`;
}

/** Severity to color */
export function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'rgb(239, 68, 68)';
    case 'warning': return 'rgb(234, 179, 8)';
    default: return 'rgb(59, 130, 246)';
  }
}
