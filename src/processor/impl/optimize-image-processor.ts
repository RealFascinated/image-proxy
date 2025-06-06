import type { Sharp } from "sharp";
import type { ImageOptions } from "../../common/image-options";
import { Processor } from "../processor";

export class OptimizeImageProcessor extends Processor {
  public canRun(options: ImageOptions) {
    return !!(options.optimize !== undefined);
  }

  public async run(options: ImageOptions, image: Sharp) {
    return image.webp({ quality: 80 });
  }
}
