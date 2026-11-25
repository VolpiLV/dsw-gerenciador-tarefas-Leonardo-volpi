# Questionário: Roteiro de Estudos Front-End React & TypeScript

DSW, Aula 10. Respostas do banco de questões do roteiro, explicadas com o código deste repositório (`web/src/`).

---

## Questão 1: Arquitetura de componentes

**Por que o `clearToken()` é executado no `App.tsx` e não direto no botão "Sair" do `Tarefas.tsx`?**

**Resposta: B.** Pela responsabilidade única: o `App` cuida da sessão e é o único lugar que apaga a credencial.

No meu código o `App` guarda o estado `usuario` e decide qual tela mostrar. O `Tarefas` recebe a função `aoSair` por props e só chama ela:

```tsx
// App.tsx
const aoSair = useCallback((mensagem = ""): void => {
  clearToken();
  setAviso(mensagem);
  setUsuario(null);
}, []);
```

Se o `Tarefas` apagasse o token sozinho, o `localStorage` ficaria vazio, mas o `usuario` do `App` continuaria preenchido, e a tela não voltaria para o login. As outras alternativas estão erradas: qualquer componente pode acessar o `localStorage`, filhos podem chamar funções assíncronas e o TypeScript não proíbe exportar funções.

---

## Questão 2: Desempenho com `useState`

**Qual a vantagem de `useState(() => getUsuario())` em vez de `useState(getUsuario())`?**

**Resposta: B.** Lazy initialization: a leitura do `localStorage` e a decodificação do token acontecem só uma vez, na montagem.

Com `useState(getUsuario())` a função roda **em todo render** do `App`. O React descarta o resultado porque o estado já existe, mas o trabalho (ler o storage, separar o JWT, decodificar Base64, `JSON.parse`) é feito toda vez. Passando a função, o React entende que é uma "fábrica" e chama só no primeiro render.

---

## Questão 3: Debounce e cleanup

**Para que serve a função retornada dentro do `useEffect` na busca com debounce?**

**Resposta: A.** Para cancelar o `setTimeout` anterior se a pessoa continuar digitando antes dos 400 ms.

```tsx
// Tarefas.tsx
useEffect(() => {
  const timer = setTimeout(() => { /* aplica a busca */ }, DEBOUNCE_MS);
  return () => clearTimeout(timer);
}, [busca]);
```

A cada tecla o `busca` muda e o efeito roda de novo. Antes disso o React executa a limpeza do efeito anterior, que mata o timer velho. Só o último timer sobrevive, então digitar "comprar" manda **1** requisição em vez de 7.

---

## Questão 4: Concorrência com `useRef`

**Por que o `requisicaoAtual` usa `useRef(0)` e não `useState(0)`?**

**Resposta: B.** Alterar um ref não dispara render, e o valor atual pode ser lido a qualquer momento para descartar respostas fora de ordem.

```tsx
const meuId = ++requisicaoAtual.current;
const dados = await listarTarefas(buscaAplicada);
if (meuId !== requisicaoAtual.current) return; // chegou atrasada, descarta
setTarefas(dados);
```

Dois motivos para não ser `useState`:

1. O contador é controle interno, não aparece na tela. Com `useState` cada incremento causaria um render à toa.
2. O callback assíncrono veria o valor **capturado na closure** do render em que foi criado (stale closure), e a comparação nunca funcionaria. O `ref.current` é sempre o valor de agora.

---

## Questão 5: Formulários no React

**Qual o impacto de não usar `e.preventDefault()` no `onSubmit` de um formulário em uma SPA?**

**Resposta: B.** O navegador recarrega a página inteira e todo o estado em memória se perde.

O comportamento padrão do `<form>` no HTML é enviar os dados e carregar uma página nova. Numa SPA isso derruba o React: os campos voltam vazios, a lista some e a requisição do `fetch` é interrompida no meio. Por isso o `Login.tsx` e o `criar` do `Tarefas.tsx` começam com `e.preventDefault()`.

---

## Onde cada conceito do roteiro aparece no código

| Conceito | Arquivo | Trecho |
|---|---|---|
| Lifting State Up | `App.tsx` | `aoLogar` / `aoSair` passados por props |
| Lazy initialization | `App.tsx` | `useState(() => getUsuario())` |
| Estado derivado | `App.tsx` | `const logado = usuario !== null` |
| Debounce + cleanup | `Tarefas.tsx` | `setTimeout` / `clearTimeout` com `busca` e `buscaAplicada` |
| `useCallback` | `Tarefas.tsx` | `carregar`, `tratarErro`, `fecharModal` |
| Race condition com `useRef` | `Tarefas.tsx` | `requisicaoAtual` |
| Derivação com `useMemo` | `Tarefas.tsx` | `tarefasFiltradas` (filtro por prioridade) |
| Componentes controlados | `Login.tsx`, `Tarefas.tsx` | `value` + `onChange` em todos os inputs |
| Ambiente dinâmico | `api.ts` | `API_BASE = import.meta.env.DEV ? "http://localhost:3000" : ""` |
| Interceptor (Bearer) | `api.ts` | `requisitar()` anexa o `Authorization` |
| Sessão expirada (401) | `api.ts` + `Tarefas.tsx` | `SessaoExpiradaError` limpa o token e volta ao login com aviso |
| Tipos derivados | `api.ts` | `type Prioridade = Tarefa["prioridade"]` |
| Dicionário tipado | `Tarefas.tsx` | `PRIORIDADES_PT: Record<Prioridade, string>` |
| Feedback visual | `Login.tsx`, `Tarefas.tsx` | spinner e `disabled={carregando}` / `disabled={criando}` |
| Cores semânticas | `Tarefas.tsx` | `COR_PRIORIDADE`: verde baixa, amarelo média, vermelho alta |
