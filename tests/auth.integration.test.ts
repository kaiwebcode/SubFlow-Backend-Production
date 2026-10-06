import { afterAll, beforeAll, describe, expect, it } from "vitest";

const API_BASE_URL =
  process.env.AUTH_TEST_API_URL ??
  "http://localhost:8000/api/v1";

const uniqueEmail = `auth.integration.${Date.now()}@example.com`;

let accessToken = "";
let refreshToken = "";

let previousRefreshToken = "";
let rotatedRefreshToken = "";

let verificationToken = "";

async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<{
  status: number;
  body: any;
}> {
  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    },
  );

  let body: any = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    status: response.status,
    body,
  };
}

describe("Auth API integration", () => {
  beforeAll(async () => {
    const health = await apiRequest("/health");

    expect(health.status).toBe(200);
    expect(health.body?.success).toBe(true);
  });

  afterAll(() => {
    accessToken = "";
    refreshToken = "";
    previousRefreshToken = "";
    rotatedRefreshToken = "";
    verificationToken = "";
  });

  it("registers a new user", async () => {
    const response = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Auth Integration Test",
        email: uniqueEmail,
        password: "TestPassword123!",
      }),
    });

    expect(response.status).toBe(201);
    expect(response.body?.success).toBe(true);

    expect(response.body?.data?.user?.email).toBe(
      uniqueEmail,
    );

    expect(response.body?.data?.accessToken).toEqual(
      expect.any(String),
    );

    expect(response.body?.data?.refreshToken).toEqual(
      expect.any(String),
    );

    accessToken =
      response.body.data.accessToken;

    refreshToken =
      response.body.data.refreshToken;

    verificationToken =
      response.body.data.verificationToken ?? "";
  });

  it("rejects duplicate registration", async () => {
    const response = await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Auth Integration Test",
        email: uniqueEmail,
        password: "TestPassword123!",
      }),
    });

    expect(response.status).toBeGreaterThanOrEqual(
      400,
    );

    expect(response.body?.success).toBe(false);
  });

  it("logs in with valid credentials", async () => {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: uniqueEmail,
        password: "TestPassword123!",
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);

    expect(response.body?.data?.accessToken).toEqual(
      expect.any(String),
    );

    expect(response.body?.data?.refreshToken).toEqual(
      expect.any(String),
    );

    accessToken =
      response.body.data.accessToken;

    refreshToken =
      response.body.data.refreshToken;
  });

  it("rejects invalid login credentials", async () => {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: uniqueEmail,
        password: "WrongPassword123!",
      }),
    });

    expect(response.status).toBe(401);
    expect(response.body?.success).toBe(false);
  });

  it("refreshes and rotates the refresh token", async () => {
    previousRefreshToken = refreshToken;

    const response = await apiRequest("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refreshToken: previousRefreshToken,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);

    expect(response.body?.data?.accessToken).toEqual(
      expect.any(String),
    );

    expect(response.body?.data?.refreshToken).toEqual(
      expect.any(String),
    );

    accessToken =
      response.body.data.accessToken;

    rotatedRefreshToken =
      response.body.data.refreshToken;

    expect(rotatedRefreshToken).not.toBe(
      previousRefreshToken,
    );

    refreshToken = rotatedRefreshToken;
  });

  it("detects reuse of the previous refresh token", async () => {
    const response = await apiRequest("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refreshToken: previousRefreshToken,
      }),
    });

    expect(response.status).toBe(401);
    expect(response.body?.success).toBe(false);

    expect(response.body?.error?.code).toBe(
      "REFRESH_TOKEN_REUSED",
    );
  });

  it("rejects the rotated token after the family was revoked", async () => {
    const response = await apiRequest("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({
        refreshToken: rotatedRefreshToken,
      }),
    });

    expect(response.status).toBe(401);
    expect(response.body?.success).toBe(false);
  });

  it("verifies the email with the registration token", async () => {
    if (!verificationToken) {
      return;
    }

    const response = await apiRequest(
      "/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({
          token: verificationToken,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
  });

  it("rejects reuse of the email verification token", async () => {
    if (!verificationToken) {
      return;
    }

    const response = await apiRequest(
      "/auth/verify-email",
      {
        method: "POST",
        body: JSON.stringify({
          token: verificationToken,
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(response.body?.success).toBe(false);

    expect(response.body?.error?.code).toBe(
      "VERIFICATION_TOKEN_ALREADY_USED",
    );
  });

  it("returns a generic forgot-password response", async () => {
    const response = await apiRequest(
      "/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({
          email: uniqueEmail,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);

    expect(response.body?.data?.message).toBe(
      "If an account with that email exists, a password reset link has been generated.",
    );
  });

  it("returns the same forgot-password response for an unknown email", async () => {
    const response = await apiRequest(
      "/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({
          email: `unknown.${Date.now()}@example.com`,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);

    expect(response.body?.data?.message).toBe(
      "If an account with that email exists, a password reset link has been generated.",
    );
  });

  it("rejects an unauthenticated protected request", async () => {
    const response = await apiRequest(
      "/subscriptions",
    );

    expect(response.status).toBe(401);
    expect(response.body?.success).toBe(false);
  });

  it("accepts an authenticated protected request", async () => {
    /*
     * The refresh-family reuse test intentionally
     * revokes the entire family.
     *
     * Login again to obtain a fresh valid session.
     */

    const loginResponse = await apiRequest(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email: uniqueEmail,
          password: "TestPassword123!",
        }),
      },
    );

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body?.success).toBe(true);

    accessToken =
      loginResponse.body.data.accessToken;

    refreshToken =
      loginResponse.body.data.refreshToken;

    const response = await apiRequest(
      "/subscriptions?page=1&limit=20",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    expect([200, 304]).toContain(
      response.status,
    );
  });

  it("logs out successfully", async () => {
    const response = await apiRequest(
      "/auth/logout",
      {
        method: "POST",
        body: JSON.stringify({
          refreshToken,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.body?.success).toBe(true);
  });

  it("rejects refresh after logout", async () => {
    const response = await apiRequest(
      "/auth/refresh",
      {
        method: "POST",
        body: JSON.stringify({
          refreshToken,
        }),
      },
    );

    expect(response.status).toBe(401);
    expect(response.body?.success).toBe(false);
  });
});
