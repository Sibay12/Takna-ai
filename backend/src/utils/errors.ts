export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}
export const badRequest = (m: string, c = "bad_request") => new AppError(400, c, m);
export const unauthorized = (m = "Authentication required", c = "unauthorized") => new AppError(401, c, m);
export const forbidden = (m = "Not allowed", c = "forbidden") => new AppError(403, c, m);
export const notFound = (m = "Not found", c = "not_found") => new AppError(404, c, m);
export const gone = (m = "Expired", c = "expired") => new AppError(410, c, m);
export const unavailable = (m = "Service temporarily unavailable", c = "unavailable") => new AppError(503, c, m);
