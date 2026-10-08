# 🚀 MoneySpace — Roadmap de Desenvolvimento
> **Fluxo ideal de implementação por prioridade e dependências**

---

## 📋 Legenda
- 🔴 **MVP (DEVE ter)**  — bloqueia a próxima fase
- 🟡 **Core (RECOMENDADO)** — melhora drasticamente a usabilidade
- 🟢 **Plus (LEGAL ter)**  — diferenciais, podem vir depois
- 🔵 **Bônus (FUTURO)**    — nice-to-haves, não bloqueia nada

---

## 🎯 Fase 1: Fundação (Autenticação & Segurança)
**Objetivo:** Ter um app que você consegue acessar com segurança.  
**Dependência:** Nenhuma (é o começo)  
**Tempo estimado:** ~1-2 semanas

### 1.1 Login Simples (Email + Senha) 🔴 ✅ CONCLUÍDA
- [x] Tela de login no front
- [x] Validação email/senha no backend
- [x] JWT gerado e armazenado
- [x] Sessão persistida no localStorage
- **Saída:** Um usuário consegue fazer login ✅

### 1.2 Criar Família + Primeiro Usuário 🔴
- Tela de cadastro (nome, email, senha, cpf)
- Criar a família + usuário no banco
- **Saída:** Novo usuário criado com sua família

### 1.3 MFA (2FA com Google Authenticator) 🟡
- QR code gerado na primeira vez
- TOTP validado no login (6 dígitos)
- `mfa_ativo` controlando se é obrigatório
- **Saída:** Login com 2 fatores funcionando

### 1.4 Logout e Contexto de Segurança 🔴 ✅ CONCLUÍDA
- [x] Botão de logout no app (Header + MenuLateral)
- [x] JWT limpo do localStorage
- [x] Cookies httpOnly (token + refreshToken) limpos no backend via `POST /logout`
- [x] Redirecionamento para login
- **Saída:** Sessão finalizada corretamente ✅

---

## 🎯 Fase 2: Core — Contas e Saldos
**Objetivo:** Ter controle de onde o dinheiro mora.  
**Dependência:** Fase 1 (precisa estar logado)  
**Tempo estimado:** ~1-2 semanas

### 2.1 Cadastrar Contas (Corrente, Carteira, Cartão) 🔴 🚧 EM ANDAMENTO
- [x] Tela "Minhas Contas" (front) — cards + modal de criar/editar
- [x] Criar conta corrente (saldo_inicial) — form (front)
- [x] Criar carteira (dinheiro vivo) — form (front)
- [x] Criar cartão de crédito (limite, dias de fechamento/vencimento) — form (front)
- [x] Editar conta — modal reaproveitado (front)
- [ ] Backend: implementar funções de `src/modules/conta/` (Gabriel) — hoje é só esqueleto
- **Saída:** Dashboard mostra suas contas com saldos
- Obs.: front consome `GET/POST/PUT/DELETE /contas`; com backend em dev, cai em mock + toast.

### 2.2 Visualizar Saldos Totais 🔴
- Dashboard principal
- Total de dinheiro disponível (corrente + carteira)
- Limite disponível no cartão
- **Saída:** Um "resumão" do seu dinheiro na tela principal

### 2.3 Arquivar Contas (Soft Delete) 🟡
- Botão "arquivar" em vez de deletar
- Conta desaparece da lista mas histórico fica
- **Saída:** Controle limpo de contas antigas

---

## 🎯 Fase 3: Lançamentos Simples
**Objetivo:** Registrar gastos e receitas do dia a dia.  
**Dependência:** Fase 2 (precisa ter contas)  
**Tempo estimado:** ~2-3 semanas

### 3.1 Lançar Despesas (À Vista) 🔴
- Tela "Novo Lançamento"
- Escolher conta (Nubank, Carteira, etc.)
- Escolher categoria (Mercado, Lazer, etc.)
- Digitar valor + descrição + data
- Escolher método (PIX, DÉBITO, DINHEIRO, BOLETO)
- Estabelecimento (opcional)
- **Saída:** Gasto aparece no histórico e afeta o saldo da conta

### 3.2 Lançar Receitas (Salários, Extras) 🔴
- Mesmo fluxo, mas tipo = RECEITA
- Adiciona ao saldo da conta
- Atribui a um usuário (marido ou esposa ganhou?)
- **Saída:** Receita registrada com quem recebeu

### 3.3 Categorias Globais do Sistema 🔴
- Carregar categorias padrão (Mercado, Transporte, Lazer, Salário, etc.)
- Aparecer no dropdown ao lançar
- Read-only (não edita)
- **Saída:** Usuário escolhe categoria ao lançar

### 3.4 Editar e Deletar Lançamentos 🟡
- Poder mudar valor, categoria, data de um lançamento
- Deletar lançamento e reverter saldo
- **Saída:** Correções rápidas sem perder histórico

---

## 🎯 Fase 4: Parcelamento & Crédito
**Objetivo:** Separar a compra (decisão) do movimento (parcela).  
**Dependência:** Fase 3 (precisa lançar)  
**Tempo estimado:** ~2 semanas

### 4.1 Parcelar Compras 🔴
- Ao lançar despesa no crédito, escolher "parcelado"
- Digitar `total_parcelas` (ex: 12x)
- Sistema gera N transações automáticas (uma por mês)
- Cada parcela com sua data de vencimento
- **Saída:** Uma compra de R$1.200 em 12x = 12 linhas de R$100 (uma por mês)

### 4.2 Reserva de Dinheiro (Valor Reservado) 🟡
- Checkbox "já guardei este valor?"
- Marca que você separou o dinheiro da fatura
- Usado no relatório de "quanto sobra?"
- **Saída:** Controle de caixa mais fino

### 4.3 Status de Parcela (PENDENTE vs EFETIVADA) 🟡
- Ver qual parcela já saiu e qual ainda sai
- Poder marcar como "já foi" antes do vencimento
- **Saída:** Previsão de caixa mais realista

---

## 🎯 Fase 5: Categorias Customizadas
**Objetivo:** A família criar suas próprias categorias.  
**Dependência:** Fase 3 (categorias já existem)  
**Tempo estimado:** ~1 semana

### 5.1 Criar Categoria Personalizada 🟡
- Tela "Categorias"
- Botão "+ Nova Categoria"
- Nome + tipo (RECEITA/DESPESA) + cor
- **Saída:** Categoria da família aparece no dropdown de lançamentos

### 5.2 Editar e Deletar Categorias 🟡
- Mudar nome, cor
- Deletar categoria (se não tem lançamentos)
- **Saída:** Controle total das categorias da família

---

## 🎯 Fase 6: Controle de Empréstimos
**Objetivo:** Saber quem te deve.  
**Dependência:** Fase 3 (precisa lançar)  
**Tempo estimado:** ~1-2 semanas

### 6.1 Cadastrar Contatos (Terceiros) 🟡
- Tela "Contatos"
- Nome + telefone (opcional) + observação
- Usar ao emprestar cartão ou pagar algo por alguém
- **Saída:** Lista de pessoas ligadas à família

### 6.2 Marcar Lançamento como Empréstimo 🟡
- Ao lançar, checkbox "Emprestar para..."
- Escolher contato devedor
- Sistema marca `emprestado = true` + `id_devedor`
- **Saída:** Esse gasto não conta nos seus gastos, só no histórico de débitos

### 6.3 Marcar Como Reembolsado 🟡
- Ver total que cada pessoa te deve
- Botão "Marcar como pago"
- `reembolsado = true`
- **Saída:** Você sabe quem já pagou de volta

---

## 🎯 Fase 7: Dashboard & Relatórios Simples
**Objetivo:** Entender para onde está indo o dinheiro.  
**Dependência:** Fase 3 (precisa ter lançamentos)  
**Tempo estimado:** ~2 semanas

### 7.1 Gráfico de Gastos por Categoria 🟡
- Gráfico pizza/barras mostrando top 5 categorias
- Período: últimos 30 dias
- **Saída:** Visualização rápida dos maiores gastos

### 7.2 Filtro de Período (Resolvendo o "Dia 30") 🟡
- Filtro: últimos 7 dias / 30 dias / mês atual / mês anterior
- Atualiza gráfico e valores
- **Saída:** Flexibilidade para ver diferentes períodos

### 7.3 Gastos por Pessoa 🟡
- Quanto o marido gastou vs. quanto a esposa gastou
- Comparativo lado a lado
- **Saída:** Transparência na divisão de gastos

### 7.4 Fatura Futura (Previsor) 🟡
- Mostrar transações PENDENTE (parcelas que ainda vão cair)
- vs. EFETIVADA (já caiu/entrou)
- **Saída:** Previsão de caixa do próximo mês

---

## 🎯 Fase 8: Transferências Entre Membros
**Objetivo:** PIX interno rápido entre familiares.  
**Dependência:** Fase 2 (precisa ter contas)  
**Tempo estimado:** ~1-2 semanas

### 8.1 Transferir Valor para Outro Membro 🟡
- Tela "Transferir"
- Escolher membro destino (esposa, filho, etc.)
- Digitar valor + descrição opcional
- Confirmar
- **Saída:** Você perde R$500, esposa ganha R$500 + histórico

### 8.2 Histórico de Transferências 🟡
- Ver quem enviou/recebeu, quando, quanto
- Filtrar por período
- **Saída:** Controle de divisão de caixa entre membros

---

## 🎯 Fase 9: Relatório Automático por Email (Diferencial) 🌟
**Objetivo:** Inteligência automática.  
**Dependência:** Fase 7 (precisa ter dashboard)  
**Tempo estimado:** ~2 semanas

### 9.1 Configurar Preferências de Notificação 🟢
- Tela "Configurações" → "Relatório"
- Ligar/desligar relatório
- Frequência (semanal / mensal)
- Dia e hora de envio
- **Saída:** Config salva no banco

### 9.2 Adicionar Destinatários 🟢
- Listar emails da família que recebem
- Adicionar novo email
- Pausar destinatário sem apagar
- **Saída:** Você e a esposa recebem email toda segunda às 8h

### 9.3 Job Agendado (Backend) 🟢
- Cron job que roda 1x/semana ou 1x/mês
- Lê `preferencia_notificacao` + `email_destinatario`
- Gera relatório HTML (gastos, receitas, previsão)
- Envia via SMTP (credenciais no `.env`)
- **Saída:** Email automático com resumo financeiro

### 9.4 Conteúdo do Email 🟢
- Total de gastos (por categoria)
- Receitas
- Quem gastou mais
- Fatura futura (aviso de parcelas vencendo)
- **Saída:** Relatório informativo toda semana/mês

---

## 🎯 Fase 10: Detalhes & Polimento (Bônus)
**Objetivo:** Melhorar UX e corrigir edge cases.  
**Dependência:** Fase 9 (tudo básico pronto)  
**Tempo estimado:** ~1-2 semanas

### 10.1 Busca de Lançamentos 🔵
- Campo de busca por descrição/estabelecimento
- Filtrar por categoria, período, pessoa
- **Saída:** Achar transação rápido

### 10.2 Duplicar Lançamento 🔵
- Botão para clonar um lançamento anterior
- Pré-preenche campos (útil para gastos recorrentes manuais)
- **Saída:** Lançar mais rápido

### 10.3 Temas & Preferências Visuais 🔵
- Dark mode / Light mode
- Salvar preferência do usuário
- **Saída:** Conforto visual

### 10.4 Exportar Dados (CSV/PDF) 🔵
- Botão "Baixar relatório"
- Gera CSV com transações do período
- **Saída:** Dados em mão para Excel/análise externa

---

## 📊 Resumo: Ordem de Execução

| Fase | Foco | Semanas | Saída |
|------|------|---------|-------|
| **1** | Login + Segurança | 1-2 | Você consegue acessar |
| **2** | Contas & Saldos | 1-2 | Dashboard com saldos |
| **3** | Lançamentos | 2-3 | Registrar gastos/receitas |
| **4** | Parcelamento | 2 | Separar compra de parcela |
| **5** | Categorias Custom | 1 | Criar categorias próprias |
| **6** | Empréstimos | 1-2 | Rastrear quem deve |
| **7** | Dashboard & Gráficos | 2 | Ver aonde vai o dinheiro |
| **8** | Transferências | 1-2 | PIX interno |
| **9** | Email Automático | 2 | Relatório semanal/mensal |
| **10** | Polimento | 1-2 | Experiência smooth |

**Total:** ~15-22 semanas = ~3-5 meses para o MVP completo + diferenciais.

---

## 🎯 MVP Mínimo (Semana 4)
Se você quer um app funcional em 1 mês, faça só:
- ✅ Fase 1: Login
- ✅ Fase 2: Contas
- ✅ Fase 3: Lançamentos (à vista)

**Saída:** Um app que registra gastos, mostra saldo e você consegue acessar.

Depois, com mais tempo:
- Fase 4: Parcelamento (essencial para crédito)
- Fase 7: Dashboard (entender os dados)
- Fase 9: Email (diferencial)

---

## 💡 Dicas de Implementação

1. **Sempre test de verdade:** Faça login, crie conta, lance gasto, veja no dashboard
2. **Mobile-first:** Cada tela vem com versão mobile 100% funcional antes de desktop
3. **RLS ativado desde o início:** Não deixe passar dados de outra família
4. **Dados consistentes:** Se deletou uma conta, o histórico fica (soft delete)
5. **Saldos precisos:** Sempre validar saldo antes de permitir gasto

---

## 🔗 Próximos Passos
- [ ] Confirmar a ordem com o time
- [ ] Estimar timebox por feature
- [x] Iniciar Fase 1 (Login)
- [x] 1.1 Login Simples (Email + Senha)
- [ ] 1.2 Criar Família + Primeiro Usuário
