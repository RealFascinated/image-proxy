import { Elysia, ValidationError } from "elysia";
import { SizeProcessor } from "./processor/impl/image-size-processor";
import { OptimizeImageProcessor } from "./processor/impl/optimize-image-processor";
import { RoundedProcessor } from "./processor/impl/rounded-image-processor";
import { index } from "./routes";
import { proxy } from "./routes/proxy";
import sharp from "sharp";

// Configure Sharp for better performance
sharp.cache(false); // Disable internal cache since we're using our own
sharp.concurrency(8); // Limit concurrent operations
sharp.simd(true); // Enable SIMD if available

export const processors = [
  new SizeProcessor(),
  new RoundedProcessor(),
  new OptimizeImageProcessor(),
];

const app = new Elysia();

// Handle application errors
app.onError({ as: "global" }, ({ code, error }) => {
  // Handle validation errors
  if (code === "VALIDATION") {
    return (error as ValidationError).all;
  }

  // Map error codes to status codes
  const statusCodeMap: Record<string, number> = {
    INTERNAL_SERVER_ERROR: 500,
    NOT_FOUND: 404,
    PARSE: 400,
    INVALID_COOKIE_SIGNATURE: 401,
  };

  const status = "status" in error ? error.status : statusCodeMap[code] || 500;
  const errorCode = code === "UNKNOWN" ? "INTERNAL_SERVER_ERROR" : code;

  return new Response(
    JSON.stringify({
      statusCode: status,
      ...(error instanceof Error &&
        error.message !== errorCode && { message: error.message }),
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    }
  );
});

// Register routes
index(app);
proxy(app);

app.listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
