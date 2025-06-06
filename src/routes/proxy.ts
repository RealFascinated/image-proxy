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
import request from "../common/utils/request";

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

    // Checks if the URL is valid
    if (!isValidHttpUrl(url)) {
      return new BadRequestError("Invalid URL");
    }

    // Parse the URL to handle existing query parameters
    const parsedUrl = new URL(url);

    // Get the options from our cleaned query parameters
    const options = getImageOptions(query);

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
    const cacheKey = `${url}?${JSON.stringify(options)}`;

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
    if (originalCache.getIfPresent(url)) {
      imageBuffer = originalCache.getIfPresent(url) as Buffer;
    } else {
      const imageData = await request.get<ArrayBuffer>(url, {
        returns: "arraybuffer",
        headers: {
          Accept: "image/*",
          "User-Agent": "ImageProxy/1.0",
        },
        throwOnError: true,
      });

      if (!imageData) {
        return new BadRequestError("Failed to fetch image");
      }

      // Cache the original image
      imageBuffer = Buffer.from(imageData);
      originalCache.put(url, imageBuffer);
    }

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
      `[${url}] Image: ${formatBytes(image.byteLength)} in ${formatDuration(
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
