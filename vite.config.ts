import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Hosted previews serve the dev server behind an external hostname.
    allowedHosts: process.env.VITE_ALLOW_ALL_HOSTS === 'true' ? true : undefined,
  },
  test: {
    environment: 'node',
  },
})
