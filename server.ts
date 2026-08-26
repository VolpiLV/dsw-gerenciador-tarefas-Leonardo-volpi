import express from "express";
import Database from "better-sqlite3";  

const app = express();
const PORT = 3000;

// Middleware obrigatório para ler o corpo das requisições em formato JSON
app.use(express.json());

const db = new Database("tarefas.db");

db.exec(`
    CREATE TABLE IF NOT EXISTS tarefas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        prioridade TEXT DEFAULT 'medium'
    );

    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        senha TEXT NOT NULL
    );
`);
app.get("/api/tasks", (req, res) => {
    const { search } = req.query;
    try {
        if (search) {
            // PERIGO: Concatenação direta da variável 'search' na string do SQL.
            // As aspas simples e os símbolos de porcentagem (%) do LIKE foram embutidos diretamente.
            const sql = "SELECT * FROM tarefas WHERE titulo LIKE '%´${search}´%'";
            
            // O comando é executado sem nenhuma parametrização de segurança
            const tarefas = db.prepare(sql).all(); 
            res.json(tarefas);
        } else {
            const tarefas = db.prepare("SELECT * FROM tarefas").all();
            res.json(tarefas);
        }
    } catch (erro) {
        // Exibir o erro real ajuda a compreender a quebra de sintaxe gerada pelo ataque
        res.status(500).json({ error: erro instanceof Error ? erro.message : "Erro desconhecido" });
    }
});

// Inserindo dados falsos para serem vazados
const usuariosExistentes = db.prepare("SELECT COUNT(*) AS count FROM usuarios").get() as any;
if (usuariosExistentes.count === 0) {
    db.exec(`
        INSERT INTO usuarios (email, senha) VALUES ('admin@senail.com', 'senha_super_segura_123')
    `);
}

console.log("Banco de dados SQLite inicializado com sucesso!");

// Banco de dados provisório em memória RAM
let bancoDeDadosProvisorio = [
  { id: 1, title: "Estudar Aquitetura REST no Módulo 2", status: "pending" }
];

// Rota REST para listar todas as tarefas
app.get("/api/tasks", (req, res) => {
  res.json(bancoDeDadosProvisorio);
});

app.post("/api/tasks", (req, res) => {
    const { title, prioridade } = req.body;
    const prioridadeValida = ['low', 'medium', 'high'].includes(prioridade) ? prioridade : 'medium';
    
    // Validação rígida: Título obrigatório, não vazio e com tamanho mínimo
    // Sanitizamos com .trim() ANTES de checar o length, aplicando a regra de negócio
    if (!title || title.trim().length < 3) {
        return res.status(400).json({ 
            error: "O título da tarefa é obrigatório e deve conter pelo menos 3 caracteres válidos." 
        });
    }

    try {
        const sql = "INSERT INTO tarefas (titulo, status, prioridade) VALUES (?, 'pending', ?)";
        const resultado = db.prepare(sql).run(title.trim(), prioridadeValida);
        
        // Retorna o objeto recém-criado usando o ID gerado (lastInsertRowid).
        const novaTarefa = db.prepare("SELECT * FROM tarefas WHERE id = ?").get(resultado.lastInsertRowid);
        return res.status(201).json(novaTarefa);
    } catch (erro) {
        return res.status(500).json({ error: "Erro ao processar persistência" });
    }
});

// Rota REST para deletar uma tarefa
app.delete("/api/tasks/:id", (req, res) => {
  const idParaDeletar = parseInt(req.params.id);
  bancoDeDadosProvisorio = bancoDeDadosProvisorio.filter(t => t.id !== idParaDeletar);
  res.json({ message: "Tarefa removida com sucesso da memória!" });
});

// A Rota PUT atualiza uma tarefa existente no SQLite com validações estritas
app.put("/api/tasks/:id", (req, res) => {
  const idParaAtualizar = parseInt(req.params.id);
  
  // 1. Validação do ID numérico recebido na URL
  if (isNaN(idParaAtualizar)) {
    return res.status(400).json({ error: "ID inválido." });
  }


  const { title, prioridade, status } = req.body;


  // 2. Validação rígida do Título (assim como na Aula 10)
  if (!title || title.trim().length < 3) {
    return res.status(400).json({
      error: "O título da tarefa é obrigatório e deve conter pelo menos 3 caracteres válidos."
    });
  }


  // 3. Sanitização e valores padrão para prioridade e status
  const prioridadeValida = ['low', 'medium', 'high'].includes(prioridade) ? prioridade : 'medium';
  const statusValido = ['pending', 'completed'].includes(status) ? status : 'pending';


  try {
    // 4. Execução do UPDATE utilizando Prepared Statement (?) para segurança
    const sql = "UPDATE tarefas SET titulo = ?, status = ?, prioridade = ? WHERE id = ?";
    const resultado = db.prepare(sql).run(title.trim(), statusValido, prioridadeValida, idParaAtualizar);


    // 5. Verifica se alguma linha foi de fato modificada no banco
    if (resultado.changes === 0) {
      return res.status(404).json({ message: "Tarefa não encontrada para atualização!" });
    }


    // 6. Busca a tarefa recém-atualizada para retornar no corpo da resposta (Princípio REST)
    const tarefaAtualizada = db.prepare("SELECT * FROM tarefas WHERE id = ?").get(idParaAtualizar);
    return res.status(200).json(tarefaAtualizada);


  } catch (erro) {
    return res.status(500).json({ error: "Erro ao processar a atualização no banco de dados." });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
});