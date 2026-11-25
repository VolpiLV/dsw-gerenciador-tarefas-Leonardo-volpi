# Diário de Classe — Deixando a API mais segura

## O que a atividade pedia

O foco da aula foi proteger a API contra dados errados ou mal-intencionados. A ideia central é que o servidor **não pode acreditar** no que o usuário manda: tudo precisa ser conferido antes de chegar no banco.

Antes de mexer no código, li o `server.ts` inteiro para ver o que já estava certo e o que faltava. Algumas validações já existiam; o trabalho foi completar e padronizar.

## Validação dos dados

Criei funções pequenas, cada uma com uma responsabilidade:

- `ehTituloValido` → o título precisa ser texto e ter pelo menos 3 caracteres;
- `ehPrioridade` e `ehStatus` → só aceitam os valores das listas permitidas;
- `lerId` → transforma o ID da URL em número e recusa coisas como `"abc"`.

Com isso, se alguém mandar `"titulo": 123` ou `"status": "cancelled"`, a API responde **400** e nem tenta mexer no banco.

No `PATCH` usei uma classe `ErroValidacao`. Quando um campo é inválido, eu lanço esse erro e, no `catch`, consigo diferenciar um erro do usuário (400) de um erro do servidor (500).

## Consultas seguras

Todas as consultas usam `?` no lugar dos valores:

```ts
db.execute({ sql: "DELETE FROM tarefas WHERE id = ? AND usuario_id = ?", args: [id, usuarioId] });
```

Assim o valor nunca é "colado" dentro do SQL, e um texto como `' UNION SELECT ... --` é tratado como texto comum. Testei isso no `request.http` e a busca simplesmente não encontrou nada.

No `PATCH` o SQL é montado dinamicamente, mas só com os **nomes de coluna** que eu mesmo escrevi (`titulo = ?`, `status = ?`). Os valores continuam indo separados.

## Tratamento de erros

As mensagens de erro são genéricas, como "Erro ao salvar a tarefa.", e não mostram detalhes do banco. Mostrar o erro original poderia revelar nomes de tabelas e colunas para quem quisesse atacar.

A porta também ficou configurável por variável de ambiente (`PORT`).

## Testes

No `request.http` adicionei casos que devem falhar:

- título com 2 letras e título numérico;
- prioridade e status fora da lista;
- ID com letras (`/api/tasks/abc`);
- corpo vazio no `PATCH`;
- tentativa de SQL Injection na busca.

## Conclusão

Entendi que segurança não é uma parte extra do projeto: ela está em cada rota. Validar a entrada e usar consultas parametrizadas são as duas práticas que mais evitam problemas.
