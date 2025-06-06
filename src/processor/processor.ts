import type { Sharp } from "sharp";
import type { ImageOptions } from "../common/image-options";

export abstract class Processor {
  /**
   * Checks if the processor can run
   *
   * @param options image options
   * @returns true if the processor can run
   */
  public abstract canRun(options: ImageOptions): boolean;

  /**
   * Runs the processor
   *
   * @param options image options
   * @param image image to process
   * @returns processed image
   */
  public abstract run(options: ImageOptions, image: Sharp): Promise<Sharp>;
}
