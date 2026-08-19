import express from "express";

const app = express();
const PORT = 3000;

// Middleware obrigatório para ler o corpo das requisições em formato JSON
app.use(express.json());

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