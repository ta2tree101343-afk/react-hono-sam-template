import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		// Router プラグインは react プラグインより先に配置する必要がある
		tanstackRouter({ target: "react", autoCodeSplitting: true }),
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 5173,
		proxy: {
			// Hono を /api/v1 にマウントしているため、パス書き換えは行わない
			// dev の呼び出し /api/v1/* → api の /api/v1/* に透過
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
})
