# Gerenciador de Tarefas

Projeto da disciplina de Desenvolvimento de Sistemas Web (DSW).

**Estudante:** Leonardo Volpi

## Objetivo do Projeto

Desenvolver um gerenciador de tarefas completo e multi-usuário: cada pessoa cria a sua conta, faz login e enxerga apenas as próprias tarefas.

## Status Atual

Em desenvolvimento, evoluindo a cada aula. Hoje o projeto já tem:

- API REST em Node + Express + TypeScript
- Cadastro e login com senha criptografada (bcrypt) e sessão via token JWT
- CRUD de tarefas protegido por autenticação e isolado por usuário
- Banco SQLite local ou Turso (nuvem) usando o cliente libSQL
- Front-end em React + TypeScript + Tailwind CSS (Vite)
- Front servido pela própria API depois do build (uma única porta)

## Recursos Implementados

**Back-end (`server.ts`)**
- Validação de título (mínimo 3 caracteres), prioridade (`low`, `medium`, `high`) e status (`pending`, `completed`)
- Consultas sempre parametrizadas (`?`), protegendo contra SQL Injection
- Mensagens de erro genéricas, sem expor detalhes do banco
- Migração automática de bancos criados nas aulas anteriores

**Front-end (`web/`)**
- Tela de login e cadastro na mesma página
- Lista de tarefas com contador de pendentes e concluídas
- Criação de tarefa com prioridade (padrão: Alta)
- Busca por título com debounce
- Concluir / reabrir tarefa
- Exclusão com modal de confirmação (fecha com Esc)

## Tecnologias Utilizadas

- TypeScript, Node.js, Express 5
- libSQL (`@libsql/client`) — SQLite local ou Turso
- bcryptjs e jsonwebtoken
- React 19, Vite, Tailwind CSS 4
- ESLint
- Git e GitHub

## Estrutura do Projeto

```text
.
├── server.ts           # API: banco, autenticação, rotas e entrega do front
├── request.http        # Testes da API (extensão REST Client)
├── .env.example        # Modelo das variáveis de ambiente
├── package.json        # Scripts e dependências do back-end
├── tsconfig.json
├── index.html          # Página estática das primeiras aulas (HTML + Tailwind)
└── web/                # Front-end React
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx      # Decide entre Login e Tarefas
        ├── Login.tsx    # Entrar / criar conta
        ├── Tarefas.tsx  # Lista, criação, busca e exclusão
        ├── api.ts       # Todas as chamadas para a API
        └── index.css
```

## Rotas da API

| Método | Rota | Protegida | Descrição |
|---|---|---|---|
| GET | `/api/health` | não | Verifica se a API e o banco estão respondendo |
| GET | `/api/version` | não | Versão da aplicação |
| POST | `/api/auth/register` | não | Cria uma conta |
| POST | `/api/auth/login` | não | Devolve o token JWT |
| GET | `/api/tasks?search=` | sim | Lista as tarefas do usuário |
| POST | `/api/tasks` | sim | Cria uma tarefa |
| PUT | `/api/tasks/:id` | sim | Atualiza a tarefa inteira |
| PATCH | `/api/tasks/:id` | sim | Atualiza só os campos enviados |
| DELETE | `/api/tasks/:id` | sim | Exclui a tarefa |

Rotas protegidas exigem o cabeçalho `Authorization: Bearer <token>`.

## Como Rodar

Pré-requisito: Node.js 20.12 ou superior.

```bash
# 1. Dependências (raiz e front)
npm install
npm --prefix web install

# 2. (Opcional) configurar o .env
#    copie .env.example para .env e preencha TURSO_URL / TURSO_TOKEN / JWT_SECRET
#    sem isso, o banco usado é o arquivo local tarefas.db

# 3a. Desenvolvimento: dois terminais
npm run dev        # API em http://localhost:3000
npm run dev:web    # Front em http://localhost:5173

# 3b. Tudo junto na porta 3000
npm run build:web
npm start          # abra http://localhost:3000
```

Usuário de teste criado automaticamente: `admin@senai.com` / `senha_super_secreta_123`.

## Histórico de Evolução

1. HTML semântico e Tailwind CSS (página estática de login e tarefas)
2. API REST com Express e rotas GET, POST, PUT, PATCH e DELETE
3. Persistência em SQLite e validações no back-end
4. Segurança: consultas parametrizadas e tratamento de erros
5. Autenticação com bcrypt + JWT e tarefas por usuário
6. Front-end em React com tela de login
7. CRUD completo de tarefas no front
8. Front servido pela própria API após o build
9. Migração para libSQL, com suporte ao Turso na nuvem
