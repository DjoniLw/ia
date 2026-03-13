/** @type {import('next').NextConfig} */
const nextConfig = {
  // Subdomain routing for multi-tenant:
  // clinicaana.localhost → resolved by middleware
  // In production: clinicaana.aesthera.com.br

  // Enable standalone output for lean Docker images
  output: 'standalone',
}

export default nextConfig
