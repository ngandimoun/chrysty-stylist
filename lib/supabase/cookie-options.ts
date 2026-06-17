type CookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none" | boolean;
  secure?: boolean;
};

export function withSharedCookieDomain(options?: CookieOptions) {
  if (process.env.NODE_ENV !== "production") return options;

  return {
    ...options,
    domain: ".chrysty.dev",
  };
}
