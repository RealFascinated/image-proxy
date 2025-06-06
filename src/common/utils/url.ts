/**
 * Check if a string is a valid HTTP URL
 *
 * @param string string to check
 * @returns true if the string is a valid HTTP URL, false otherwise
 */
export function isValidHttpUrl(string: string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}
