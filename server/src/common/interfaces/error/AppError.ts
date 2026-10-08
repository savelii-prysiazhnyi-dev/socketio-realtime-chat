export interface AppError extends Error {
  statusCode?: number;
  details?: Record<string, unknown>;
}
