import { z } from "zod";
import { BadRequestError } from "./error/bad-request";

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
 * @throws BadRequestError if validation fails
 */
export function getImageOptions(query: Record<string, string>) {
  const numericQuery = Object.fromEntries(
    Object.entries(query).map(([key, value]) => {
      const num = Number(value);
      return [key, isNaN(num) ? value : num];
    })
  );

  try {
    const options = imageOptions.parse(numericQuery);

    if (options.size) {
      options.width = options.size;
      options.height = options.size;
      delete options.size;
    }

    return options;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.errors
        .map((err) => {
          const field = err.path.join(".");
          const constraints =
            err.code === "invalid_type"
              ? `Expected ${err.expected}, got ${err.received}`
              : err.message;

          return `'${field}': ${constraints}`;
        })
        .join("\n");

      throw new BadRequestError(`Invalid image options - ${formattedErrors}`);
    }
    throw error;
  }
}
