# Gerenciador de Tarefas Multi-Usuário

Projeto da disciplina de Desenvolvimento de Sistemas Web (DSW), UniSENAI.

**Estudante:** Leonardo Volpi

Aplicação web full stack em que cada pessoa cria a sua conta, faz login e enxerga só as próprias tarefas. O projeto foi crescendo aula a aula, e cada etapa ficou registrada nos diários de classe.

---

## Sumário

- [Visão geral](#visão-geral)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Rotas da API](#rotas-da-api)
- [Como rodar](#como-rodar)
- [Deploy no Render](#deploy-no-render)
- [Diários de classe](#diários-de-classe)
- [Documentação complementar](#documentação-complementar)
- [Histórico de evolução](#histórico-de-evolução)

---

## Visão geral

| Recurso | Como funciona |
|---|---|
| Autenticação | Cadastro e login com senha em hash (bcrypt) e sessão via token JWT (7 dias) |
| Tarefas | Criar, listar, concluir/reabrir e excluir, sempre isoladas por usuário |
| Busca | Por título no servidor, com *debounce* de 400 ms no front |
| Filtro | Chips por prioridade (Baixa, Média, Alta) aplicados no próprio front, sem nova chamada à API |
| Progresso | Contador de pendentes/concluídas e barra de progresso |
| Sessão expirada | Se a API responder 401, o token é apagado e a pessoa volta ao login com aviso |
| Banco de dados | SQLite local (`tarefas.db`) ou Turso/libSQL na nuvem, escolhido pelo `.env` |
| Diagnóstico | `/api/health` e `/api/db-check` confirmam a saúde do banco sem expor dados |
| Entrega | Em produção o próprio Express serve o build do React, tudo na mesma porta |

---

## Tecnologias

**Back-end:** Node.js · Express 5 · TypeScript · `@libsql/client` (SQLite/Turso) · bcryptjs · jsonwebtoken

**Front-end:** React 19 · TypeScript · Vite · Tailwind CSS 4

**Nuvem / DevOps:** Turso (banco na borda) · Render (deploy com Blueprint `render.yaml`)

---

## Arquitetura

### Roteamento híbrido (API + SPA)

O mesmo servidor Express atende duas coisas:

- **`/api/*`**: rotas REST em JSON (autenticação, CRUD, health). Uma rota `/api` que não existe responde 404 em JSON, e não o HTML do front.
- **Arquivos estáticos**: o build do React em `web/dist/`.
- **Fallback**: qualquer outra rota devolve o `index.html`, e o React assume no navegador.

Como front e API vivem no mesmo domínio em produção, não tem problema de CORS e as chamadas usam caminho relativo (`/api/tasks`).

### Componentes do front

```text
App.tsx  ──► dono da sessão (usuario). Decide entre <Login /> e <Tarefas />
 ├─ Login.tsx    formulário de entrar/criar conta, chama aoLogar()
 └─ Tarefas.tsx  CRUD, busca e filtro, chama aoSair()
api.ts   ──► única camada de rede: URL da API, token JWT e tratamento de erros
```

- **Lifting State Up:** o token pertence ao `App`. O botão Sair do `Tarefas` só avisa o `App` pela prop `aoSair()`.
- **Lazy initialization:** `useState(() => getUsuario())` lê o `localStorage` uma vez só, na montagem.
- **Estado derivado:** `const logado = usuario !== null`, sem um segundo `useState`.
- **Debounce com cleanup:** o `clearTimeout` no retorno do `useEffect` evita uma requisição por tecla.
- **Concorrência com `useRef`:** `requisicaoAtual` descarta respostas que chegam fora de ordem.
- **Derivação com `useMemo`:** a lista filtrada por prioridade é calculada, não é um estado a mais.

### Contrato de dados (TypeScript de ponta a ponta)

```ts
export interface Tarefa {
  id: number;
  usuario_id: number;
  titulo: string;
  descricao: string | null;
  status: "pending" | "completed";
  prioridade: "low" | "medium" | "high";
  criado_em: string;
  atualizado_em: string;
}

type Prioridade = Tarefa["prioridade"];                  // tipo derivado
const PRIORIDADES_PT: Record<Prioridade, string> = {...}; // tradução obrigatória
```

### Segurança

- **Bcrypt:** a senha nunca é salva em texto puro, só o hash com salt.
- **JWT stateless:** o servidor não guarda sessão, só confere a assinatura com o `JWT_SECRET`.
- **Middleware `exigirLogin`:** sem `Authorization: Bearer <token>` válido, a resposta é 401.
- **Contra IDOR:** o `usuario_id` sai do token e entra em todo `SELECT`, `UPDATE` e `DELETE` (`WHERE id = ? AND usuario_id = ?`). Adivinhar o id da tarefa de outra pessoa não adianta.
- **Consultas parametrizadas (`?`):** protegem contra SQL Injection.

---

## Estrutura do repositório

```text
.
├── server.ts           # API: banco, autenticação, rotas e entrega do front
├── request.http        # Testes da API (extensão REST Client)
├── render.yaml         # Blueprint de deploy no Render
├── .env.example        # Modelo das variáveis de ambiente
├── package.json        # Scripts e dependências do back-end
├── tsconfig.json
├── index.html          # Página estática das primeiras aulas (HTML + Tailwind)
├── COMO_RODAR.md       # Passo a passo de instalação e problemas comuns
├── QUESTIONARIO.md     # Autoavaliação do roteiro de front-end (Aula 10)
├── Diario_de_Classe/   # Um diário por aula + roteiro
└── web/                # Front-end React
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx      # Sessão: decide entre Login e Tarefas
        ├── Login.tsx    # Entrar / criar conta
        ├── Tarefas.tsx  # Lista, criação, busca, filtro e exclusão
        ├── api.ts       # Todas as chamadas para a API
        └── index.css
```

---

## Rotas da API

| Método | Rota | Protegida | Descrição |
|---|---|---|---|
| GET | `/api/health` | não | Verifica se a API e o banco respondem (`SELECT 1`) |
| GET | `/api/version` | não | Versão da aplicação |
| GET | `/api/db-check` | não | Tabelas e quantidade de registros, sem expor dados |
| POST | `/api/auth/register` | não | Cria uma conta |
| POST | `/api/auth/login` | não | Devolve o token JWT |
| GET | `/api/tasks?search=` | sim | Lista as tarefas do usuário |
| POST | `/api/tasks` | sim | Cria uma tarefa |
| PUT | `/api/tasks/:id` | sim | Atualiza a tarefa inteira |
| PATCH | `/api/tasks/:id` | sim | Atualiza só os campos enviados |
| DELETE | `/api/tasks/:id` | sim | Exclui a tarefa |

Rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>`.

---

## Como rodar

Pré-requisito: Node.js 20.12 ou superior.

```bash
# 1. Dependências (raiz e front)
npm install
npm --prefix web install

# 2. (Opcional) .env
#    copie .env.example para .env e preencha TURSO_URL / TURSO_TOKEN / JWT_SECRET
#    sem isso, o banco usado é o arquivo local tarefas.db

# 3a. Desenvolvimento: dois terminais
npm run dev        # API em http://localhost:3000
npm run dev:web    # Front em http://localhost:5173

# 3b. Produção local: tudo na porta 3000
npm run build      # instala o web/, gera o web/dist e confere os tipos
npm start          # abra http://localhost:3000
```

Usuário de teste criado automaticamente: `admin@senai.com` / `senha_super_secreta_123`.

O passo a passo completo, com os erros que já apareceram no Windows, está em [COMO_RODAR.md](COMO_RODAR.md).

---

## Deploy no Render

O arquivo [`render.yaml`](render.yaml) descreve o serviço (Infraestrutura como Código):

- **Build:** `npm install && npm run build`. Como o front tem o próprio `package.json` dentro de `web/`, o script `build` da raiz roda `npm --prefix web install` antes do Vite.
- **Start:** `npm start`
- **Health check:** `/api/health`
- **Variáveis:** `TURSO_URL` e `TURSO_TOKEN` são preenchidas no painel do Render. O `JWT_SECRET` é gerado pelo próprio Render.

O disco do plano grátis do Render é apagado a cada reinício, por isso em produção o banco precisa ser o Turso. Cada `git push origin main` dispara um novo deploy.

---

## Diários de classe

| Data | Diário | Tema |
|---|---|---|
| 07/10/2026 | [Diario07](Diario_de_Classe/Diario07.md) | Front-end com React |
| 09/10/2026 | [Diario09](Diario_de_Classe/Diario09.md) | Como funciona a API de Tarefas |
| 16/10/2026 | [Diario16](Diario_de_Classe/Diario16.md) | Deixando a API mais segura |
| 23/10/2026 | [Diario23](Diario_de_Classe/Diario23.md) | Organização do código e autenticação |
| 04/11/2026 | [Diario04-11](Diario_de_Classe/Diario04-11.md) | Aula 09: banco local ou na nuvem (Turso) |
| 18/11/2026 | [Diario18-11](Diario_de_Classe/Diario18-11.md) | Configurando o Node.js e o npm no Windows |
| 24/11/2026 | [Diario24-11](Diario_de_Classe/Diario24-11.md) | Aula 10: arquitetura, roteiro do front e deploy |

O [ROTEIRO.md](Diario_de_Classe/ROTEIRO.md) traz as perguntas-guia para escrever cada diário.

---

## Documentação complementar

| Documento | Conteúdo |
|---|---|
| [COMO_RODAR.md](COMO_RODAR.md) | Instalação, scripts, build, deploy e problemas comuns |
| [QUESTIONARIO.md](QUESTIONARIO.md) | Respostas comentadas do banco de questões do roteiro de front-end |
| [request.http](request.http) | Coleção de requisições para testar a API |

---

## Histórico de evolução

1. HTML semântico e Tailwind CSS (página estática de login e tarefas)
2. API REST com Express e rotas GET, POST, PUT, PATCH e DELETE
3. Persistência em SQLite e validações no back-end
4. Segurança: consultas parametrizadas e tratamento de erros
5. Autenticação com bcrypt + JWT e tarefas por usuário
6. Front-end em React com tela de login
7. CRUD completo de tarefas no front
8. Front servido pela própria API após o build
9. Migração para libSQL, com suporte ao Turso na nuvem
10. Filtro por prioridade, tratamento de sessão expirada, `/api/db-check` e deploy no Render

**Situação:** em desenvolvimento, evoluindo a cada aula.
