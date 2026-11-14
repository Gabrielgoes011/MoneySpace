// Casca do app: barra superior + lateral recolhível (PC) ou barra inferior (celular).
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Chip } from '@heroui/react';
import { FiSun, FiMoon, FiLayers, FiUsers, FiChevronDown, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { usePrivacidade } from '../../context/PrivacidadeContext';
import useIsMobile from '../../hooks/useIsMobile';
import MenuNavegacao from './MenuNavegacao';
import { filtrarItens } from './navegacao';
import { lerFamiliaAtiva, limparFamiliaAtiva } from '../../services/familiaAtiva';

const classeLink = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-default'}`;

// Item da lateral; com `filhos` vira grupo expansível.
function ItemLateral({ item }) {
  const { pathname } = useLocation();
  const dentro = pathname.startsWith(item.to);
  const [aberto, setAberto] = useState(dentro);
  const Icon = item.icon;

  if (!item.filhos) {
    return <NavLink to={item.to} className={classeLink}><Icon size={18} />{item.label}</NavLink>;
  }
  return (
    <div>
      <button type="button" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-default ${dentro ? 'text-accent' : 'text-muted'}`}>
        <Icon size={18} />
        <span className="flex-1 text-left">{item.label}</span>
        <FiChevronDown size={14} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {/* Animação de altura: grid-rows 0fr -> 1fr */}
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${aberto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
        inert={!aberto}>
        <div className="overflow-hidden">
          <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-separator pl-2">
            {item.filhos.map(({ to, label, icon: FIcon }) => (
              <NavLink key={to} to={to} className={classeLink}><FIcon size={16} />{label}</NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const lerSidebar = () => {
  try { return localStorage.getItem('sidebar') !== 'fechada'; } catch { return true; }
};

export default function AppLayout() {
  const isMobile = useIsMobile();
  const { user, logout, ehMaster } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { ocultar, alternar: alternarValores } = usePrivacidade();
  const navigate = useNavigate();
  const [sidebarAberta, setSidebarAberta] = useState(lerSidebar);

  // dono do app dentro de outra família: mostra o nome dela e o aviso para voltar
  const familiaAtiva = ehMaster ? lerFamiliaAtiva() : null;
  const itens = filtrarItens(ehMaster);
  const familia = familiaAtiva?.nome || user?.familia_nome || 'Família Goes';
  const nome = user?.nome || 'Gabriel';

  const alternarSidebar = () => {
    setSidebarAberta((a) => {
      try { localStorage.setItem('sidebar', a ? 'fechada' : 'aberta'); } catch { /* sem storage */ }
      return !a;
    });
  };

  const voltarParaMinhaFamilia = () => {
    limparFamiliaAtiva();
    window.location.assign('/dashboard'); // recarrega para todas as telas buscarem os dados da própria família
  };

  const sair = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className={`flex flex-col bg-background text-foreground ${isMobile ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}>
      {/* ── Barra superior ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex shrink-0 h-[calc(3.5rem+env(safe-area-inset-top))] items-center pt-[env(safe-area-inset-top)] gap-2 border-b border-separator bg-background/90 px-3 backdrop-blur">
        <MenuNavegacao
          itens={itens} user={user} familia={familia} isDark={isDark} onTema={toggleTheme} onSair={sair}
          onToggleLateral={isMobile ? undefined : alternarSidebar} lateralAberta={sidebarAberta}
        />
        <div className="flex items-center gap-2 font-semibold"><FiLayers className="text-accent" /> MoneySpace</div>

        <div className="ml-auto flex items-center gap-2">
          <Chip variant="soft" className="hidden sm:inline-flex"><FiUsers size={12} /> {familia}</Chip>
          <Button isIconOnly variant="ghost" aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
            aria-pressed={ocultar} onPress={alternarValores}>
            {ocultar ? <FiEyeOff size={18} /> : <FiEye size={18} />}
          </Button>
          <Button isIconOnly variant="ghost" aria-label="Alternar tema" onPress={toggleTheme}>
            {isDark ? <FiSun size={18} /> : <FiMoon size={18} />}
          </Button>
          <div className="flex items-center gap-2 pl-1">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
              {nome[0]?.toUpperCase()}
            </span>
            <span className="hidden text-sm md:inline">{nome}</span>
          </div>
        </div>
      </header>

      {/* ── Aviso: dono do app vendo outra família ───────────── */}
      {familiaAtiva && (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-warning/15 px-3 py-2 text-sm">
          <span className="flex items-center gap-2"><FiEye size={14} /> Você está vendo a família <strong>{familiaAtiva.nome}</strong>. Suas ações valem para ela.</span>
          <Button size="sm" variant="secondary" onPress={voltarParaMinhaFamilia}>Voltar para a minha</Button>
        </div>
      )}

      <div className={`flex flex-1 ${isMobile ? 'min-h-0' : ''}`}>
        {/* ── Lateral (PC) ─────────────────────────────────── */}
        {/* A largura anima; o conteúdo interno mantém w-56 para não "espremer" o texto. */}
        {!isMobile && (
          <aside inert={!sidebarAberta}
            className={`sticky top-14 h-[calc(100dvh-3.5rem)] shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
              sidebarAberta ? 'w-56 border-r border-separator' : 'w-0'}`}>
            <nav className={`flex w-56 flex-col gap-1 p-3 transition-opacity duration-300 ${sidebarAberta ? 'opacity-100' : 'opacity-0'}`}>
              {itens.map((item) => <ItemLateral key={item.to} item={item} />)}
            </nav>
          </aside>
        )}

        <main className={`mx-auto w-full max-w-7xl ${isMobile ? 'min-w-0 overflow-y-auto overscroll-contain p-4' : 'p-8'}`}><Outlet /></main>
      </div>

      {/* ── Barra inferior (celular) ─────────────────────────── */}
      {isMobile && (
        <nav className="z-40 flex shrink-0 justify-around border-t border-separator bg-background/95 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur">
          {itens.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-xs ${isActive ? 'text-accent' : 'text-muted'}`}>
              <Icon size={20} />{label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
