/**
 * Format a duration in milliseconds to a human-readable string
 * @param ms Duration in milliseconds
 * @returns Formatted duration string (e.g., "1.5s", "500ms", "2m 30s")
 */
export function formatDuration(ms: number): string {
  if (ms < 0.001) {
    return `${Math.round(ms * 1000000)}ns`;
  }
  if (ms < 1) {
    return `${Math.round(ms * 1000)}µs`;
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms < 3600000) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}
