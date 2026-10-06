import { AppError } from "./app-error.js";

export const assertOwnership = (
  resourceUserId: string,
  currentUserId: string,
) => {
  if (resourceUserId !== currentUserId) {
    throw new AppError(
      "You do not have permission to access this resource",
      403,
      "FORBIDDEN",
    );
  }
};