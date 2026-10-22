# Plano de Implementação — Controle de Fatura & Conferência da Reserva

> Regra do projeto (AGENTS.md): o FRONTEND é implementado pela IA por completo.
> O BACKEND é escrito pelo Gabriel; a IA cria o ESQUELETO (controller/service/
> repository/routes com assinaturas + `// implementar: ...`), alinha o contrato,
> mostra o padrão e revisa. Exceção só com pedido explícito do Gabriel (como foi
> no módulo `conta`). As tarefas abaixo marcam [BACK-ESQUELETO] onde a IA só cria
> o esqueleto e [FRONT] onde a IA implementa completo.

## Fase 0 — Decisões e fundação de migration

- [x] 1. Fechar decisões de contrato com o usuário e registrar no design
  - Confirmar layout real do CSV Rico (delimitador, encoding, nomes de colunas,
    exemplos de pagamento/estorno, sinal dos valores).
  - Confirmar regra de competência, política de CSV corrigido, fechamento com/sem
    pendências, permissões (qualquer membro vs ADMIN).
  - Confirmar ferramenta/comando de migration aceito para o Neon.
  - _Requisitos: 3, 9, 10, 12_

- [x] 2. Criar a fundação de migrations
  - Confirmar o processo de aplicação de `db/migrations/migration-NN-*.sql` no Neon.
  - Documentar como aplicar sem reexecutar `script.sql` destrutivamente.
  - _Requisitos: 12.1, 12.4_

## Fase 1 — Banco: domínio de fatura

- [x] 3. Escrever `migration-03-controle-fatura.sql`
  - Criar `fatura`, `fatura_importacao`, `fatura_transacao` conforme design.
  - Constraints: `chk_fatura_status`, `uq_fatura_competencia`, checks de
    liquidação, `uq_importacao_hash`, `uq_transacao_fingerprint`.
  - Habilitar RLS e policies por `current_setting('app.current_familia_id', true)`.
  - Criar índices.
  - Incluir bloco de rollback comentado no mesmo arquivo.
  - _Requisitos: 2.1, 4.1, 4.2, 10.1, 12.1, 12.3_

- [x] 4. Aplicar a migration em banco descartável e validar
  - Testar constraints, uniques, RLS dentro de uma transação com
    `set_config('app.current_familia_id', ...)`, e conversão `NUMERIC`.
  - _Requisitos: 10.1, 10.3, 12.4_

- [x] 5. Atualizar `db/script.sql` como fonte da verdade
  - Refletir as três tabelas novas, índices e policies.
  - _Requisitos: 12.2_

## Fase 2 — Backend: esqueleto do módulo e contrato

- [x] 6. [BACK-ESQUELETO] Criar `src/modules/fatura/` com assinaturas
  - `fatura.routes.js`, `fatura.controller.js`, `fatura.service.js`,
    `fatura.repositories.js` com assinaturas + `// implementar: ...`.
  - Rotas na ordem `verificaToken → rlsMiddleware → controller`.
  - Registrar o módulo em `src/modules/app.js` sob `/api`.
  - _Requisitos: 10.2, 10.4, 10.5_

- [x] 7. [BACK-ESQUELETO] Definir o contrato de todos os endpoints
  - Documentar request/response de cada rota conforme o design (tabela de API).
  - Respostas via `httpResponse`; erros Postgres via `pgErrorHandler`.
  - _Requisitos: 10.5, 5, 6, 7, 9_

- [x] 8. [BACK-ESQUELETO] Esqueleto do middleware de upload (multer em memória)
  - Assinatura + `// implementar` para limite de tamanho e validação de tipo.
  - _Requisitos: 3.9_

## Fase 3 — Parser Rico (lógica de importação)

- [x] 9. [BACK-ESQUELETO] Criar `importadores/rico.parser.js` com assinaturas
  - `parseCsvRico`, `normalizarValor`, `normalizarData`, `parseParcela`,
    `classificar` com `// implementar` e a regra documentada no design.
  - `importadores/index.js` para seleção de parser por emissor.
  - _Requisitos: 3.1–3.5_

- [x] 10. [BACK-ESQUELETO] Esqueleto do fluxo de preview e persistência
  - Service: assinatura de `gerarPreview(db, idFatura, buffer)` e
    `confirmarImportacao(db, idFatura, buffer, usuario)` com `// implementar`,
    descrevendo: transação única, hash idempotente, fingerprint por linha,
    rejeição de hash repetido.
  - _Requisitos: 3.6, 3.7, 3.8, 3.10, 4.3_

## Fase 4 — Frontend: estrutura e navegação

- [x] 11. [FRONT] Criar serviço `src/services/faturaService.js`
  - Consumir `api.js`; métodos do design; sem mock; sem fetch paralelo.
  - _Requisitos: 7.6, 10.7, 11.4_

- [x] 12. [FRONT] Criar rota `/faturas` e item de navegação
  - Rota protegida em `App.jsx`; item na `Sidebar.jsx` e `BottomNavMobile.jsx`.
  - Registrar (sem remover ainda) a decisão sobre a tela `Transacoes` legada.
  - _Requisitos: 11.2, 11.5_

- [x] 13. [FRONT] Página `Faturas.jsx` com seletor de cartão/competência
  - Selects de cartão (contas `CREDITO`) e competência; troca sem refresh.
  - Estados de loading/erro/vazio com HeroUI; `toast` para feedback.
  - _Requisitos: 1.1, 1.2, 2.2, 2.3, 2.6, 11.1_

## Fase 5 — Frontend: resumo e reserva

- [x] 14. [FRONT] `FaturaResumo.jsx` (KPIs)
  - Cards: total, pago, pendente, fechamento, meta, status da conferência.
  - Respeitar `PrivacyContext`; consumir `/faturas/:id/dashboard`.
  - _Requisitos: 5.1–5.5_

- [x] 15. [FRONT] `ReservaCard.jsx` (conferência)
  - Input do saldo declarado; mostra diferença e diagnóstico SOBRA/DÉFICIT.
  - PATCH via serviço; atualizar UI só após resposta; validação de valor.
  - _Requisitos: 6.1–6.6_

## Fase 6 — Frontend: importação

- [x] 16. [FRONT] `ImportarFaturaModal.jsx`
  - Upload de CSV; chama preview; exibe linhas válidas + erros por linha;
    confirmação explícita; `toast.promise`; trata 409 de duplicidade.
  - _Requisitos: 3.1, 3.4, 3.8, 11.4_

## Fase 7 — Frontend: lançamentos e análises

- [x] 17. [FRONT] `FaturaTransacoesTable.jsx`
  - `Table` + `Table.ScrollContainer`; colunas data, estabelecimento, portador
    (chip), valor, parcela (badge), categoria, status (badge por cor).
  - Busca por estabelecimento; filtros por portador/categoria/status; sort por
    data e valor; edição inline de categoria/portador/status.
  - Bloquear edição quando a fatura está `FECHADA`/`PAGA`.
  - _Requisitos: 7.1–7.7, 4.4, 4.5_

- [x] 18. [FRONT] `AnalisePortador.jsx` e `AnaliseCategoria.jsx`
  - Tabelas/cards com total, percentual e quantidade; cores quando disponíveis;
    responsivo sem exigir biblioteca de gráficos.
  - _Requisitos: 8.1–8.4_

## Fase 8 — Fechamento mensal

- [x] 19. [BACK-ESQUELETO] Esqueleto do fechamento
  - Service `fecharFatura(db, idFatura, usuario)` com `// implementar`: muda
    status, registra `fechada_em`/`fechada_por`, bloqueia mutações, abre próxima
    competência de forma idempotente.
  - _Requisitos: 9.1–9.4_

- [x] 20. [FRONT] Ação de fechar fatura na UI
  - Botão com confirmação; após fechar, refletir bloqueio de edição/importação e
    disponibilizar a nova competência; `toast` de sucesso/erro.
  - _Requisitos: 9.1, 9.2, 9.3, 11.4_

## Fase 9 — Validação e documentação

- [x] 21. [FRONT] Validar build do frontend
  - `cd MoneySpace-Front && npm run build` sem erros.
  - Verificação manual em mobile e desktop (importar válido/inválido/duplicado,
    editar status, declarar reserva, verificar sobra/déficit, fechar).
  - _Requisitos: 11.1–11.4_

- [x] 22. Smoke tests de backend (com Gabriel) e isolamento de tenant
  - Fluxo completo autenticado; duas famílias não cruzam dados.
  - _Requisitos: 10.1, 10.3_

- [x] 23. Limpeza de legado não destrutiva (com confirmação)
  - Confirmar remoção do `src/app.js` legado (reversível via git).
  - NÃO remover tabelas do financeiro genérico sem pedido explícito.
  - Gerar `migration-04-ajustes-legado.sql` apenas se algo de schema precisar
    ajuste, com rollback comentado.
  - _Requisitos: 12.3, 12.5_

- [x] 24. Atualizar documentação do projeto
  - `agents.md` (ESTADO/LOG/CONVENÇÕES) e `ROADMAP_DESENVOLVIMENTO.md` refletindo
    o novo foco e o módulo de fatura.
  - _Requisitos: 12.5_
