# 📒 Anotações — Como funciona a API de Tarefas

## Visão geral

O `server.ts` é o **back-end** do projeto. Ele recebe requisições HTTP do navegador (ou do REST Client), conversa com o banco de dados e devolve as respostas sempre em **JSON**.

Ferramentas usadas:
- **Express** → cria o servidor e as rotas
- **TypeScript** → adiciona tipos ao JavaScript e acusa erros antes de rodar
- **SQLite** → banco de dados guardado em um arquivo (`tarefas.db`)

---

## 🗂️ Como o arquivo está dividido

1. Configuração (porta, segredo do JWT, `.env`)
2. Tipos e regras de negócio
3. Banco de dados (criação das tabelas)
4. Consultas prontas (objeto `repo`)
5. Middlewares
6. Rotas
7. Inicialização do servidor

---

## 1) Tipos

```ts
type Prioridade = "low" | "medium" | "high";
type Status = "pending" | "completed";
```

Esses tipos vêm direto das listas `PRIORIDADES` e `STATUS_VALIDOS`. Se um dia eu incluir uma prioridade nova na lista, o tipo acompanha sozinho.

> 💡 Os tipos só existem para o TypeScript. Quando o código roda, quem protege de verdade são as funções de validação.

---

## 2) Funções de validação

| Função | O que faz |
|---|---|
| `ehTituloValido()` | Aceita só texto com pelo menos 3 caracteres (sem contar espaços) |
| `ehPrioridade()` | Confere se o valor é `low`, `medium` ou `high` |
| `ehStatus()` | Confere se o valor é `pending` ou `completed` |
| `prioridadeOuPadrao()` | Se a prioridade for inválida, usa `medium` |
| `statusOuPadrao()` | Se o status for inválido, usa `pending` |
| `lerId()` | Transforma o `:id` da URL em número; `"abc"` vira `null` |

> A regra é simples: **nada que vem do usuário entra no banco sem passar por uma dessas funções.**

---

## 3) Banco de dados

O servidor cria as tabelas sozinho se elas não existirem:

```
usuarios → id, email, senha_hash, criado_em
tarefas  → id, usuario_id, titulo, descricao, status, prioridade, criado_em, atualizado_em
```

O campo `usuario_id` liga cada tarefa ao seu dono. Também é criado um usuário de teste (`admin@senai.com`), já com a senha criptografada.

---

## 4) Consultas prontas (`repo`)

Todas as consultas ficam juntas no objeto `repo` (`listarTarefas`, `criarTarefa`, `excluirTarefa`, `usuarioPorEmail`...). Assim as rotas não ficam cheias de SQL e, se uma consulta mudar, só mexo em um lugar.

Todas usam `?` no lugar dos valores, o que **protege contra SQL Injection**.

---

## 5) Rotas

| Método | Rota | O que faz |
|---|---|---|
| `GET` | `/api/health` | Mostra se o servidor e o banco estão funcionando |
| `GET` | `/api/version` | Mostra a versão |
| `POST` | `/api/auth/register` | Cadastra um usuário |
| `POST` | `/api/auth/login` | Faz login e devolve um token |
| `GET` | `/api/tasks` | Lista as tarefas (aceita `?search=`) |
| `POST` | `/api/tasks` | Cria uma tarefa |
| `PUT` | `/api/tasks/:id` | Substitui a tarefa inteira |
| `PATCH` | `/api/tasks/:id` | Muda só os campos enviados |
| `DELETE` | `/api/tasks/:id` | Apaga a tarefa |

### PUT x PATCH
- **PUT** → mando a tarefa completa; o título é obrigatório.
- **PATCH** → mando só o que quero trocar, por exemplo só `{ "status": "completed" }`.

### Códigos de resposta
- `200` / `201` → deu certo (201 = algo foi criado)
- `400` → dado inválido
- `401` → sem login ou token inválido
- `404` → tarefa não encontrada
- `409` → e-mail já cadastrado
- `500` → erro interno

---

## 6) Inicialização

```ts
await prepararBanco();
app.listen(PORT, ...);
```

O servidor só começa a aceitar requisições **depois** que o banco está pronto. A porta padrão é a `3000`.

---

## 🧠 Resumo
> Uma API de tarefas com CRUD completo, validação de tudo que chega e banco SQLite guardando os dados de cada usuário separadamente.
