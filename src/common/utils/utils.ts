/**
 * Formats bytes to a human readable format
 *
 * @param bytes bytes to format
 * @returns formatted bytes
 */
export function formatBytes(bytes: number) {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
}
