// ========================================
// CADASTRO DE USUÁRIOS
// ========================================
// Lista os usuários da família (tabela `usuario`): nome, e-mail e se o 2FA
// está ativo. Dados mockados por enquanto (src/mocks).

import { Card, Chip, Button, Avatar } from '@heroui/react';
import { FiPlus, FiShield } from 'react-icons/fi';
import { usuarios } from '../../mocks/dadosFinanceiros';

// Iniciais para o fallback do avatar (ex.: "Gabriel Goes" -> "GG").
function iniciais(nome = '') {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function Usuarios() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      {/* ── Cabeçalho ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate">Usuários</h1>
          <p className="text-sm text-foreground-500">Quem tem acesso à sua família</p>
        </div>
        <Button color="primary" aria-label="Adicionar usuário" className="shrink-0">
          <FiPlus size={18} />
          <span className="hidden sm:inline">Convidar</span>
        </Button>
      </div>

      {/* ── Lista ──────────────────────────────────────────────── */}
      <Card>
        <Card.Content className="divide-y divide-black/5 dark:divide-white/5 p-0">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-4">
              <Avatar size="md" className="shrink-0">
                <Avatar.Fallback color="accent">{iniciais(u.nome)}</Avatar.Fallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.nome}</p>
                <p className="text-xs text-foreground-500 truncate">{u.email}</p>
              </div>

              {u.mfa_ativo && (
                <Chip size="sm" variant="flat" color="success" startContent={<FiShield size={14} />}>
                  2FA
                </Chip>
              )}
            </div>
          ))}
        </Card.Content>
      </Card>
    </div>
  );
}

export default Usuarios;
