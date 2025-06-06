/**
 * Check if a string is a valid HTTP URL
 *
 * @param string string to check
 * @returns true if the string is a valid HTTP URL, false otherwise
 */
export function isValidHttpUrl(string: string) {
  let url;

  try {
    // If the string starts with http:// or https://, use it directly
    if (string.startsWith("http://") || string.startsWith("https://")) {
      url = new URL(string);
    } else {
      // Otherwise, try to parse it as a relative URL
      url = new URL(string, "http://localhost");
    }
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}
