/** @type {import('next').NextConfig} */
const nextConfig = {
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
