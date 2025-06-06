import type { Sharp } from "sharp";
import { Processor } from "../processor";
import type { ImageOptions } from "../../common/image-options";

export class RoundedProcessor extends Processor {
  public canRun(options: ImageOptions) {
    return !!options.rounded;
  }

  public async run(options: ImageOptions, image: Sharp) {
    const metadata = await image.metadata();
    const width = options.width || metadata.width;
    const height = options.height || metadata.height;

    if (!width || !height) {
      throw new Error("Could not determine image dimensions");
    }

    const maxRadius = Math.min(width, height) / 2;
    const radius = (options.rounded! / 100) * maxRadius;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`;

    return image.composite([
      {
        input: Buffer.from(svg),
        blend: "dest-in",
      },
    ]);
  }
}
