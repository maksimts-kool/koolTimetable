// Сайты, которым можно встраивать /embed во фрейм (через пробел).
// Остальные страницы, включая админку, во фрейм на чужом сайте не пускаем.
const EMBED_ORIGINS =
  process.env.EMBED_ORIGINS?.trim() || "https://maksimtsikvasvili24.thkit.ee";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/((?!embed).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
      {
        source: "/embed/:path*",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${EMBED_ORIGINS}` }],
      },
    ];
  },

  // pdf.js тянем в серверном рантайме как есть, без бандлинга
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
