import nextEnv from "@next/env"

const { loadEnvConfig } = nextEnv

// Load `.env`, `.env.local`, `.env.production`, etc. before the build reads `process.env`.
// On Vercel, secrets come from Project → Settings → Environment Variables (not from git).
loadEnvConfig(process.cwd())

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
