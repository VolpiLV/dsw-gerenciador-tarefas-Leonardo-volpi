# Roteiro para os Diários de Classe

Use este roteiro para escrever **um diário por aula**, com as suas palavras.
Cada seção tem: o tema, onde olhar no código e perguntas para guiar o texto.
Não precisa responder todas, escolha as que fizerem sentido para você.

> Dica: um bom diário conta **o que foi feito**, **por que foi feito**, **o que deu errado / foi difícil** e **o que você aprendeu**.

Sugestão de nome dos arquivos: `Diario_AAAA-MM-DD.md` ou `Diario_AulaXX.md`.

---

## Modelo base (copie para cada aula)

```markdown
# Diário — Aula XX: <tema>

**Data:** __/__/____

## O que foi feito
## Por que isso é importante
## Dificuldades
## O que aprendi
```

---

## 1. Rotas da API (GET, POST, PUT, PATCH, DELETE)

**Onde olhar:** `server.ts` (seção "Rotas de tarefas") e `request.http`.

- O que é uma API REST, explicado com as suas palavras?
- Qual a diferença entre **PUT** e **PATCH**? Dê um exemplo do projeto.
- O que significam os códigos 200, 201, 400, 404 e 500? Quando cada um aparece?
- Como você testou as rotas? (REST Client / `request.http`)

## 2. Validações e segurança no back-end

**Onde olhar:** funções `ehTituloValido`, `ehPrioridade`, `ehStatus`, `lerId` em `server.ts`.

- Por que o back-end não pode confiar nos dados que chegam do usuário?
- O que acontece se alguém mandar um título com 2 letras? E um número no lugar do título?
- O que é **SQL Injection**? Como os `?` nas consultas protegem contra isso?
- Teste o caso de SQL Injection do `request.http`. O que aconteceu?
- Por que as mensagens de erro são genéricas (não mostram detalhes do banco)?

## 3. Autenticação (bcrypt + JWT)

**Onde olhar:** rotas `/api/auth/register`, `/api/auth/login` e middleware `exigirLogin`.

- Por que a senha não é salva em texto puro? O que o bcrypt faz?
- O que é um token JWT e o que vai dentro dele?
- O que o middleware faz antes de deixar a requisição chegar na rota?
- Como o projeto garante que um usuário não vê as tarefas de outro? (`usuario_id`)
- Teste acessar `/api/tasks` sem token. Qual foi a resposta?

## 4. Introdução ao React

**Onde olhar:** `web/src/main.tsx`, `web/src/App.tsx`.

- O que é um componente? Quais componentes o projeto tem?
- Para que serve o `useState`? O que acontece se usar uma variável comum no lugar?
- Para que serve o `useEffect`?
- Por que foi preciso configurar o **CORS** no servidor?

## 5. Tela de Login

**Onde olhar:** `web/src/Login.tsx` e `web/src/api.ts`.

- Como uma única tela faz login **e** cadastro? (estado `modo`)
- Por que o `e.preventDefault()` é necessário no formulário?
- Por que o botão "Não tem conta? Registre-se" precisa de `type="button"`?
- Onde o token fica guardado no navegador? O que o botão "Sair" faz com ele?
- Por que validar no front se o back já valida?

## 6. CRUD de tarefas no front

**Onde olhar:** `web/src/Tarefas.tsx`.

- Como a lista é carregada quando a tela abre?
- O que é o **debounce** na busca e qual problema ele evita?
- Como funcionam os botões Concluir/Reabrir e Excluir?
- Por que existe um modal de confirmação antes de excluir?
- O que foi mais difícil nessa parte?

## 7. Servindo o front pela API (build)

**Onde olhar:** final do `server.ts` (seção "Front-end") e scripts do `package.json`.

- O que o `npm run build:web` gera e onde fica?
- Qual a vantagem de front e API rodarem na mesma porta (3000)?
- Por que o `api.ts` usa um endereço em desenvolvimento e outro depois do build?
- Por que a pasta `web/dist` não vai para o GitHub (`.gitignore`)?

## 8. Banco na nuvem com libSQL / Turso

**Onde olhar:** seção "Banco de dados" do `server.ts` e `.env.example`.

- Qual a diferença entre o SQLite local (`tarefas.db`) e o Turso?
- Para que serve o arquivo `.env`? Por que ele **nunca** deve ir para o GitHub?
- O que o `/api/health` mostra agora sobre o banco?
- Por que as rotas passaram a usar `async/await`?

## 9. Tailwind CSS

**Onde olhar:** classes `className` em `Login.tsx` e `Tarefas.tsx`.

- Qual a vantagem do Tailwind em relação a um arquivo `.css` tradicional? E a desvantagem?
- Escolha uma classe (ex.: `bg-emerald-600`, `rounded-md`, `px-4`) e explique o que ela faz.

## 10. Organização do projeto e Git

- O que mudou na organização do repositório ao longo das aulas?
- Por que arquivos antigos (`aula_react/`, desafio etc.) foram removidos?
- O que você aprendeu sobre commits, push e pull? (vale contar as dificuldades 😄)

---

### Checklist antes de publicar cada diário

- [ ] Está com as minhas palavras
- [ ] Explica o que foi feito **e** o porquê
- [ ] Cita pelo menos um arquivo ou trecho do projeto
- [ ] Tem pelo menos uma dificuldade ou aprendizado pessoal
