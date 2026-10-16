import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { chunkFileName, plotsPlugin } from './scripts/plots-plugin.ts';

export default defineConfig({
    // Relative base so the build works from any host or sub-path (Azure, GitHub Pages, a USB stick...).
    base: './',
    plugins: [react(), plotsPlugin()],
    // Plots import everything they need from '@atv'.
    resolve: {
        alias: [{ find: /^@atv$/, replacement: fileURLToPath(new URL('./src/api/index.ts', import.meta.url)) }],
    },
    server: { port: 8080 },
    preview: { port: 8080 },
    build: {
        target: 'es2022',
        chunkSizeWarningLimit: 2500,
        rolldownOptions: {
            output: {
                chunkFileNames: chunkFileName,
                codeSplitting: {
                    groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }],
                },
            },
        },
    },
});
