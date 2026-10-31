import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// BACKEND_URL points at the FastAPI service. In compose it is http://backend:8000.
const backend = process.env.BACKEND_URL ?? 'http://localhost:8000'

export default defineConfig({
	plugins: [vue()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		proxy: { '/api': backend },
	},
})
