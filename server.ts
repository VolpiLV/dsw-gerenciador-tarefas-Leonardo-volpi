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
        status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        senha TEXT NOT NULL
    );
`);

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

// Rota REST para criar uma nova tarefa
app.post("/api/tasks", (req, res) => {
  const { title } = req.body;
  const novaTarefa = {
    id: Date.now(),
    title,
    status: "pending"
  };
  bancoDeDadosProvisorio.push(novaTarefa);
  res.status(201).json(novaTarefa);
});

// Rota REST para deletar uma tarefa
app.delete("/api/tasks/:id", (req, res) => {
  const idParaDeletar = parseInt(req.params.id);
  bancoDeDadosProvisorio = bancoDeDadosProvisorio.filter(t => t.id !== idParaDeletar);
  res.json({ message: "Tarefa removida com sucesso da memória!" });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
});
