import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind to every interface so a tablet or phone on the same Wi-Fi can
    // reach it, not just this machine.
    host: true,
    port: 5173,
  },
  build: { chunkSizeWarningLimit: 1200 },
})
