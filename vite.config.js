import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';

export default defineConfig({
  plugins: [
    copy({
      targets: [
        { src: 'module.json', dest: 'dist' },
      ],
      hook: 'writeBundle',
    }),
  ],
  build: {
    // lib: {
    //   entry: resolve(fileURLToPath(new URL('.', import.meta.url)), 'scripts/mallindor-rest.mjs'),
    //   name: 'MallindorRest',
    //   fileName: 'mallindor-rest',
    //   formats: ['es']
    // },
    outDir: 'dist',
    rollupOptions: {
      // Ensure we bundle everything into a single file
      input: 'scripts/mallindor-rest.mjs',
      output: {
        entryFileNames: 'scripts/index.mjs',
        format: 'es',
      },
      // Don't treat any imports as external - bundle everything
      external: []
    },
    // Minify for production
    minify: 'terser',
    // Generate source maps for debugging
    sourcemap: false
  },
  // Ensure we can import .mjs files
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.json']
  }
});
