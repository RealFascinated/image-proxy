import type Elysia from "elysia";
import { isValidHttpUrl } from "../common/utils/url";
import { getImageOptions } from "../common/image-options";
import { BadRequestError } from "../common/error/bad-request";
import sharp from "sharp";
import { processors } from "..";
import { formatBytes } from "../common/utils/utils";
import { Caches } from "@inventivetalent/loading-cache";
import { Time } from "@inventivetalent/time";

const cache = Caches.builder().expireAfterWrite(Time.minutes(10)).build();

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

    let imageBuffer: Buffer;
    // Check if the original image is cached
    if (cache.getIfPresent(baseUrl)) {
      imageBuffer = cache.getIfPresent(baseUrl) as Buffer;
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
      cache.put(baseUrl, imageBuffer);
    }

    const originalSize = imageBuffer.byteLength;

    // Convert the image to a sharp image
    let sharpImage = sharp(imageBuffer);

    // Run the processors
    for (const processor of processorsToRun) {
      sharpImage = await processor.run(options, sharpImage);
    }

    const image = await sharpImage.toBuffer();
    const processedSize = image.byteLength;

    const after = performance.now();

    // Log the size comparison
    const sizeChange = ((processedSize - originalSize) / originalSize) * 100;
    const changeType = sizeChange > 0 ? "increased" : "decreased";
    console.log(
      `[${url}] Original: ${formatBytes(
        originalSize
      )}, Processed: ${formatBytes(processedSize)} (${Math.abs(
        sizeChange
      )}% ${changeType}) in ${after - before}ms`
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
