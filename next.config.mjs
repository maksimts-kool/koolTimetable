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
        source: "/embed",
        headers: [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${EMBED_ORIGINS}` }],
      },
    ];
  },

  // pdf.js тянем в серверном рантайме как есть, без бандлинга
  serverExternalPackages: ["pdfjs-dist"],

  // pdf.js грузит воркер через import(/* webpackIgnore: true */ …), поэтому
  // трассировщик Next его не видит и на Vercel файл не попадает в бандл
  // («Setting up fake worker failed»). Кладём его в функцию явно.
  outputFileTracingIncludes: {
    "/api/upload": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
