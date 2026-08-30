/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf.js тянем в серверном рантайме как есть, без бандлинга
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
