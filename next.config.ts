import type { NextConfig } from "next";
import os from "os";

// Automatically get all local IPv4 addresses to allow Next.js to serve them
const getLocalIPs = () => {
  const interfaces = os.networkInterfaces();
  const ips = ['localhost'];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
};

const nextConfig: NextConfig = {
  allowedDevOrigins: getLocalIPs(),
  /* config options here */
};

export default nextConfig;
