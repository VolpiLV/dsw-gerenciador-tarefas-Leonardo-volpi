# Diário de Classe: Aula 10, arquitetura, roteiro do front e deploy

**Data:** 24/11/2026

## O que foi feito

O professor passou dois materiais: uma **apresentação técnica** com as decisões de arquitetura do projeto inteiro (front, API, segurança, banco e deploy) e um **roteiro de estudos do front-end** com um banco de questões no final. A ideia era conferir se o meu projeto seguia tudo o que estava ali e ajustar o que faltava.

Fui lendo item por item e comparando com o meu código. Muita coisa já estava certa, mas alguns pontos estavam diferentes ou faltando:

**No back-end (`server.ts`)**
- Criei a rota **`/api/db-check`**, que confirma a conexão e mostra as tabelas e quantos registros cada uma tem, sem mostrar nenhum dado de verdade (e-mail, senha, tarefa).
- O token JWT passou a valer **7 dias**, igual na apresentação.
- O banner do terminal agora mostra onde o banco está e se tem token do Turso (sem mostrar o token).

**No `package.json` e deploy**
- O script `build` virou `npm --prefix web install && npm run build:web && tsc`. Isso resolve o problema do monorepo: o front tem o próprio `package.json` dentro de `web/`, e sem instalar ele primeiro o build quebra na nuvem.
- Criei o **`render.yaml`**, o Blueprint do Render, que descreve o serviço: comando de build, de start, health check e as variáveis de ambiente.

**No front-end (`web/src`)**
- Renomeei as variáveis e funções para os nomes do roteiro (`getUsuario`, `clearToken`, `aoLogar`, `buscaAplicada`, `requisicaoAtual`, `carregar`, `PRIORIDADES_PT`). Assim fica mais fácil achar no código o que o professor explica.
- O `App.tsx` ficou com o `useState(() => getUsuario())` e o `const logado = usuario !== null` bem visíveis.
- O `api.ts` ganhou o **tratamento de sessão expirada**: se a API responder 401 numa rota privada, o token é apagado e a pessoa volta para o login com o aviso "Sua sessão expirou".
- A interface `Tarefa` agora tem o contrato completo (com `usuario_id`, `descricao`, `criado_em` e `atualizado_em`), e os tipos `Prioridade` e `Status` são derivados dela.
- Coloquei o **filtro por prioridade** com chips (Todas, Baixa, Média, Alta), feito com `useMemo` e sem chamar a API.
- As cores dos badges seguem o roteiro: **verde** para baixa, **amarelo** para média e **vermelho** para alta.
- Spinner no botão e na lista enquanto carrega, e barra de progresso das tarefas concluídas.
- A prioridade padrão de uma tarefa nova voltou a ser **Média**, igual no back.

**Documentação**
- Atualizei o `README.md` com a arquitetura, as rotas e o deploy.
- Criei o `COMO_RODAR.md` e o `QUESTIONARIO.md` com as respostas comentadas das 5 questões do roteiro.

## Por que isso é importante

A apresentação mostra que o projeto não é só "uma tela que lista tarefas". Cada decisão tem um motivo: o bcrypt protege a senha mesmo se o banco vazar, o JWT deixa o servidor sem guardar sessão, o `usuario_id` vindo do token impede um usuário de mexer na tarefa do outro (IDOR) e o Turso existe porque o disco grátis do Render é apagado a cada reinício.

Entender esses motivos é o que faz diferença na hora de apresentar o projeto ou de responder questão de prova.

## Dificuldades

- O **lint** reclamou do `useEffect` que chamava o `carregar()` direto ("Avoid calling setState() directly within an effect"). Tive que reescrever o efeito de carga usando `.then` e uma variável `ativo` para ignorar a resposta se a busca mudar no meio do caminho.
- Pensar em **quando** um 401 é sessão expirada. No login, 401 significa senha errada, então o aviso de sessão só pode aparecer quando a requisição foi feita **com** token.
- Como o `carregar` passou a depender do `aoSair` (para tratar o 401), precisei colocar o `aoSair` dentro de um `useCallback` no `App`, senão a função mudaria a cada render.

## O que aprendi

- **Roteamento híbrido:** o mesmo Express serve a API em `/api/*`, os arquivos do `web/dist` e manda o `index.html` para qualquer outra rota.
- **IDOR:** se a API só usasse o id da URL, bastaria trocar o número para apagar a tarefa de outra pessoa. Colocar `AND usuario_id = ?` em toda consulta resolve.
- **Infraestrutura como Código:** o `render.yaml` deixa a configuração da nuvem versionada junto com o código.
- **`useRef` x `useState`:** ref é para valor que muda sem precisar redesenhar a tela, como o contador de requisições.
- **`useMemo`:** quando dá para calcular um valor a partir do estado, não precisa criar outro estado.
