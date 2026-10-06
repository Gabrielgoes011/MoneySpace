// ========================================
// 👁️ CONTEXTO DE PRIVACIDADE
// ========================================
// Controla se valores financeiros são visíveis ou ocultos
// Útil para esconder dados quando outras pessoas estão olhando

import { createContext, useContext, useState } from 'react';

const PrivacyContext = createContext();

export function PrivacyProvider({ children }) {
  // Inicia oculto (segurança)
  const [valoresOcultos, setValoresOcultos] = useState(true);

  // Alterna visibilidade
  const togglePrivacidade = () => setValoresOcultos(!valoresOcultos);

  const value = {
    valoresOcultos,
    togglePrivacidade,
  };

  return (
    <PrivacyContext.Provider value={value}>
      {children}
    </PrivacyContext.Provider>
  );
}

/**
 * Hook para usar privacidade
 *
 * Exemplo:
 *   const { valoresOcultos } = usePrivacy();
 *   return <span>{valoresOcultos ? '●●●' : 'R$ 1.234,56'}</span>;
 */
export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy deve ser usado dentro de <PrivacyProvider>');
  }
  return context;
}
