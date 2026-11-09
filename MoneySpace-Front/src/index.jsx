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
