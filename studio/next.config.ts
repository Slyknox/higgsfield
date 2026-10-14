import type { NextConfig } from "next"

import { securityHeaders } from "./lib/security-headers"
import { syncModels, watchModels } from "./scripts/sync-models.mjs"

// Keep the model barrel + registry items in sync with generation/catalog/models/*.
syncModels()
if (process.env.NODE_ENV === "development") watchModels()

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          mediaBaseUrl: process.env.R2_PUBLIC_BASE_URL,
          uploadOrigins: process.env.CSP_UPLOAD_ORIGINS,
          dev: process.env.NODE_ENV === "development",
        }),
      },
    ]
  },
}

export default nextConfig
