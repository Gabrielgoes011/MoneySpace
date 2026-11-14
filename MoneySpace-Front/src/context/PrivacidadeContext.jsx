// ========================================
// 👁️ PRIVACIDADE: OCULTAR VALORES EM R$
// ========================================
// O olhinho ao lado do tema esconde os valores em reais das telas (ficam "R$ ••••").
// A escolha fica salva no aparelho. PDF e texto copiado (WhatsApp) continuam com o valor real,
// porque são ações explícitas do usuário.
//
// Como funciona: as telas formatam com `moedaTela` (utils/formatar.js), que lê um interruptor do módulo.
// As páginas chamam `usePrivacidade()` para refazer o desenho quando o olhinho muda.
import { createContext, useContext, useState } from 'react';
import { definirOcultarValores } from '../utils/formatar';

const PrivacidadeContext = createContext();
const CHAVE = 'ocultarValores';

const lerSalvo = () => {
  try { return localStorage.getItem(CHAVE) === 'true'; } catch { return false; }
};

export function PrivacidadeProvider({ children }) {
  const [ocultar, setOcultar] = useState(lerSalvo);

  // Ajusta o interruptor ANTES de os filhos desenharem (é o que `moedaTela` consulta).
  definirOcultarValores(ocultar);

  const alternar = () => {
    setOcultar((atual) => {
      const novo = !atual;
      try { localStorage.setItem(CHAVE, String(novo)); } catch { /* sem storage */ }
      return novo;
    });
  };

  return (
    <PrivacidadeContext.Provider value={{ ocultar, alternar }}>
      {children}
    </PrivacidadeContext.Provider>
  );
}

// Use nas páginas que mostram valores: refaz o desenho quando o olhinho muda.
export function usePrivacidade() {
  const contexto = useContext(PrivacidadeContext);
  if (!contexto) {
    throw new Error('usePrivacidade deve ser usado dentro de <PrivacidadeProvider>');
  }
  return contexto;
}
