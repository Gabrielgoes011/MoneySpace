// Detecta tela de celular (< 768px) e reage a redimensionamento/rotação.
import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px)';

export default function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}
