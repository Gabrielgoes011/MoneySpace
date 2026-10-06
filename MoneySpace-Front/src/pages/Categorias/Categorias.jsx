// ========================================
// CATEGORIAS
// ========================================
// Lista as categorias (tabela `categoria`), separando receitas e despesas.
// Mostra a regra híbrida do banco: categorias do sistema (padrao_sistema=true)
// não podem ser editadas; as da família podem.
// Dados mockados por enquanto (src/mocks).

import { Card, Chip, Button } from '@heroui/react';
import { FiPlus, FiLock } from 'react-icons/fi';
import { categorias } from '../../mocks/dadosFinanceiros';

function GrupoCategorias({ titulo, descricao, itens, corTitulo }) {
  return (
    <Card>
      <Card.Header>
        <Card.Title className={corTitulo}>{titulo}</Card.Title>
        <Card.Description>{descricao}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-wrap gap-2">
        {itens.length === 0 && (
          <p className="text-sm text-foreground-500">Nenhuma categoria aqui ainda.</p>
        )}
        {itens.map((cat) => (
          <Chip
            key={cat.id}
            variant="flat"
            startContent={
              <span className="size-3 rounded-full" style={{ backgroundColor: cat.cor }} />
            }
            endContent={cat.padrao_sistema ? <FiLock size={12} /> : null}
          >
            {cat.nome}
          </Chip>
        ))}
      </Card.Content>
    </Card>
  );
}

function Categorias() {
  const receitas = categorias.filter((c) => c.tipo === 'RECEITA');
  const despesas = categorias.filter((c) => c.tipo === 'DESPESA');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Cabeçalho ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-foreground-500">
            Classifique suas receitas e despesas
          </p>
        </div>
        <Button color="primary" startContent={<FiPlus size={18} />}>
          Nova categoria
        </Button>
      </div>

      <GrupoCategorias
        titulo="Receitas"
        descricao="De onde vem o dinheiro"
        itens={receitas}
        corTitulo="text-success"
      />

      <GrupoCategorias
        titulo="Despesas"
        descricao="Para onde vai o dinheiro"
        itens={despesas}
        corTitulo="text-danger"
      />

      <p className="text-xs text-foreground-500 flex items-center gap-1">
        <FiLock size={12} /> Categorias com cadeado são padrão do sistema e não podem ser editadas.
      </p>
    </div>
  );
}

export default Categorias;
