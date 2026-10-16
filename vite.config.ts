import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // Relative base so the build works from any host or sub-path (Azure, GitHub Pages, a USB stick...).
    base: './',
    plugins: [react()],
    server: { port: 8080 },
    preview: { port: 8080 },
    build: {
        target: 'es2022',
        chunkSizeWarningLimit: 2500,
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }],
                },
            },
        },
    },
});
