import { AppError } from "./app-error.js";

export const requireOwnership = <T extends { userId: string }>(
  resource: T | null,
  currentUserId: string,
): T => {
  if (!resource) {
    throw new AppError(
      "Resource not found",
      404,
      "RESOURCE_NOT_FOUND",
    );
  }

  if (resource.userId !== currentUserId) {
    throw new AppError(
      "You do not have permission to access this resource",
      403,
      "FORBIDDEN",
    );
  }

  return resource;
};