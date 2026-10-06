declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };

      validatedQuery?: unknown;
      validatedParams?: unknown;
    }
  }
}

export {};
