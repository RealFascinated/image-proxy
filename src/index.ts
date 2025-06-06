import { Elysia } from "elysia";
import { getImageOptions } from "./common/image-options";
import { isValidHttpUrl } from "./common/utils/url";
import sharp from "sharp";
import { SizeProcessor } from "./processor/impl/image-size-processor";
import { RoundedProcessor } from "./processor/impl/rounded-image-processor";
import { OptimizeImageProcessor } from "./processor/impl/optimize-image-processor";
import { formatBytes } from "./common/utils/utils";

const processors = [
  new SizeProcessor(),
  new RoundedProcessor(),
  new OptimizeImageProcessor(),
];

const app = new Elysia()
  .get("/", () => "Image Proxy")
  .get("/*", async ({ params, query }) => {
    const url = decodeURIComponent(params["*"]);
    const options = getImageOptions(query);

    // Checks if the URL is valid
    if (!isValidHttpUrl(url)) {
      return {
        error: "Invalid URL",
      };
    }

    // Checks if any processors can run
    const processorsToRun = processors.filter((processor) =>
      processor.canRun(options)
    );
    if (processorsToRun.length === 0) {
      return {
        error: "No processors found",
      };
    }

    // No options were provided
    if (Object.keys(options).length === 0) {
      return {
        error: "No options provided",
      };
    }

    // Fetch the image
    console.log(`Fetching image from ${url}...`);
    const imageResponse = await fetch(url);
    const imageBuffer = await imageResponse.arrayBuffer();
    console.log(
      `Image from ${url} fetched successfully, size: ${formatBytes(
        imageBuffer.byteLength
      )}`
    );

    // Convert the image to a sharp image
    let sharpImage = sharp(imageBuffer);

    // Run the processors
    for (const processor of processors) {
      sharpImage = await processor.run(options, sharpImage);
    }

    const image = await sharpImage.toBuffer();
    console.log(
      `Image processed successfully, new size: ${formatBytes(
        image.byteLength
      )}, original size: ${formatBytes(imageBuffer.byteLength)}`
    );

    // Extract filename from URL path
    const urlPath = new URL(url).pathname;
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
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
