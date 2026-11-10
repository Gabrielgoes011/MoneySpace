// ========================================
// 🚀 PONTO DE ENTRADA DO REACT
// ========================================
// Este arquivo inicia a aplicação React
// Ele renderiza o App dentro da div#root do index.html

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Cria a raiz React e renderiza o App
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA: registra o service worker só em produção (em dev atrapalharia o hot reload).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sem SW: segue como site normal */ });
  });
}
