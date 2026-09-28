import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (only traced files are copied).
  output: "standalone",
  poweredByHeader: false,
  // Argon2 loads its platform binary (e.g. @node-rs/argon2-linux-x64-gnu) with a computed
  // require that file tracing can't follow, so include it explicitly.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@node-rs/argon2*/**/*"],
  },
};

export default nextConfig;
