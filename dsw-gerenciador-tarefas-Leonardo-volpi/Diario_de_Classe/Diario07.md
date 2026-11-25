# Diário da aula — Front-end com React

Nesta aula comecei a interface do projeto usando **React + Vite + TypeScript**, dentro da pasta `web/`. O back-end já estava funcionando em `http://localhost:3000`, então o objetivo era criar a tela sem alterar as rotas da API.

## Primeiros passos

Antes de ir para o projeto principal, testei os conceitos em um app de prática (um botão que "liga e desliga a luz" usando `useState`). Isso ajudou a entender que o React redesenha a tela sempre que um estado muda.

Depois criei o projeto `web/` com o Vite, já com TypeScript, ESLint e Tailwind CSS.

## Como a tela ficou dividida

- `App.tsx` → decide qual tela mostrar: sem usuário, o **Login**; com usuário, as **Tarefas**;
- `Login.tsx` → formulário de entrar e criar conta;
- `Tarefas.tsx` → lista, criação, busca, concluir e excluir;
- `api.ts` → o único arquivo que faz `fetch` para a API.

Concentrar as chamadas no `api.ts` foi uma boa decisão: as telas não precisam saber o endereço da API nem montar cabeçalhos; só chamam `listarTarefas()`, `criarTarefa()` etc.

## Hooks usados

- **`useState`** → guarda o que aparece na tela (lista de tarefas, texto digitado, mensagens de erro, "carregando");
- **`useEffect`** → busca as tarefas quando a tela abre e quando o termo de busca muda;
- **`useRef`** → guarda valores que não precisam redesenhar a tela, como o número da última requisição.

## CORS

Em desenvolvimento o front roda em `localhost:5173` e a API em `localhost:3000`. Como são origens diferentes, o navegador bloqueava as requisições. Resolvi adicionando o pacote `cors` no `server.ts`.

## Lista de tarefas

As tarefas vindas da API são mostradas com `map()`, cada uma com o título, um selo colorido de prioridade (Baixa, Média, Alta) e os botões **Concluir/Reabrir** e **Excluir**. Quando não há tarefas, aparece uma mensagem de lista vazia.

## Dificuldades

A parte mais chata foi manter os tipos do front iguais ao que a API realmente devolve. Por exemplo, a API usa `low/medium/high`, então criei um dicionário para traduzir para português só na tela.

## Aprendizado

O React com Vite deixa a criação da interface rápida, e separar as chamadas de rede em um arquivo próprio deixa os componentes muito mais simples de ler.
