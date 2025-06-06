import { z } from "zod";

const imageOptions = z.object({
  width: z.number().min(1).max(10000).optional(),
  height: z.number().min(1).max(10000).optional(),
  size: z.number().min(1).max(10000).optional(),
  quality: z.number().min(1).max(100).optional(),
  format: z.enum(["png", "jpeg", "webp"]).optional(),
  rounded: z.number().min(0).max(100).optional(),
});

export type ImageOptions = z.infer<typeof imageOptions>;

/**
 * Get image options from query parameters
 *
 * @param query query parameters
 * @returns image options
 */
export function getImageOptions(query: Record<string, string>) {
  const numericQuery = Object.fromEntries(
    Object.entries(query).map(([key, value]) => {
      const num = Number(value);
      return [key, isNaN(num) ? value : num];
    })
  );

  const options = imageOptions.parse(numericQuery);

  if (options.size) {
    options.width = options.size;
    options.height = options.size;
    delete options.size;
  }

  return options;
}
