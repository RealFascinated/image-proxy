import type { Sharp } from "sharp";
import type { ImageOptions } from "../../common/image-options";
import { Processor } from "../processor";

export class SizeProcessor extends Processor {
  public canRun(options: ImageOptions) {
    return !!(options.width && options.height);
  }

  public async run(options: ImageOptions, image: Sharp) {
    return image.resize(options.width, options.height);
  }
}
