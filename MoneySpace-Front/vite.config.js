// Configuração do Vite (o "compilador" do projeto).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),       // entende React/JSX
    tailwindcss(), // ativa o Tailwind (usado pelo HeroUI)
  ],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    // O HeroUI v3 puxa uma árvore grande de dependências (react-aria,
    // react-stately, etc.). Pré-declarar aqui ajuda o esbuild a otimizar
    // de forma mais estável e evita o travamento de memória no primeiro start.
    include: ['@heroui/react', 'react', 'react-dom', 'react-router-dom', 'axios'],
  },
});
