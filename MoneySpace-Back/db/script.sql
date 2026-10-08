-- ============================================================================
--  MoneySpace - SCRIPT DE CRIAÇÃO DO BANCO
--  "Um espaço para organizar toda sua vida financeira."
-- ============================================================================
--  Banco: PostgreSQL  (nome sugerido do database: moneyspace)
--  Para criar o database (rode conectado ao postgres, fora deste script):
--     CREATE DATABASE moneyspace;
--  Depois conecte-se a ele e execute este arquivo.
--  Arquitetura: Multi-tenant (vários "clientes" no mesmo banco), onde cada
--               família é um tenant isolado pela coluna `id_familia` + RLS.
--
--  CONVENÇÕES DO PROJETO
--  ---------------------
--  - snake_case em tudo (ex: dt_cadastro, id_familia).
--  - Chave primária sempre chamada `id` (UUID).
--  - Chaves estrangeiras com prefixo "id_" (ex: id_familia, id_usuario).
--  - Dinheiro em NUMERIC(14,2): valor em reais com 2 casas (ex: 10.50, 1200.00).
--    Tipo exato (sem erro de float) e sem precisar dividir por 100. OBS: o driver
--    `pg` entrega NUMERIC como string no JS; use Number(valor) ao fazer contas.
--  - Datas do "fato" em DATE (dt_compra, dt_transacao); carimbo de criação
--    em TIMESTAMP (dt_cadastro).
--  - `usuario_cadastro` guarda o NOME de quem lançou (snapshot do momento),
--    para leitura rápida sem precisar de JOIN.
--
--  COMO LER ESTE ARQUIVO
--  ---------------------
--  1. Extensão (UUID)      2. Tabelas      3. Índices
--  4. Row-Level Security (RLS)             5. Exemplos de uso (comentados)
-- ============================================================================


-- ============================================================================
-- 1. EXTENSÃO: geração automática de UUIDs
-- ----------------------------------------------------------------------------
-- `uuid_generate_v4()` cria um ID aleatório (ex: '550e8400-e29b-41d4-...').
-- Usamos UUID em vez de 1,2,3 por segurança: ninguém adivinha/conta registros
-- de outras famílias. (No PostgreSQL 13+ existe `gen_random_uuid()` nativa,
-- mas mantemos a extensão por compatibilidade.)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- 2. TABELAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- familia: o "tenant". Representa um núcleo familiar (a casa).
--   Tudo no sistema pendura nela via id_familia.
--   Ex: { nome: 'Família Silva' }
-- ----------------------------------------------------------------------------
CREATE TABLE familia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome VARCHAR(100) NOT NULL,
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- usuario: pessoas que logam no app (marido, esposa...). Pertencem a 1 família.
--   `senha_hash`  -> nunca a senha pura; sempre o hash (ex: bcrypt).
--   `mfa_secreto` -> segredo TOTP (Google Authenticator). `mfa_ativo` liga o 2FA.
--
--   CONTROLE DE ACESSO (duas dimensões):
--     `is_master` (GLOBAL) -> dono do APP inteiro (super admin), acima das
--        famílias. Só ele cria novas famílias/tenants. Pensado para o SaaS.
--     `role` (POR FAMÍLIA) -> papel dentro da própria família:
--        'ADMIN'  = responsável (cria contas, gerencia membros da família).
--        'MEMBRO' = usuário comum (esposa, filho).
--     Obs.: promover/rebaixar (mexer em role/is_master) é operação sensível e
--           deve ser autorizada na camada de aplicação (ver backend).
--   Ex: { nome: 'Carlos', email: 'carlos@email.com', mfa_ativo: true,
--         is_master: true, role: 'ADMIN' }
-- ----------------------------------------------------------------------------
CREATE TABLE usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(11) UNIQUE NOT NULL,            --campo cpf
    email VARCHAR(150) UNIQUE NOT NULL,         -- login; único no banco todo
    senha VARCHAR(255) NOT NULL,               -- hash da senha, nunca o texto puro
    mfa_secreto VARCHAR(100),                   -- segredo TOTP (opcional)
    mfa_ativo BOOLEAN DEFAULT false,            -- 2FA ligado?

    is_master BOOLEAN NOT NULL DEFAULT false,   -- dono do APP (global, super admin)
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBRO', -- papel na família: 'ADMIN' | 'MEMBRO'

    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT chk_usuario_role CHECK (role IN ('ADMIN', 'MEMBRO'))
);

-- ----------------------------------------------------------------------------
-- conta: onde o dinheiro mora/transita. Serve para conta corrente, carteira
--   (dinheiro vivo) E cartão de crédito. Cadastre quantas quiser (Nubank, Rico...).
--   Os campos de cartão (bandeira, final_cartao, limite, dias) só fazem sentido
--   quando tipo = 'CREDITO' - nos outros tipos ficam nulos.
--   `saldo_inicial`: foto do saldo no DIA que a conta foi criada, só
--   para sincronizar com o banco real. NUNCA é somado como receita depois.
--   Ex (cartão): { nome:'Nubank', tipo:'CREDITO', final_cartao:'1234',
--                  dia_fechamento:28, dia_vencimento:5, limite:5000.00 }
--   Ex (dinheiro): { nome:'Carteira', tipo:'CARTEIRA', saldo_inicial:150.00 }
-- ----------------------------------------------------------------------------
CREATE TABLE conta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,                 -- Ex: 'Nubank', 'Rico', 'Carteira'
    tipo VARCHAR(50) NOT NULL,                  -- 'CORRENTE', 'CREDITO', 'CARTEIRA'
    saldo_inicial NUMERIC(14,2) DEFAULT 0,      -- saldo em reais no "dia zero" (sincronização)

    -- Campos específicos de cartão de crédito (todos opcionais)
    bandeira VARCHAR(50),                       -- Ex: 'VISA', 'MASTERCARD' (opcional)
    final_cartao VARCHAR(4),                    -- 4 últimos dígitos, ex: '1234' (opcional)
    limite NUMERIC(14,2),                       -- limite do cartão em reais (opcional)
    dia_fechamento SMALLINT,                    -- dia que a fatura fecha (1-31, opcional)
    dia_vencimento SMALLINT,                    -- dia que a fatura vence (1-31, opcional)

    ativo BOOLEAN DEFAULT true,                 -- "arquivar" conta/cartão sem apagar histórico
    usuario_cadastro VARCHAR(100),              -- nome de quem criou (usuário logado no momento)
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- categoria: etiqueta de classificação (Mercado, Lazer, Salário...). É o que
--   alimenta o relatório "onde gastei mais".
--   Regra híbrida (ver RLS lá embaixo):
--     - Categoria do SISTEMA: padrao_sistema = true e id_familia = NULL.
--       Vem pronta, todos usam, ninguém edita/apaga.
--     - Categoria da FAMÍLIA: padrao_sistema = false e id_familia preenchido.
--       Só a própria família vê e edita.
--   `tipo` separa entrada de saída (não misturar salário com gasto).
--   `cor` é só visual (gráficos/etiquetas).
--   Ex (sistema):  { nome:'Mercado', tipo:'DESPESA', cor:'#FF6B6B', padrao_sistema:true, id_familia:NULL }
--   Ex (família):  { nome:'Mesada do filho', tipo:'DESPESA', cor:'#4ECDC4', padrao_sistema:false }
-- ----------------------------------------------------------------------------
CREATE TABLE categoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID REFERENCES familia(id) ON DELETE CASCADE, -- NULL = categoria do sistema
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,                  -- 'RECEITA' ou 'DESPESA'
    cor VARCHAR(10),                            -- hexadecimal, ex: '#FF0000'
    padrao_sistema BOOLEAN DEFAULT false,       -- true = global (vem pronta no app)
    usuario_cadastro VARCHAR(100),              -- nome de quem criou (NULO nas do sistema)
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- contato: terceiros (pessoas) ligados à família. Usado quando você empresta
--   o cartão ou paga algo por alguém e quer saber "quem me deve".
--   Cadastra uma vez e reaproveita nas compras.
--   Ex: { nome:'João (cunhado)', telefone:'(11) 99999-0000' }
-- ----------------------------------------------------------------------------
CREATE TABLE contato (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,                 -- Ex: 'João (cunhado)'
    telefone VARCHAR(30),                       -- opcional
    observacao TEXT,                            -- opcional
    usuario_cadastro VARCHAR(100),              -- nome de quem criou (usuário logado no momento)
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- compra: o "fato econômico" - a decisão de gastar/receber. É o guarda-chuva
--   que agrupa as parcelas (ver tabela `transacao`) e carrega as informações
--   que valem para a COMPRA inteira:
--     - total_parcelas: 1 = à vista; 12 = parcelado em 12x.
--     - valor_reservado: "já separei o dinheiro pra pagar essa fatura?"
--       (ex: comprei no crédito e guardei o valor no débito). É por compra.
--     - emprestado + id_devedor + reembolsado: empréstimo/compra de terceiro.
--       emprestado=true marca que o gasto não é "seu de verdade"; id_devedor
--       aponta quem te deve; reembolsado=true quando já te pagaram.
--   `id_usuario` = dono do gasto;  `usuario_cadastro` = quem digitou (podem diferir:
--   a esposa lança um gasto do marido).
--   Ex (parcelado): { estabelecimento:'Magazine', valor_total:1200.00,
--                     total_parcelas:12, metodo_pagamento:'CREDITO', tipo:'DESPESA' }
--   Ex (emprestei cartão p/ João): { valor_total:300.00, emprestado:true,
--                     id_devedor:<id do João>, reembolsado:false }
-- ----------------------------------------------------------------------------
CREATE TABLE compra (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_usuario UUID NOT NULL REFERENCES usuario(id),       -- dono do gasto/receita
    id_conta UUID NOT NULL REFERENCES conta(id),           -- onde caiu (cartão Nubank, Rico, etc.)
    id_categoria UUID NOT NULL REFERENCES categoria(id),

    valor_total NUMERIC(14,2) NOT NULL,                    -- valor cheio da compra (em reais)
    tipo VARCHAR(50) NOT NULL,                             -- 'RECEITA' ou 'DESPESA'
    metodo_pagamento VARCHAR(50) NOT NULL,                 -- 'PIX','CREDITO','DEBITO','DINHEIRO','BOLETO'

    estabelecimento VARCHAR(150),                          -- Ex: 'Mercado Extra'
    descricao TEXT,                                        -- observação livre (opcional)

    total_parcelas SMALLINT NOT NULL DEFAULT 1,            -- 1 = à vista; 12 = 12x

    -- "Guardei o dinheiro?" -> reserva por COMPRA inteira.
    valor_reservado BOOLEAN DEFAULT false,

    -- Empréstimo / compra de terceiro
    emprestado BOOLEAN DEFAULT false,                      -- true = gasto não é "seu de verdade"
    id_devedor UUID REFERENCES contato(id),                -- de quem é a dívida (opcional)
    reembolsado BOOLEAN DEFAULT false,                     -- o terceiro já te pagou de volta?

    dt_compra DATE NOT NULL,                               -- data do fato
    usuario_cadastro VARCHAR(100),                         -- nome de quem lançou
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- transacao: cada PARCELA / movimento efetivo no tempo (regime de caixa).
--   - Compra à vista  => 1 linha de transacao.
--   - Compra em 12x   => 12 linhas, uma por mês, cada uma com sua dt_transacao.
--   `status`: 'PENDENTE' (ainda vai cair) ou 'EFETIVADA' (já saiu/entrou).
--   É esta tabela que os relatórios mensais varrem (índice em dt_transacao).
--   Ex (parcela 3 de 12 de R$100): { numero_parcela:3, valor:100.00,
--                     status:'PENDENTE', dt_transacao:'2026-05-10' }
-- ----------------------------------------------------------------------------
CREATE TABLE transacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_compra UUID NOT NULL REFERENCES compra(id) ON DELETE CASCADE,  -- apaga a compra => apaga as parcelas

    valor NUMERIC(14,2) NOT NULL,                          -- valor desta parcela (em reais)
    numero_parcela SMALLINT NOT NULL DEFAULT 1,            -- Ex: 3 (de 12)
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',        -- 'EFETIVADA' ou 'PENDENTE'

    dt_transacao DATE NOT NULL,                            -- vencimento/data desta parcela
    usuario_cadastro VARCHAR(100),                         -- nome de quem gerou/lançou
    dt_cadastro TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- preferencia_notificacao: configuração ÚNICA da família para o relatório
--   automático por email (o diferencial do app). É só o "liga/desliga" + quando.
--   A lista de quem recebe fica em `email_destinatario`.
--   IMPORTANTE: credenciais do servidor SMTP ficam no .env do backend, NUNCA aqui.
--   Ex: { relatorio_ativo:true, frequencia:'SEMANAL', dia_envio:0, hora_envio:8 }
--       (todo domingo às 8h)
-- ----------------------------------------------------------------------------
CREATE TABLE preferencia_notificacao (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,

    relatorio_ativo BOOLEAN DEFAULT true,         -- liga/desliga o relatório da família
    frequencia VARCHAR(20) DEFAULT 'SEMANAL',     -- 'SEMANAL' ou 'MENSAL'
    dia_envio SMALLINT DEFAULT 0,                 -- 0=domingo ... 6=sábado (para semanal)
    hora_envio SMALLINT DEFAULT 8,                -- hora do envio (0-23)

    usuario_cadastro VARCHAR(100),                -- nome de quem configurou
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_preferencia_familia UNIQUE (id_familia)  -- 1 config por família
);

-- ----------------------------------------------------------------------------
-- email_destinatario: lista de emails que recebem o relatório (ex: você e a esposa).
--   Vários por família. `ativo` pausa um destinatário sem apagar.
--   Ex: { email:'carlos@email.com', nome:'Eu', ativo:true }
--       { email:'maria@email.com',  nome:'Esposa', ativo:true }
-- ----------------------------------------------------------------------------
CREATE TABLE email_destinatario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,                  -- email que vai receber o relatório
    nome VARCHAR(100),                            -- rótulo opcional (ex: 'Eu', 'Esposa')
    ativo BOOLEAN DEFAULT true,                   -- pausar sem apagar

    usuario_cadastro VARCHAR(100),                -- nome de quem cadastrou
    dt_cadastro TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_email_familia UNIQUE (id_familia, email)  -- sem email duplicado na família
);

-- ----------------------------------------------------------------------------
-- transferencia: transferência de dinheiro entre membros da família.
--   Registra PIX/transferência interna de um usuário para outro, com histórico.
--   Ex: { id_usuario_remetente:'uuu1', id_usuario_destinatario:'uuu2',
--          valor:500.00, descricao:'Mesada', dt_transferencia:'2026-03-15 10:30:00' }
-- ----------------------------------------------------------------------------
CREATE TABLE transferencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_familia UUID NOT NULL REFERENCES familia(id) ON DELETE CASCADE,
    id_usuario_remetente UUID NOT NULL REFERENCES usuario(id),    -- quem enviou
    id_usuario_destinatario UUID NOT NULL REFERENCES usuario(id), -- quem recebeu

    valor NUMERIC(14,2) NOT NULL,                 -- valor em reais
    descricao VARCHAR(255),                       -- opcional (ex: 'Mesada', 'Gasto compartilhado')

    dt_transferencia TIMESTAMP DEFAULT NOW(),     -- quando a transferência foi feita
    usuario_cadastro VARCHAR(100),                -- nome de quem registrou
    dt_cadastro TIMESTAMP DEFAULT NOW()
);


-- ============================================================================
-- 3. ÍNDICES (performance)
-- ----------------------------------------------------------------------------
-- Indexamos as FKs mais consultadas (sempre filtramos por id_familia) e as
-- datas usadas nos relatórios. Isso acelera as queries do dia a dia.
-- ============================================================================
CREATE INDEX idx_usuario_familia   ON usuario(id_familia);
-- Índice parcial: há pouquíssimos masters (idealmente 1). Acelera "quem é master?".
CREATE INDEX idx_usuario_master    ON usuario(is_master) WHERE is_master = true;
CREATE INDEX idx_conta_familia     ON conta(id_familia);
CREATE INDEX idx_categoria_familia ON categoria(id_familia);
CREATE INDEX idx_contato_familia   ON contato(id_familia);

CREATE INDEX idx_compra_familia    ON compra(id_familia);
CREATE INDEX idx_compra_usuario    ON compra(id_usuario);
CREATE INDEX idx_compra_conta      ON compra(id_conta);
CREATE INDEX idx_compra_categoria  ON compra(id_categoria);
CREATE INDEX idx_compra_devedor    ON compra(id_devedor);
CREATE INDEX idx_compra_data       ON compra(dt_compra);

CREATE INDEX idx_transacao_familia ON transacao(id_familia);
CREATE INDEX idx_transacao_compra  ON transacao(id_compra);
CREATE INDEX idx_transacao_datas   ON transacao(dt_transacao); -- relatórios mensais
CREATE INDEX idx_transacao_status  ON transacao(status);

CREATE INDEX idx_preferencia_familia  ON preferencia_notificacao(id_familia);
CREATE INDEX idx_destinatario_familia ON email_destinatario(id_familia);

CREATE INDEX idx_transferencia_familia ON transferencia(id_familia);
CREATE INDEX idx_transferencia_remetente ON transferencia(id_usuario_remetente);
CREATE INDEX idx_transferencia_destinatario ON transferencia(id_usuario_destinatario);
CREATE INDEX idx_transferencia_data ON transferencia(dt_transferencia);


-- ============================================================================
-- 4. ROW-LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
-- O isolamento multi-tenant: cada família só enxerga os próprios dados.
-- A cada request, o backend (Node.js) abre uma transação e injeta o contexto:
--
--     SET LOCAL app.current_familia_id = '<uuid-da-familia-do-JWT>';
--
-- A partir daí, um "SELECT * FROM transacao" devolve só as linhas daquela
-- família - mesmo sem WHERE. O `current_setting(..., true)` retorna NULL em
-- vez de erro quando o contexto não está setado (ex: tarefas internas).
-- ============================================================================
ALTER TABLE familia   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario   ENABLE ROW LEVEL SECURITY;
ALTER TABLE conta     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE contato   ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencia_notificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_destinatario ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencia ENABLE ROW LEVEL SECURITY;

-- 4.1 Policies: "só vejo/edito o que é da minha família".
CREATE POLICY acesso_usuario ON usuario
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

CREATE POLICY acesso_conta ON conta
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

CREATE POLICY acesso_contato ON contato
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

CREATE POLICY acesso_compra ON compra
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

CREATE POLICY acesso_transacao ON transacao
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

CREATE POLICY acesso_preferencia ON preferencia_notificacao
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

CREATE POLICY acesso_destinatario ON email_destinatario
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);

-- Categoria: regra híbrida.
--   - Ver: as da minha família OU as globais do sistema.
--   - Editar/apagar: só as da minha família (nunca as do sistema).
CREATE POLICY ver_categoria ON categoria
    FOR SELECT USING (
        id_familia = current_setting('app.current_familia_id', true)::uuid
        OR padrao_sistema = true
    );

CREATE POLICY alterar_categoria ON categoria
    FOR ALL USING (
        id_familia = current_setting('app.current_familia_id', true)::uuid
        AND padrao_sistema = false
    );

CREATE POLICY acesso_transferencia ON transferencia
    FOR ALL USING (id_familia = current_setting('app.current_familia_id', true)::uuid);


-- ============================================================================
-- 5. EXEMPLOS DE USO (apenas referência - deixados comentados)
-- ----------------------------------------------------------------------------
-- Os blocos abaixo NÃO são executados. Servem para ilustrar o fluxo típico.
-- Lembre: no app real o backend seta o contexto de RLS antes de rodar queries.
-- ============================================================================

-- -- (a) Criar uma família e seus usuários
-- INSERT INTO familia (nome) VALUES ('Família Silva');
-- -- supondo que a família criada tem id = 'fff...'
-- INSERT INTO usuario (id_familia, nome, email, senha_hash)
-- VALUES ('fff...', 'Carlos', 'carlos@email.com', '<hash>');

-- -- (b) Cadastrar um cartão de crédito e uma carteira
-- INSERT INTO conta (id_familia, nome, tipo, final_cartao, dia_fechamento, dia_vencimento, usuario_cadastro)
-- VALUES ('fff...', 'Nubank', 'CREDITO', '1234', 28, 5, 'Carlos');
-- INSERT INTO conta (id_familia, nome, tipo, saldo_inicial, usuario_cadastro)
-- VALUES ('fff...', 'Carteira', 'CARTEIRA', 150.00, 'Carlos');

-- -- (c) Lançar uma compra parcelada em 3x no cartão (R$ 300,00) e suas parcelas
-- INSERT INTO compra (id_familia, id_usuario, id_conta, id_categoria,
--                     valor_total, tipo, metodo_pagamento,
--                     estabelecimento, total_parcelas, dt_compra, usuario_cadastro)
-- VALUES ('fff...', 'uuu...', 'ccc...', 'cat...',
--         300.00, 'DESPESA', 'CREDITO', 'Magazine', 3, '2026-03-10', 'Carlos');
-- -- 3 parcelas de R$ 100,00 (uma por mês)
-- INSERT INTO transacao (id_familia, id_compra, valor, numero_parcela, status, dt_transacao, usuario_cadastro)
-- VALUES ('fff...', 'cmp...', 100.00, 1, 'EFETIVADA', '2026-03-10', 'Carlos'),
--        ('fff...', 'cmp...', 100.00, 2, 'PENDENTE',  '2026-04-10', 'Carlos'),
--        ('fff...', 'cmp...', 100.00, 3, 'PENDENTE',  '2026-05-10', 'Carlos');

-- -- (d) Relatório: quanto cada pessoa me deve (empréstimos não reembolsados)
-- SELECT c.nome AS devedor,
--        SUM(cp.valor_total) AS total_devido
-- FROM compra cp
-- JOIN contato c ON c.id = cp.id_devedor
-- WHERE cp.emprestado = true AND cp.reembolsado = false
-- GROUP BY c.nome;

-- -- (e) Relatório: total de despesas por categoria no mês
-- SELECT cat.nome, SUM(t.valor) AS total
-- FROM transacao t
-- JOIN compra cp  ON cp.id = t.id_compra
-- JOIN categoria cat ON cat.id = cp.id_categoria
-- WHERE cp.tipo = 'DESPESA'
--   AND t.dt_transacao >= '2026-03-01' AND t.dt_transacao < '2026-04-01'
-- GROUP BY cat.nome
-- ORDER BY total DESC;
