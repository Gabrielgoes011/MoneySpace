// ========================================
// 📱 HOOK: DETECTAR MOBILE VS DESKTOP
// ========================================
// Retorna TRUE se a tela é menor que 768px (mobile)
// Útil para renderizar componentes diferentes em mobile e desktop

import { useState, useEffect } from 'react';

// Breakpoint: telas menores que isso são consideredadas "mobile"
export const MOBILE_BP = 768;

/**
 * Hook que detecta se a tela é mobile
 *
 * Exemplo:
 *   const isMobile = useIsMobile();
 *   return isMobile ? <BottomNav /> : <Sidebar />;
 */
export function useIsMobile() {
  // Estado inicial baseado no tamanho atual da tela
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BP
  );

  useEffect(() => {
    // Função chamada sempre que a janela é redimensionada
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BP);
    };

    // Adiciona listener
    window.addEventListener('resize', handleResize);

    // Limpa listener quando componente é desmontado
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
