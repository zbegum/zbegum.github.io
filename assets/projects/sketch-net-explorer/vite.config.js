import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative `base` so the built app loads its assets from wherever it's
// served from — works for `username.github.io/<repo>/` project pages,
// custom domains, and root-of-site deploys alike.
export default defineConfig({
  plugins: [react()],
  base: './',
})
