import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5176,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3007',
        changeOrigin: true
      }
    }
  },
  build: {
    // 单包超过该体积才警告（three / echarts 这类 3D + 图表库天然较大，拆分后仍然可观）
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 把体积大且变动少的依赖拆成独立 chunk，改善浏览器缓存并消除超大单包告警
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          echarts: ['echarts'],
          react: ['react', 'react-dom', 'zustand', 'framer-motion'],
        },
      },
      // 抑制第三方依赖（zod v4）里因注释位置特殊、Rollup 无法解释的噪声告警
      onwarn(warning, warn) {
        if (warning.message && warning.message.includes('contains a comment')) return;
        warn(warning);
      },
    },
  },
});
