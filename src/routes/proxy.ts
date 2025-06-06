import type Elysia from "elysia";
import { isValidHttpUrl } from "../common/utils/url";
import { getImageOptions } from "../common/image-options";
import { BadRequestError } from "../common/error/bad-request";
import sharp from "sharp";
import { processors } from "..";
import { formatBytes } from "../common/utils/utils";
import { formatDuration } from "../common/utils/time";
import { Caches } from "@inventivetalent/loading-cache";
import { Time } from "@inventivetalent/time";

// Configure Sharp for better performance
sharp.cache(false); // Disable internal cache since we're using our own
sharp.concurrency(4); // Limit concurrent operations
sharp.simd(true); // Enable SIMD if available

// Cache for both original and processed images
const originalCache = Caches.builder()
  .expireAfterWrite(Time.minutes(10))
  .build();
const processedCache = Caches.builder()
  .expireAfterWrite(Time.minutes(10))
  .build();

export function proxy(app: Elysia) {
  app.get("/*", async ({ params, query }) => {
    const before = performance.now();
    const url = decodeURIComponent(params["*"]);

    // Extract the actual image URL and clean up any query parameters
    const imageUrl = url.split("?")[0] || url;

    // Clean up the query parameters
    const cleanQuery = Object.fromEntries(
      Object.entries(query).map(([key, value]) => {
        // If the value contains a question mark, take only the part after it
        const cleanValue = value.includes("?")
          ? value.split("?")[1]?.split("=")[1] || ""
          : value;
        return [key, cleanValue];
      })
    ) as Record<string, string>;

    // Checks if the URL is valid
    if (!isValidHttpUrl(imageUrl)) {
      return new BadRequestError("Invalid URL");
    }

    // Parse the URL to handle existing query parameters
    const parsedUrl = new URL(imageUrl);

    // Get the base URL without query parameters
    const baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;

    // Get the options from our cleaned query parameters
    const options = getImageOptions(cleanQuery);

    // Checks if any processors can run
    const processorsToRun = processors.filter((processor) =>
      processor.canRun(options)
    );

    if (processorsToRun.length === 0) {
      return new BadRequestError("No processors found for the given options");
    }

    // No options were provided
    if (Object.keys(options).length === 0) {
      return new BadRequestError("No options provided");
    }

    // Create a cache key for the processed image
    const cacheKey = `${baseUrl}?${JSON.stringify(options)}`;

    // Check if we have a cached processed image
    if (processedCache.getIfPresent(cacheKey)) {
      const cachedImage = processedCache.getIfPresent(cacheKey) as Buffer;
      const after = performance.now();
      console.log(
        `[${url}] Original: ${formatBytes(
          cachedImage.byteLength
        )} in ${formatDuration(after - before)} (cached)`
      );
      return new Response(cachedImage, {
        headers: {
          "Content-Type": `image/${options.optimize ? "webp" : "png"}`,
          "Cache-Control": "public, max-age=3600, immutable",
        },
      });
    }

    let imageBuffer: Buffer;
    // Check if the original image is cached
    if (originalCache.getIfPresent(baseUrl)) {
      imageBuffer = originalCache.getIfPresent(baseUrl) as Buffer;
    } else {
      const imageResponse = await fetch(baseUrl);

      // Check if the image was fetched successfully
      if (!imageResponse.ok) {
        return new BadRequestError("Failed to fetch image");
      }

      // Check if the image is valid
      const contentType = imageResponse.headers.get("Content-Type");
      if (!contentType || !contentType.startsWith("image/")) {
        return new BadRequestError("Invalid image");
      }

      // Cache the original image
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      originalCache.put(baseUrl, imageBuffer);
    }

    const originalSize = imageBuffer.byteLength;

    // Convert the image to a sharp image with optimized settings
    let sharpImage = sharp(imageBuffer, {
      failOn: "none", // Don't fail on corrupt images
      limitInputPixels: 100000000, // Limit input size to prevent memory issues
    });

    // Run the processors
    for (const processor of processorsToRun) {
      sharpImage = await processor.run(options, sharpImage);
    }

    const image = await sharpImage.toBuffer();
    const after = performance.now();

    // Cache the processed image
    processedCache.put(cacheKey, image);

    // Log the size comparison
    const timeDiff = after - before;
    console.log(
      `[${url}] Original: ${formatBytes(originalSize)} in ${formatDuration(
        timeDiff
      )}`
    );

    // Extract filename from URL path
    const urlPath = parsedUrl.pathname;
    const filename = urlPath.split("/").pop()?.split(".")[0] || "image";
    const originalExtension = urlPath.split(".").pop()?.toLowerCase() || "png";
    const extension = options.optimize ? "webp" : originalExtension;

    // Return the image
    return new Response(image, {
      headers: {
        "Content-Disposition": `inline; filename="${filename}.${extension}"`,
        "Content-Type": `image/${extension}`,
        "Cache-Control": "public, max-age=3600, immutable", // 1 hour
      },
    });
  });
}
