import type Elysia from "elysia";
import { isValidHttpUrl } from "../common/utils/url";
import { getImageOptions } from "../common/image-options";
import { BadRequestError } from "../common/error/bad-request";
import sharp from "sharp";
import { processors } from "..";

export function proxy(app: Elysia) {
  app.get("/*", async ({ params, query }) => {
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
      return {
        error: "No processors found for the given options",
      };
    }

    // No options were provided
    if (Object.keys(options).length === 0) {
      return {
        error: "No options provided",
      };
    }

    // Fetch the image
    const imageResponse = await fetch(baseUrl);

    // Check if the image was fetched successfully
    if (!imageResponse.ok) {
      return {
        error: "Failed to fetch image",
      };
    }

    // Check if the image is valid
    const contentType = imageResponse.headers.get("Content-Type");
    if (!contentType || !contentType.startsWith("image/")) {
      return new BadRequestError("Invalid image");
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Convert the image to a sharp image
    let sharpImage = sharp(imageBuffer);

    // Run the processors
    for (const processor of processorsToRun) {
      sharpImage = await processor.run(options, sharpImage);
    }

    const image = await sharpImage.toBuffer();

    // Extract filename from URL path
    const urlPath = parsedUrl.pathname;
    const filename = urlPath.split("/").pop()?.split(".")[0] || "image";

    // Return the image
    return new Response(image, {
      headers: {
        "Content-Disposition": `inline; filename="${filename}.${
          options.format || "webp"
        }"`,
        "Content-Type": `image/${options.format || "webp"}`,
      },
    });
  });
}
