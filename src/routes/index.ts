import type Elysia from "elysia";

export function index(app: Elysia) {
  app.get("/", () => {
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
        name: "optimize",
        description: "Optimize the image and return a webp image",
        required: false,
      },
    ];

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
                color: #e2e8f0;
                background-color: #1a1a1a;
            }
            h1 { color: #a855f7; }
            h2 { color: #c084fc; margin-top: 2rem; }
            code {
                background: #2a2a2a;
                padding: 0.2rem 0.4rem;
                border-radius: 4px;
                font-family: monospace;
                color: #f1f5f9;
            }
            .example {
                background: #2a2a2a;
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
                background: #2a2a2a;
                padding: 1rem;
                border-radius: 8px;
                margin: 1rem 0;
            }
            .processor h3 {
                margin-top: 0;
                color: #c084fc;
            }
        </style>
    </head>
    <body>
        <h1>Image Proxy Service</h1>
        <p>This service allows you to process images on-the-fly with various options.</p>
    
        <h2>Usage</h2>
        <p>Example usage:</p>
        <div class="example">
            <code>GET /{encoded_image_url}?optimize=true</code>
        </div>
        <p>
          This will optimize the image and return a webp image. The image URL must be URL-encoded and not contain any query parameters.
        </p>
    
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
    </body>
    </html>`,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  });
}
