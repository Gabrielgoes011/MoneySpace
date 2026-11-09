# Template Frontend (React + Vite + HeroUI)

Base para novos apps. Mobile-first: no celular aparece menu embaixo, no desktop menu lateral.

## Como usar

1. Copie esta pasta com outro nome e rode `npm install`
2. Copie `.env.example` para `.env.local` e ajuste `VITE_API_URL`
3. `npm run dev` e abra http://localhost:5173

## Estrutura (o que cada pasta faz)

| Pasta | Para que serve |
|---|---|
| `src/index.jsx` | Liga o React na página. Não mexa. |
| `src/App.jsx` | Lista de rotas (páginas) e quem precisa estar logado |
| `src/pages/` | Uma pasta por tela (Login, Dashboard...) |
| `src/components/Layout/` | Header, menu lateral (desktop) e menu inferior (celular) |
| `src/context/` | Dados globais: login (Auth), tema escuro (Theme), ocultar valores (Privacy) |
| `src/hooks/` | Funções reutilizáveis, ex.: `useIsMobile` diz se a tela é de celular |
| `src/services/api.js` | Configura o Axios: envia o token sozinho e volta ao login se expirar |

## Criar uma nova página

1. Crie `src/pages/Exemplo/Exemplo.jsx` (copie o `Dashboard.jsx` como modelo)
2. Em `src/App.jsx`, importe e adicione `<Route path="/exemplo" element={<Exemplo />} />`
3. Se quiser no menu, adicione o link em `Sidebar.jsx` e `BottomNavMobile.jsx`

## Chamar a API

```js
import api from '../../services/api';
const resposta = await api.get('/rota-da-api'); // resposta.data.data = dados
```

O backend responde `{ success, message, data }` (padrão do `httpResponse.js`).

## Componentes do HeroUI

Este template usa a biblioteca **[HeroUI v3](https://heroui.com/en/docs/react/components)** para toda a UI (botões, cards, inputs, chips, spinner, toast, etc.).

- Docs dos componentes: https://heroui.com/en/docs/react/components
- Import: `import { Button, Card } from '@heroui/react'`
- Sem Provider: use subcomponentes como `Card.Header`, `Card.Content`
- Toast: `import { toast } from '@heroui/react'` e `toast.success('Salvo!')`

## Testes

O template não vem com testes configurados, mas o setup recomendado é **Vitest + React Testing Library** (integra direto com o Vite):

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Adicione o script no `package.json`:

```json
"scripts": { "test": "vitest" }
```

E rode uma única vez (sem watch) com `npm test -- --run`.
