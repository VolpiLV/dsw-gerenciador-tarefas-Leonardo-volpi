/**
 * server.ts — API do Gerenciador de Tarefas
 *
 * Responsabilidades deste arquivo:
 *   - conectar no banco (SQLite local ou Turso na nuvem, via libSQL)
 *   - autenticar usuários (bcrypt para a senha, JWT para a sessão)
 *   - expor o CRUD de tarefas, sempre isolado por usuário
 *   - entregar o build do front-end (web/dist) na mesma porta da API
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient, type InValue } from "@libsql/client";

// ============================================================================
// Configuração geral
// ============================================================================

const RAIZ = path.dirname(fileURLToPath(import.meta.url));

// O .env é opcional: sem ele o projeto roda com SQLite local.
const CAMINHO_ENV = path.join(RAIZ, ".env");
if (fs.existsSync(CAMINHO_ENV)) {
    const conteudo = fs.readFileSync(CAMINHO_ENV);
    // Arquivo salvo "UTF-8 com BOM" faz a primeira variável não ser lida.
    if (conteudo[0] === 0xef && conteudo[1] === 0xbb && conteudo[2] === 0xbf) {
        console.warn("[aviso] O .env foi salvo com BOM. Salve como UTF-8 (sem BOM).");
    }
    process.loadEnvFile(CAMINHO_ENV);
}

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_apenas_para_desenvolvimento";

const PASTA_FRONT = path.join(RAIZ, "web", "dist");
const INDEX_FRONT = path.join(PASTA_FRONT, "index.html");

// ============================================================================
// Tipos e regras de negócio
// ============================================================================

const PRIORIDADES = ["low", "medium", "high"] as const;
const STATUS_VALIDOS = ["pending", "completed"] as const;

type Prioridade = (typeof PRIORIDADES)[number];
type Status = (typeof STATUS_VALIDOS)[number];

interface Tarefa {
    id: number;
    usuario_id: number;
    titulo: string;
    descricao: string | null;
    status: Status;
    prioridade: Prioridade;
    criado_em: string;
    atualizado_em: string;
}

interface Usuario {
    id: number;
    email: string;
    senha_hash: string;
    criado_em: string;
}

/** Request depois de passar pelo middleware de autenticação. */
interface RequisicaoAutenticada extends Request {
    usuarioId?: number;
}

/** Erro de validação: vira resposta 400 em vez de 500. */
class ErroValidacao extends Error {}

const ehTituloValido = (valor: unknown): valor is string =>
    typeof valor === "string" && valor.trim().length >= 3;

const ehPrioridade = (valor: unknown): valor is Prioridade =>
    typeof valor === "string" && (PRIORIDADES as readonly string[]).includes(valor);

const ehStatus = (valor: unknown): valor is Status =>
    typeof valor === "string" && (STATUS_VALIDOS as readonly string[]).includes(valor);

/** Valores fora da lista caem no padrão em vez de quebrar a requisição. */
const prioridadeOuPadrao = (valor: unknown): Prioridade => (ehPrioridade(valor) ? valor : "medium");
const statusOuPadrao = (valor: unknown): Status => (ehStatus(valor) ? valor : "pending");

/** Converte o :id da URL. "12abc" ou "abc" viram null. */
const lerId = (bruto: unknown): number | null => {
    const id = Number(bruto);
    return Number.isNaN(id) ? null : id;
};

// ============================================================================
// Banco de dados (libSQL)
// ============================================================================

const TURSO_URL = process.env.TURSO_URL?.trim();
const TURSO_TOKEN = process.env.TURSO_TOKEN?.trim();
const NA_NUVEM = Boolean(TURSO_URL && TURSO_TOKEN);
const DESCRICAO_BANCO = NA_NUVEM ? "Turso / libSQL (nuvem)" : "SQLite local (tarefas.db)";

const db = createClient(
    NA_NUVEM
        ? { url: TURSO_URL!, authToken: TURSO_TOKEN }
        : { url: "file:./tarefas.db" },
);

const CRIAR_USUARIOS = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        email       TEXT NOT NULL UNIQUE,
        senha_hash  TEXT NOT NULL,
        criado_em   DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;

const CRIAR_TAREFAS = `
    CREATE TABLE IF NOT EXISTS tarefas (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id     INTEGER NOT NULL,
        titulo         TEXT NOT NULL,
        descricao      TEXT,
        status         TEXT NOT NULL DEFAULT 'pending',
        prioridade     TEXT NOT NULL DEFAULT 'medium',
        criado_em      DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    )`;

async function colunasDe(tabela: string): Promise<string[]> {
    const { rows } = await db.execute(`PRAGMA table_info(${tabela})`);
    return rows.map((linha) => String(linha.name));
}

/**
 * Bancos criados nas aulas anteriores (better-sqlite3) tinham a coluna
 * `senha` e não tinham as colunas de data. Aqui eles são atualizados sem
 * perder usuários nem tarefas.
 */
async function migrarBancoAntigo(): Promise<void> {
    const colunasUsuarios = await colunasDe("usuarios");
    if (colunasUsuarios.includes("senha") && !colunasUsuarios.includes("senha_hash")) {
        await db.execute("ALTER TABLE usuarios RENAME COLUMN senha TO senha_hash");
    }
    if (!colunasUsuarios.includes("criado_em")) {
        await db.execute("ALTER TABLE usuarios ADD COLUMN criado_em DATETIME");
    }

    // Senhas antigas gravadas em texto puro passam a ser hash bcrypt.
    const { rows } = await db.execute("SELECT id, senha_hash FROM usuarios WHERE senha_hash NOT LIKE '$2%'");
    for (const linha of rows) {
        const hash = await bcrypt.hash(String(linha.senha_hash), 10);
        await db.execute({ sql: "UPDATE usuarios SET senha_hash = ? WHERE id = ?", args: [hash, linha.id] });
    }

    const colunasTarefas = await colunasDe("tarefas");
    for (const coluna of ["descricao TEXT", "criado_em DATETIME", "atualizado_em DATETIME"]) {
        const nome = coluna.split(" ")[0];
        if (!colunasTarefas.includes(nome)) {
            await db.execute(`ALTER TABLE tarefas ADD COLUMN ${coluna}`);
        }
    }
    await db.execute("UPDATE tarefas SET atualizado_em = CURRENT_TIMESTAMP WHERE atualizado_em IS NULL");
}

async function prepararBanco(): Promise<void> {
    await db.batch([CRIAR_USUARIOS, CRIAR_TAREFAS], "write");
    await migrarBancoAntigo();

    // Usuário de exemplo para testes rápidos.
    const emailAdmin = "admin@senai.com";
    const { rows } = await db.execute({ sql: "SELECT id FROM usuarios WHERE email = ?", args: [emailAdmin] });
    if (rows.length === 0) {
        const hash = await bcrypt.hash("senha_super_secreta_123", 10);
        await db.execute({ sql: "INSERT INTO usuarios (email, senha_hash) VALUES (?, ?)", args: [emailAdmin, hash] });
    }
}

/** Consultas usadas pelas rotas. Todas parametrizadas com `?`. */
const repo = {
    usuarioPorEmail: async (email: string) => {
        const { rows } = await db.execute({ sql: "SELECT * FROM usuarios WHERE email = ?", args: [email] });
        return rows[0] as unknown as Usuario | undefined;
    },

    criarUsuario: async (email: string, senhaHash: string) => {
        const r = await db.execute({
            sql: "INSERT INTO usuarios (email, senha_hash) VALUES (?, ?)",
            args: [email, senhaHash],
        });
        return Number(r.lastInsertRowid);
    },

    listarTarefas: async (usuarioId: number, busca: string) => {
        const { rows } = busca
            ? await db.execute({
                sql: `SELECT * FROM tarefas
                      WHERE usuario_id = ? AND (titulo LIKE ? OR descricao LIKE ?)
                      ORDER BY id DESC`,
                args: [usuarioId, `%${busca}%`, `%${busca}%`],
            })
            : await db.execute({
                sql: "SELECT * FROM tarefas WHERE usuario_id = ? ORDER BY id DESC",
                args: [usuarioId],
            });
        return rows as unknown as Tarefa[];
    },

    tarefaDoUsuario: async (id: number, usuarioId: number) => {
        const { rows } = await db.execute({
            sql: "SELECT * FROM tarefas WHERE id = ? AND usuario_id = ?",
            args: [id, usuarioId],
        });
        return rows[0] as unknown as Tarefa | undefined;
    },

    criarTarefa: async (usuarioId: number, titulo: string, prioridade: Prioridade) => {
        const r = await db.execute({
            sql: "INSERT INTO tarefas (usuario_id, titulo, status, prioridade) VALUES (?, ?, 'pending', ?)",
            args: [usuarioId, titulo, prioridade],
        });
        return Number(r.lastInsertRowid);
    },

    excluirTarefa: async (id: number, usuarioId: number) => {
        const r = await db.execute({
            sql: "DELETE FROM tarefas WHERE id = ? AND usuario_id = ?",
            args: [id, usuarioId],
        });
        return r.rowsAffected;
    },
};

// ============================================================================
// App Express e middlewares
// ============================================================================

const app = express();
app.use(cors()); // o front em dev (porta 5173) chama a API na porta 3000
app.use(express.json());

/** Exige `Authorization: Bearer <token>` e descobre quem é o usuário. */
const exigirLogin = (req: RequisicaoAutenticada, res: Response, next: NextFunction) => {
    const cabecalho = req.headers.authorization;
    if (!cabecalho?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Token ausente ou mal formatado." });
    }

    try {
        const conteudo = jwt.verify(cabecalho.slice(7), JWT_SECRET) as { id: number };
        req.usuarioId = conteudo.id;
        return next();
    } catch {
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
};

// ============================================================================
// Rotas públicas
// ============================================================================

app.get("/api/health", async (_req, res) => {
    try {
        await db.execute("SELECT 1");
        return res.json({ status: "ok", message: "Servidor do Gerenciador de Tarefas ativo!", banco: DESCRICAO_BANCO });
    } catch {
        return res.status(503).json({ status: "erro", message: "O banco de dados não respondeu.", banco: DESCRICAO_BANCO });
    }
});

app.get("/api/version", (_req, res) => {
    res.json({ appName: "Gerenciador de Tarefas Multi-Usuário", version: "1.2.0", banco: DESCRICAO_BANCO });
});

/**
 * Diagnóstico do banco: confirma a conexão e conta os registros de cada
 * tabela. Só devolve números, nunca o conteúdo (e-mails, senhas, tarefas).
 */
app.get("/api/db-check", async (_req, res) => {
    try {
        await db.execute("SELECT 1");
        const { rows } = await db.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        );
        const tabelas = rows.map((linha) => String(linha.name));

        const contagem: Record<string, number> = {};
        for (const tabela of tabelas) {
            // O nome vem do próprio sqlite_master, não do usuário.
            const r = await db.execute(`SELECT COUNT(*) AS total FROM "${tabela}"`);
            contagem[tabela] = Number(r.rows[0]?.total ?? 0);
        }

        return res.json({ ok: true, banco: DESCRICAO_BANCO, tabelas, contagem });
    } catch {
        return res.status(503).json({ ok: false, banco: DESCRICAO_BANCO, error: "Não foi possível consultar o banco." });
    }
});

/** Lê a senha aceitando os dois nomes de campo usados nos testes. */
const senhaDoCorpo = (corpo: Record<string, unknown> | undefined): unknown =>
    corpo?.senha ?? corpo?.password;

app.post("/api/auth/register", async (req, res) => {
    const email = req.body?.email;
    const senha = senhaDoCorpo(req.body);

    if (typeof email !== "string" || !email.trim().includes("@")) {
        return res.status(400).json({ error: "Informe um e-mail válido." });
    }
    if (typeof senha !== "string" || senha.trim().length < 6) {
        return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres." });
    }

    try {
        const hash = await bcrypt.hash(senha, 10);
        const id = await repo.criarUsuario(email.trim(), hash);
        return res.status(201).json({ id, email: email.trim() });
    } catch (erro) {
        const texto = String((erro as { message?: string })?.message ?? "");
        if (texto.includes("UNIQUE")) {
            return res.status(409).json({ error: "E-mail já cadastrado." });
        }
        console.error("Falha no cadastro:", erro);
        return res.status(500).json({ error: "Não foi possível concluir o cadastro agora." });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const email = req.body?.email;
    const senha = senhaDoCorpo(req.body);

    if (typeof email !== "string" || typeof senha !== "string" || !email.trim() || !senha) {
        return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
    }

    try {
        const usuario = await repo.usuarioPorEmail(email.trim());
        // Compara mesmo quando o usuário não existe, para o tempo de resposta
        // não denunciar quais e-mails estão cadastrados.
        const hash = usuario?.senha_hash ?? "$2a$10$hashinvalidoparaigualarotempodecomparacao";
        const senhaConfere = await bcrypt.compare(senha, hash);

        if (!usuario || !senhaConfere) {
            return res.status(401).json({ error: "Credenciais inválidas." });
        }

        // Stateless: o servidor não guarda sessão, só confere a assinatura depois.
        const token = jwt.sign({ id: usuario.id, email: usuario.email }, JWT_SECRET, { expiresIn: "7d" });
        return res.json({ token });
    } catch (erro) {
        console.error("Falha no login:", erro);
        return res.status(500).json({ error: "Não foi possível entrar agora." });
    }
});

// ============================================================================
// Rotas de tarefas (todas protegidas e filtradas pelo usuário do token)
// ============================================================================

app.get("/api/tasks", exigirLogin, async (req: RequisicaoAutenticada, res) => {
    // Se vier ?search=a&search=b (array), ignoramos e listamos tudo.
    const busca = typeof req.query.search === "string" ? req.query.search.trim() : "";
    try {
        return res.json(await repo.listarTarefas(req.usuarioId!, busca));
    } catch {
        return res.status(500).json({ error: "Erro interno ao listar as tarefas." });
    }
});

app.post("/api/tasks", exigirLogin, async (req: RequisicaoAutenticada, res) => {
    const { titulo, prioridade } = req.body ?? {};
    if (!ehTituloValido(titulo)) {
        return res.status(400).json({ error: "O título da tarefa é obrigatório e deve ter pelo menos 3 caracteres." });
    }

    try {
        const id = await repo.criarTarefa(req.usuarioId!, titulo.trim(), prioridadeOuPadrao(prioridade));
        return res.status(201).json(await repo.tarefaDoUsuario(id, req.usuarioId!));
    } catch {
        return res.status(500).json({ error: "Erro ao salvar a tarefa." });
    }
});

app.put("/api/tasks/:id", exigirLogin, async (req: RequisicaoAutenticada, res) => {
    const id = lerId(req.params.id);
    if (id === null) return res.status(400).json({ error: "ID inválido." });

    const { titulo, prioridade, status } = req.body ?? {};
    if (!ehTituloValido(titulo)) {
        return res.status(400).json({ error: "O título da tarefa é obrigatório e deve ter pelo menos 3 caracteres." });
    }

    try {
        const r = await db.execute({
            sql: `UPDATE tarefas
                  SET titulo = ?, status = ?, prioridade = ?, atualizado_em = CURRENT_TIMESTAMP
                  WHERE id = ? AND usuario_id = ?`,
            args: [titulo.trim(), statusOuPadrao(status), prioridadeOuPadrao(prioridade), id, req.usuarioId!],
        });
        if (r.rowsAffected === 0) {
            return res.status(404).json({ error: "Tarefa não encontrada para atualização." });
        }
        return res.json(await repo.tarefaDoUsuario(id, req.usuarioId!));
    } catch {
        return res.status(500).json({ error: "Erro ao atualizar a tarefa." });
    }
});

app.patch("/api/tasks/:id", exigirLogin, async (req: RequisicaoAutenticada, res) => {
    const id = lerId(req.params.id);
    if (id === null) return res.status(400).json({ error: "ID inválido." });

    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: "Nenhum campo enviado para atualização." });
    }

    const { titulo, prioridade, status } = req.body;

    try {
        const atual = await repo.tarefaDoUsuario(id, req.usuarioId!);
        if (!atual) return res.status(404).json({ error: "Tarefa não encontrada." });

        // Monta o UPDATE só com os campos que vieram, sempre com `?`.
        const sets: string[] = [];
        const valores: InValue[] = [];

        if (titulo !== undefined) {
            if (!ehTituloValido(titulo)) throw new ErroValidacao("O título deve ter pelo menos 3 caracteres.");
            sets.push("titulo = ?");
            valores.push(titulo.trim());
        }
        if (prioridade !== undefined) {
            if (!ehPrioridade(prioridade)) throw new ErroValidacao("Prioridade inválida. Use 'low', 'medium' ou 'high'.");
            sets.push("prioridade = ?");
            valores.push(prioridade);
        }
        if (status !== undefined) {
            if (!ehStatus(status)) throw new ErroValidacao("Status inválido. Use 'pending' ou 'completed'.");
            sets.push("status = ?");
            valores.push(status);
        }

        if (sets.length === 0) return res.json(atual);

        await db.execute({
            sql: `UPDATE tarefas SET ${sets.join(", ")}, atualizado_em = CURRENT_TIMESTAMP
                  WHERE id = ? AND usuario_id = ?`,
            args: [...valores, id, req.usuarioId!],
        });
        return res.json(await repo.tarefaDoUsuario(id, req.usuarioId!));
    } catch (erro) {
        if (erro instanceof ErroValidacao) return res.status(400).json({ error: erro.message });
        return res.status(500).json({ error: "Erro ao atualizar parcialmente a tarefa." });
    }
});

app.delete("/api/tasks/:id", exigirLogin, async (req: RequisicaoAutenticada, res) => {
    const id = lerId(req.params.id);
    if (id === null) return res.status(400).json({ error: "ID inválido." });

    try {
        const removidas = await repo.excluirTarefa(id, req.usuarioId!);
        if (removidas === 0) {
            return res.status(404).json({ error: "Tarefa não encontrada para exclusão." });
        }
        return res.json({ message: "Tarefa excluída com sucesso!" });
    } catch {
        return res.status(500).json({ error: "Erro ao excluir a tarefa." });
    }
});

// ============================================================================
// Front-end (build do React servido pela própria API)
// ============================================================================

// Qualquer /api desconhecido responde JSON, e não o index.html do front.
app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Rota de API não encontrada." });
});

app.use(express.static(PASTA_FRONT));

app.get(/(.*)/, (_req, res) => {
    if (!fs.existsSync(INDEX_FRONT)) {
        return res
            .status(503)
            .type("text/plain")
            .send(
                "O build do front-end ainda não foi gerado.\n\n" +
                "Rode na raiz do projeto:\n" +
                "  npm run build:web\n\n" +
                "A API continua disponível em /api/health.",
            );
    }
    return res.sendFile(INDEX_FRONT);
});

/** Data de modificação mais recente dentro de uma pasta (recursivo). */
function ultimaAlteracao(pasta: string): number {
    let maior = 0;
    for (const item of fs.readdirSync(pasta, { withFileTypes: true })) {
        const caminho = path.join(pasta, item.name);
        maior = Math.max(maior, item.isDirectory() ? ultimaAlteracao(caminho) : fs.statSync(caminho).mtimeMs);
    }
    return maior;
}

function avisarSobreFront(): void {
    if (!fs.existsSync(INDEX_FRONT)) {
        console.warn("[aviso] web/dist não existe. Gere o front com: npm run build:web");
        return;
    }
    const fontes = path.join(RAIZ, "web", "src");
    if (fs.existsSync(fontes) && ultimaAlteracao(fontes) > ultimaAlteracao(PASTA_FRONT)) {
        console.warn("[aviso] O código do front mudou depois do último build. Rode: npm run build:web");
    }
}

// ============================================================================
// Inicialização
// ============================================================================

async function iniciar(): Promise<void> {
    try {
        await prepararBanco();
    } catch (erro) {
        console.error("[erro] Não foi possível preparar o banco:", erro);
        if (NA_NUVEM) console.error("Confira TURSO_URL e TURSO_TOKEN no .env.");
        process.exitCode = 1;
        return;
    }

    app.listen(PORT, () => {
        console.log("------------------------------------------------------------");
        console.log(` Banco : ${DESCRICAO_BANCO}`);
        console.log(` Onde  : ${NA_NUVEM ? TURSO_URL : path.resolve("tarefas.db")}`);
        console.log(` Token : ${NA_NUVEM ? "presente (nunca é mostrado)" : "não informado"}`);
        if (!NA_NUVEM) console.log(" (para usar o Turso, preencha TURSO_URL e TURSO_TOKEN no .env)");
        console.log(` API   : http://localhost:${PORT}/api/health`);
        console.log(` Check : http://localhost:${PORT}/api/db-check`);
        console.log(` Front : http://localhost:${PORT}`);
        console.log("------------------------------------------------------------");
        avisarSobreFront();
    });
}

void iniciar();
