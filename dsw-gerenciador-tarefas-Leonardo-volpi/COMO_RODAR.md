# Como rodar o Gerenciador de Tarefas

## 1. Pré-requisitos

- **Node.js 20.12 ou superior** (o `server.ts` usa o `process.loadEnvFile`)
- **npm 9 ou superior**

Para conferir:

```bash
node -v
npm -v
```

> No Windows, se aparecer "O termo 'npm' não é reconhecido" ou "a execução de scripts foi desabilitada", veja a seção [Problemas comuns](#7-problemas-comuns) e o [Diario18-11](Diario_de_Classe/Diario18-11.md).

---

## 2. Instalar as dependências

O projeto tem **dois** `package.json`: um na raiz (back-end) e outro em `web/` (front-end).

```bash
# na raiz do projeto
npm install
npm --prefix web install
```

---

## 3. Variáveis de ambiente (opcional)

Sem `.env`, o servidor cria sozinho o arquivo `tarefas.db` na raiz e usa SQLite local.

Para usar o Turso ou trocar o segredo do JWT:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
# Linux / macOS
cp .env.example .env
```

E preencha:

```env
TURSO_URL=libsql://seu-banco.turso.io
TURSO_TOKEN=seu-token
JWT_SECRET=um-valor-longo-e-aleatorio
PORT=3000
```

- `TURSO_URL` e `TURSO_TOKEN` precisam estar **os dois** preenchidos, senão o servidor continua no SQLite local.
- Salve o `.env` em **UTF-8 sem BOM**. Com BOM a primeira variável é ignorada (o servidor avisa no terminal).
- O `.env` está no `.gitignore` e **não vai para o GitHub**.

---

## 4. Desenvolvimento (dois terminais)

**Terminal 1, API:**

```bash
npm run dev
```

- API em `http://localhost:3000`
- `tsx watch` reinicia sozinho quando o `server.ts` muda

**Terminal 2, front-end:**

```bash
npm run dev:web
```

- Front (Vite) em `http://localhost:5173`
- O `api.ts` chama `http://localhost:3000` direto (o servidor libera o CORS). Não tem proxy no `vite.config.ts`.

---

## 5. Produção local (uma porta só)

```bash
npm run build
npm start
```

O `npm run build` faz três coisas em sequência:

1. `npm --prefix web install`: garante as dependências do Vite
2. `npm run build:web`: gera o `web/dist/`
3. `tsc`: confere os tipos do `server.ts`

Depois o `npm start` sobe a API e entrega o front em `http://localhost:3000`.

> Se mudar algo em `web/src` e esquecer de rodar o build, o servidor avisa no terminal que o build está desatualizado.

---

## 6. Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | API com reinício automático (`tsx watch`) |
| `npm start` | API uma vez (`tsx server.ts`) |
| `npm run build` | Instala o `web/`, gera o build do front e confere os tipos |
| `npm run build:web` | Só o build do front |
| `npm run dev:web` | Só o front em modo dev (Vite) |

### Rotas para conferir se está tudo de pé

- `http://localhost:3000/api/health`: API e banco respondendo
- `http://localhost:3000/api/db-check`: tabelas e quantidade de registros
- `http://localhost:3000/api/version`: versão

Usuário de teste: `admin@senai.com` / `senha_super_secreta_123`.

---

## 7. Problemas comuns

| Problema | Solução |
|---|---|
| `npm` não é reconhecido (Windows) | Feche e abra o VS Code inteiro depois de instalar o Node |
| Execução de scripts desabilitada (Windows) | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Aviso do `esbuild` na instalação | `npm install-scripts approve esbuild` e depois `npm rebuild esbuild` |
| `tsx: not found` | Rode `npm install` na raiz |
| Porta 3000 ocupada | Mude `PORT` no `.env` |
| Tela "O build do front-end ainda não foi gerado" | Rode `npm run build:web` |
| Erro 500 no cadastro com banco antigo | O servidor migra bancos antigos sozinho. Se ainda der erro, renomeie o `tarefas.db` para ele ser recriado |
| Volta para o login com "Sua sessão expirou" | O token venceu (7 dias) ou o `JWT_SECRET` mudou. É só entrar de novo |
| Turso responde 404 | URL ou token errados. Confira se a `TURSO_URL` não tem barra no final |

---

## 8. Deploy no Render

1. Suba o projeto para o GitHub.
2. No Render, crie um **Blueprint** apontando para o repositório. Ele lê o `render.yaml`.
3. Preencha `TURSO_URL` e `TURSO_TOKEN` no painel (o `JWT_SECRET` é gerado sozinho).
4. A partir daí, cada `git push origin main` faz um novo deploy.
