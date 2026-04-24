import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@react-pdf/renderer", "@prisma/client", "bcryptjs"],
};

export default nextConfig;
