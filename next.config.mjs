const csp = [
  "default-src 'self'", "img-src 'self' data:", "style-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'", "frame-ancestors 'none'", "form-action 'self'", "base-uri 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  output: "standalone", // self-contained Node.js server for the downloadable test build
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    if (process.env.NODE_ENV === "production") base.push({ key: "Content-Security-Policy", value: csp });
    return [{ source: "/:path*", headers: base }];
  },
};
export default nextConfig;
