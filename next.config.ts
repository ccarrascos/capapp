import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // No aporta valor al usuario y sí le regala a un atacante qué framework
  // corre el servidor.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Logo y avatar se suben vía Server Action; el tope real lo fija
      // /configuracion. Vercel corta cualquier body sobre 4.5 MB.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          // Directiva sola (sin bloquear scripts/estilos) — mismo efecto
          // anti-clickjacking que X-Frame-Options, como respaldo en
          // navegadores que priorizan CSP sobre el header legado.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
