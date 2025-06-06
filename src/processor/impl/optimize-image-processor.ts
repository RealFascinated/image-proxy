import type { Sharp } from "sharp";
import type { ImageOptions } from "../../common/image-options";
import { Processor } from "../processor";
import sharp from "sharp";

export class OptimizeImageProcessor extends Processor {
  public canRun(options: ImageOptions) {
    return !!(options.quality !== undefined || options.format !== undefined);
  }

  public async run(options: ImageOptions, image: Sharp) {
    const metadata = await image.metadata();
    const format = options.format || metadata.format || "webp";
    const quality = options.quality || 80;

    return image.toFormat(format as keyof sharp.FormatEnum, { quality });
  }
}
