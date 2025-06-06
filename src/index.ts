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
  .get("/", ({ request }) => {
    // Get the host from the request
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = request.headers.get("x-forwarded-proto") || "http";

    // Generate options documentation from the schema
    const optionsDocs = [
      {
        name: "width",
        description: "Resize image width (1-10000 pixels)",
        required: false,
      },
      {
        name: "height",
        description: "Resize image height (1-10000 pixels)",
        required: false,
      },
      {
        name: "size",
        description:
          "Resize both width and height to the same value (1-10000 pixels)",
        required: false,
      },
      {
        name: "quality",
        description: "Image quality (1-100)",
        required: false,
      },
      {
        name: "format",
        description: "Output format (png, jpeg, webp)",
        required: false,
      },
      {
        name: "rounded",
        description: "Add rounded corners (0-100 percentage of max radius)",
        required: false,
      },
    ];

    // Generate processor documentation
    const processorDocs = processors.map((processor) => {
      const name = processor.constructor.name.replace("Processor", "");
      const options = Object.keys(processor.canRun({}));
      return {
        name,
        options,
      };
    });

    // Generate example URL with all options
    const exampleUrl = "https://cdn.fascinated.cc/eUyubC.webp";
    const exampleOptions = {
      width: 800,
      height: 600,
      quality: 80,
      format: "webp",
      rounded: 20,
    };
    const exampleQueryString = Object.entries(exampleOptions)
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    const exampleUrlEncoded = encodeURIComponent(exampleUrl);
    const exampleFullUrl = `${protocol}://${host}/${exampleUrlEncoded}?${exampleQueryString}`;

    return new Response(
      `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Proxy Service</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }
        h1 { color: #2563eb; }
        h2 { color: #1e40af; margin-top: 2rem; }
        code {
            background: #f1f5f9;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: monospace;
        }
        .example {
            background: #f8fafc;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            overflow-x: auto;
        }
        .option {
            margin-bottom: 0.5rem;
        }
        .option code {
            font-weight: 500;
        }
        .processor {
            background: #f1f5f9;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }
        .processor h3 {
            margin-top: 0;
            color: #1e40af;
        }
    </style>
</head>
<body>
    <h1>Image Proxy Service</h1>
    <p>This service allows you to process images on-the-fly with various options.</p>

    <h2>Usage</h2>
    <p>Make a GET request to the following endpoint:</p>
    <div class="example">
        <code>GET /{encoded_image_url}?options</code>
    </div>

    <h2>Available Options</h2>
    <div class="options">
        ${optionsDocs
          .map(
            (option) => `
        <div class="option">
            <code>${option.name}</code> - ${option.description}
            ${
              option.required
                ? '<span style="color: #dc2626">(required)</span>'
                : ""
            }
        </div>`
          )
          .join("")}
    </div>

    <h2>Available Processors</h2>
    ${processorDocs
      .map(
        (processor) => `
    <div class="processor">
        <h3>${processor.name}</h3>
        <p>This processor handles the following options:</p>
        <ul>
            ${processor.options
              .map((option) => `<li><code>${option}</code></li>`)
              .join("")}
        </ul>
    </div>`
      )
      .join("")}

    <h2>Example</h2>
    <div class="example">
        <code>${exampleFullUrl}</code>
    </div>

    <h2>Notes</h2>
    <ul>
        <li>The image URL must be URL-encoded</li>
        <li>At least one processing option must be provided</li>
        <li>Supported input formats: JPEG, PNG, WebP, GIF</li>
        <li>All numeric options are validated against their min/max values</li>
    </ul>
</body>
</html>`,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  })
  .get("/*", async ({ params, query }) => {
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
      return {
        error: "Invalid URL",
      };
    }

    try {
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
        return {
          error: "Invalid image",
        };
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      // Convert the image to a sharp image
      let sharpImage = sharp(imageBuffer);

      // Run the processors
      for (const processor of processors) {
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
    } catch (error) {
      return {
        error: "Invalid URL format",
      };
    }
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
