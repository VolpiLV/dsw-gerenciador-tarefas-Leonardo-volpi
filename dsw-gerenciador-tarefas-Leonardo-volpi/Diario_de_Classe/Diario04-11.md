## Atualização da Aula 09: banco local ou na nuvem (Turso)

O servidor passou a usar o **`@libsql/client`** no lugar do `better-sqlite3`. As rotas continuam exatamente as mesmas, então o front-end não precisou de nenhuma alteração.

- **Sem configuração**, os dados ficam no arquivo local `tarefas.db`.
- **Para usar o Turso**, copie `.env.example` para `.env` e preencha `TURSO_URL` e `TURSO_TOKEN` (os dois juntos).
- `JWT_SECRET` é opcional em desenvolvimento, mas em produção precisa ser um valor forte.
- O `.env` **não vai para o GitHub** (está no `.gitignore`), porque guarda o token de acesso ao banco.

### O que mudou no código

- As consultas viraram `async/await`, porque o banco pode estar na internet e a resposta demora.
- O `/api/health` agora testa o banco com um `SELECT 1` e informa qual modo está em uso.
- O servidor só começa a escutar a porta depois que o banco está pronto (`prepararBanco()`).
- A função `migrarBancoAntigo()` atualiza bancos criados nas aulas anteriores: renomeia `senha` para `senha_hash`, criptografa senhas que estavam em texto puro e cria as colunas de data que faltavam, sem apagar usuários nem tarefas.

### Front servido pela API

Depois do build, a pasta `web/dist` é entregue pelo próprio `server.ts`. Assim tudo roda na porta 3000. Qualquer rota `/api` que não existir responde um 404 em JSON, e as outras rotas abrem o React.

### Como executar o projeto completo

```bash
npm install
npm --prefix web install
npm run build
npm run build:web
npm start
```

Depois é só abrir `http://localhost:3000` para usar a aplicação e `http://localhost:3000/api/health` para conferir a API e o banco. Os testes das rotas estão no `request.http` (extensão REST Client do VS Code).
