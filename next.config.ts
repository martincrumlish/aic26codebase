import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security/headers";

const nextConfig: NextConfig = {
  async headers() {
    return securityHeaders();
  },
};

export default nextConfig;
