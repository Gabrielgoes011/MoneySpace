// Menu do topo: abre ao passar o mouse (PC) ou ao tocar (celular), com animação.
// Traz pesquisa, navegação (grupos fechados por padrão), usuário, família e tema.
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Button } from '@heroui/react';
import { FiMenu, FiSearch, FiSun, FiMoon, FiLogOut, FiUsers, FiChevronDown } from 'react-icons/fi';

const classeItem = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-default ${isActive ? 'text-accent' : ''}`;

export default function MenuNavegacao({ itens, user, familia, isDark, onTema, onSair, onToggleLateral, lateralAberta }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [grupos, setGrupos] = useState({}); // { '/cadastros': true } = expandido
  const raiz = useRef(null);
  const timer = useRef(null);
  const local = useLocation();

  // Ao abrir, os submenus sempre começam FECHADOS (o painel está invisível nesse momento).
  const abrir = () => {
    clearTimeout(timer.current);
    if (!aberto) { setGrupos({}); setBusca(''); }
    setAberto(true);
  };
  const fecharLogo = () => { clearTimeout(timer.current); setAberto(false); };
  const fecharComAtraso = () => { timer.current = setTimeout(() => setAberto(false), 200); };

  // Fecha ao navegar, com Esc ou clique fora.
  useEffect(() => { fecharLogo(); }, [local.pathname]);
  useEffect(() => {
    if (!aberto) return undefined;
    const esc = (e) => e.key === 'Escape' && fecharLogo();
    const fora = (e) => !raiz.current?.contains(e.target) && fecharLogo();
    document.addEventListener('keydown', esc);
    document.addEventListener('mousedown', fora);
    return () => {
      document.removeEventListener('keydown', esc);
      document.removeEventListener('mousedown', fora);
    };
  }, [aberto]);

  // Pesquisa: casa com o item ou com algum filho; com busca ativa, o grupo abre sozinho.
  const termo = busca.trim().toLowerCase();
  const visiveis = itens
    .map((i) => {
      const proprio = i.label.toLowerCase().includes(termo);
      const filhos = (i.filhos ?? []).filter((f) => f.label.toLowerCase().includes(termo));
      return { ...i, filhos: proprio ? i.filhos : filhos, mostrar: proprio || filhos.length > 0 };
    })
    .filter((i) => i.mostrar);

  return (
    <div ref={raiz} className="relative" onMouseEnter={abrir} onMouseLeave={fecharComAtraso}>
      {/* PC: o clique recolhe/mostra a lateral (o painel abre ao passar o mouse).
          Celular: o toque abre/fecha o painel. */}
      <Button isIconOnly variant="ghost"
        aria-label={onToggleLateral ? (lateralAberta ? 'Recolher lateral' : 'Mostrar lateral') : 'Abrir menu'}
        aria-expanded={onToggleLateral ? lateralAberta : aberto}
        onPress={() => (onToggleLateral ? (fecharLogo(), onToggleLateral()) : (aberto ? fecharLogo() : abrir()))}>
        <FiMenu size={20} />
      </Button>

      {/* Sempre montado para animar: fade + leve descida + zoom. */}
      <div inert={!aberto}
        className={`absolute left-0 top-full z-50 w-72 origin-top-left pt-1 transition-all duration-200 ease-out ${
          aberto ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'}`}>
        <div className="overflow-hidden rounded-2xl border border-separator bg-overlay shadow-2xl dark:border-white/10 dark:bg-black">
          <div className="border-b border-separator p-3 dark:border-white/10">
            <label className="flex items-center gap-2 rounded-lg border border-separator px-2.5 py-1.5 text-sm text-muted dark:border-white/10">
              <FiSearch size={14} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Pesquisar no menu..."
                aria-label="Pesquisar no menu" className="w-full bg-transparent text-foreground outline-none" />
            </label>
          </div>

          <nav className="max-h-72 overflow-auto p-2">
            {visiveis.length === 0 && <p className="p-3 text-sm text-muted">Nada encontrado.</p>}
            {visiveis.map(({ to, label, icon: Icon, filhos }) => {
              if (!filhos?.length) {
                return (
                  <NavLink key={to} to={to} className={classeItem}>
                    <Icon size={18} className="text-accent" /><span className="flex-1">{label}</span>
                  </NavLink>
                );
              }
              const expandido = termo ? true : !!grupos[to];
              return (
                <div key={to}>
                  <button type="button" aria-expanded={expandido}
                    onClick={() => setGrupos((g) => ({ ...g, [to]: !g[to] }))}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-default">
                    <Icon size={18} className="text-accent" />
                    <span className="flex-1 text-left">{label}</span>
                    <FiChevronDown size={14} className={`text-muted transition-transform duration-300 ${expandido ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    expandido ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!expandido}>
                    <div className="overflow-hidden">
                      <div className="ml-5 border-l border-separator pl-2 dark:border-white/10">
                        {filhos.map(({ to: t, label: l, icon: FIcon }) => (
                          <NavLink key={t} to={t} className={classeItem}>
                            <FIcon size={16} className="text-accent" /><span className="flex-1">{l}</span>
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-separator p-3 text-sm dark:border-white/10">
            {/* Nome e e-mail levam para "Minha conta" (dados, senha e 2FA) */}
            <NavLink to="/perfil" className="block rounded-lg p-1 hover:bg-default">
              <p className="font-semibold">{user?.nome || 'Gabriel'} <span className="text-xs font-normal text-accent">Minha conta</span></p>
              {user?.email && <p className="truncate text-xs text-muted">{user.email}</p>}
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted"><FiUsers size={12} /> {familia}</p>
            </NavLink>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onPress={onTema}>
                {isDark ? <FiSun size={14} /> : <FiMoon size={14} />} {isDark ? 'Tema claro' : 'Tema escuro'}
              </Button>
              <Button size="sm" variant="ghost" onPress={onSair}><FiLogOut size={14} /> Sair</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
