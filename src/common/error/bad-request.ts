import { HttpCode } from "../http-codes";

export class BadRequestError extends Error {
  constructor(
    public override message: string = "bad-request",
    public status: number = HttpCode.BAD_REQUEST.code
  ) {
    super(message);
  }
}
