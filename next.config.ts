import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  // Next's dev-only corner badge covers the account menu and chat's Send
  // button. Build errors still show Next's full-screen overlay without it.
  devIndicators: false,
  async headers() {
    return securityHeaders();
  },
};

export default nextConfig;
