import type { Sharp } from "sharp";
import type { ImageOptions } from "../../common/image-options";
import { Processor } from "../processor";

export class SizeProcessor extends Processor {
  public canRun(options: ImageOptions) {
    return !!(options.width || options.height);
  }

  public async run(options: ImageOptions, image: Sharp) {
    const metadata = await image.metadata();
    const aspectRatio = metadata.width! / metadata.height!;

    let width = options.width;
    let height = options.height;

    if (width && !height) {
      height = Math.round(width / aspectRatio);
    } else if (!width && height) {
      width = Math.round(height * aspectRatio);
    }

    return image.resize(width, height);
  }
}
