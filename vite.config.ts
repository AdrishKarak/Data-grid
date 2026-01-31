import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // 1. Tailwind plugin stays at the top level
    tailwindcss(),
    react({
      babel: {
        // 2. Only Babel-specific plugins go here
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
})