/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable React strict mode for compatibility with existing vanilla JS
  reactStrictMode: false,
  
  // Skip type checking during build (we're using existing JS files)
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Skip ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Trailing slashes for static file compatibility
  trailingSlash: false,
}

module.exports = nextConfig
