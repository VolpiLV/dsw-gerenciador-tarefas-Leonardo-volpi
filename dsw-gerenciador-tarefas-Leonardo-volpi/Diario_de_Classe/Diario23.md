# Diário de Classe — Organização do código e autenticação

## O problema

Com cada aula o `server.ts` foi crescendo: configuração, tipos, validações, SQL e rotas, tudo misturado. Ficava difícil achar onde estava cada coisa.

## Como organizei

Separei o arquivo em blocos bem definidos, com um título de seção para cada um:

```text
server.ts
├── Configuração geral      (porta, JWT_SECRET, .env)
├── Tipos e regras          (Tarefa, Usuario, validações)
├── Banco de dados          (criação das tabelas e migração)
├── repo                    (todas as consultas SQL)
├── Middlewares             (cors, json, exigirLogin)
├── Rotas públicas          (health, version, register, login)
├── Rotas de tarefas        (CRUD protegido)
├── Front-end               (entrega do build do React)
└── Inicialização
```

A mudança mais útil foi o objeto **`repo`**. As rotas não escrevem SQL; elas chamam `repo.criarTarefa(...)`, `repo.listarTarefas(...)` e assim por diante. Se a consulta mudar, mexo só no `repo`.

## Autenticação

Nessa etapa as tarefas passaram a ter dono.

**Cadastro (`/api/auth/register`)**
- valida e-mail (precisa ter `@`) e senha (mínimo 6 caracteres);
- a senha é transformada em hash com **bcrypt** antes de ir para o banco;
- e-mail repetido devolve **409**.

**Login (`/api/auth/login`)**
- busca o usuário pelo e-mail e compara a senha com o hash;
- se estiver certo, gera um **token JWT** válido por 8 horas;
- mesmo quando o e-mail não existe, o bcrypt compara com um hash falso, para o tempo de resposta não revelar quais e-mails estão cadastrados.

**Middleware `exigirLogin`**
- lê o cabeçalho `Authorization: Bearer <token>`;
- confere a assinatura do token e coloca o `usuarioId` na requisição;
- sem token ou com token inválido, devolve **401**.

Todas as consultas de tarefas usam `WHERE usuario_id = ?`, então um usuário nunca vê nem altera as tarefas de outro. Se tentar acessar o ID de uma tarefa que não é sua, recebe **404**, como se ela não existisse.

## O que continuou funcionando

- `GET /api/health` e `GET /api/version`;
- todo o CRUD em `/api/tasks`, agora protegido;
- as validações de título, prioridade, status e ID.

## Como rodar

```bash
npm run dev     # desenvolvimento, reinicia sozinho ao salvar
npm start       # execução normal
npm run build   # confere os tipos do TypeScript
```

## Conclusão

Organizar o código não é só deixar bonito: com cada coisa no seu lugar, ficou muito mais rápido encontrar e corrigir problemas. E a autenticação fez o projeto virar, de fato, multi-usuário.
