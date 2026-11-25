/**
 * api.ts — camada de rede do front-end.
 *
 * É o ÚNICO arquivo que conhece o endereço da API e que mexe no token JWT
 * guardado no localStorage. Os componentes só chamam as funções daqui.
 *
 * Organização:
 *   1. Endereço da API e tipos (o "contrato" com o back-end)
 *   2. Token JWT: guardar, ler, apagar e descobrir quem está logado
 *   3. Requisição central (interceptor): Bearer, erros e sessão expirada
 *   4. Autenticação
 *   5. Tarefas (CRUD)
 */

// ---------------------------------------------------------------------------
// 1. Endereço da API e tipos
// ---------------------------------------------------------------------------

/**
 * Ambiente dinâmico:
 *   - dev  -> o Vite roda na 5173 e a API na 3000, então o endereço é completo;
 *   - prod -> o próprio server.ts entrega o front, página e API ficam na mesma
 *             origem e o caminho relativo ("/api/...") basta. Assim o mesmo
 *             build funciona em qualquer IP ou domínio sem recompilar.
 */
const API_BASE = import.meta.env.DEV ? "http://localhost:3000" : "";

const TOKEN_KEY = "gerenciador-tarefas:token";

/** Contrato da tarefa: os mesmos campos da tabela `tarefas` do server.ts. */
export interface Tarefa {
  id: number;
  usuario_id: number;
  titulo: string;
  descricao: string | null;
  status: "pending" | "completed";
  prioridade: "low" | "medium" | "high";
  criado_em: string;
  atualizado_em: string;
}

/** Tipos derivados: se o contrato mudar, a tela acompanha sozinha. */
export type Prioridade = Tarefa["prioridade"];
export type Status = Tarefa["status"];

/** Quem está logado, lido de dentro do token. */
export interface Usuario {
  id: number;
  email: string;
}

/** O que POST /api/auth/login devolve. */
export interface AuthResult {
  token: string;
}

/** O que POST /api/auth/register devolve. */
export interface RegistroResult {
  id: number;
  email: string;
}

/**
 * Erro específico para token vencido ou inválido (HTTP 401).
 * O componente reconhece esse tipo e manda a pessoa de volta ao login.
 */
export class SessaoExpiradaError extends Error {
  constructor() {
    super("Sua sessão expirou. Faça login novamente.");
    this.name = "SessaoExpiradaError";
  }
}

// ---------------------------------------------------------------------------
// 2. Token JWT
// ---------------------------------------------------------------------------

export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

/**
 * Descobre quem está logado decodificando o payload do token.
 *
 * Decodificar NÃO é validar: o payload é só Base64Url, qualquer um lê e
 * edita. Quem confere a assinatura é o server.ts com o JWT_SECRET. Aqui o
 * token serve só para mostrar o e-mail na tela.
 *
 * Token quebrado ou vencido é apagado e a pessoa volta para o login.
 */
export const getUsuario = (): Usuario | null => {
  const token = getToken();
  if (!token) return null;

  try {
    // Um JWT tem 3 partes: cabeçalho.payload.assinatura
    const partes = token.split(".");
    if (partes.length !== 3) throw new Error("token mal formado");

    // Base64Url -> Base64 e decodificação respeitando acentos (UTF-8).
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
      id?: unknown;
      email?: unknown;
      exp?: unknown;
    };

    if (typeof payload.id !== "number" || typeof payload.email !== "string") {
      throw new Error("payload inesperado");
    }
    // exp vem em segundos; Date.now() em milissegundos.
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      throw new Error("token expirado");
    }

    return { id: payload.id, email: payload.email };
  } catch {
    clearToken();
    return null;
  }
};

// ---------------------------------------------------------------------------
// 3. Requisição central (padrão interceptor)
// ---------------------------------------------------------------------------

/**
 * Toda chamada passa por aqui. Ela:
 *   - anexa `Authorization: Bearer <token>` quando existe login;
 *   - lê o corpo como texto antes do JSON.parse (204 ou HTML não quebram);
 *   - transforma status fora de 2xx em Error com a mensagem `{ error }` do back;
 *   - trata 401 em rota privada: apaga o token e lança SessaoExpiradaError.
 */
async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${caminho}`, {
    ...opcoes,
    headers: { ...headers, ...(opcoes.headers as Record<string, string> | undefined) },
  });

  // Token enviado e recusado = sessão morta. (401 no login é senha errada,
  // por isso só vale quando havia token.)
  if (res.status === 401 && token) {
    clearToken();
    throw new SessaoExpiradaError();
  }

  const texto = await res.text();
  let dados: unknown;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = null; // resposta que não é JSON (ex.: página de erro em HTML)
  }

  if (!res.ok) {
    const mensagem = (dados as { error?: string } | null)?.error;
    throw new Error(mensagem ?? `Falha na requisição (HTTP ${res.status}).`);
  }

  // 204 No Content ou corpo vazio: não há o que devolver.
  if (res.status === 204 || texto === "") return undefined as T;

  return dados as T;
}

// ---------------------------------------------------------------------------
// 4. Autenticação
// ---------------------------------------------------------------------------

/** POST /api/auth/login — guarda o token se der certo. */
export async function login(email: string, senha: string): Promise<AuthResult> {
  const dados = await requisitar<AuthResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
  setToken(dados.token);
  return dados;
}

/** POST /api/auth/register — só cria a conta; o login vem em seguida. */
export function registrar(email: string, senha: string): Promise<RegistroResult> {
  return requisitar<RegistroResult>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
}

// ---------------------------------------------------------------------------
// 5. Tarefas
// ---------------------------------------------------------------------------

/** GET /api/tasks?search= — tarefas do usuário logado. */
export function listarTarefas(search = ""): Promise<Tarefa[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return requisitar<Tarefa[]>(`/api/tasks${query}`);
}

/** POST /api/tasks */
export function criarTarefa(titulo: string, prioridade: Prioridade): Promise<Tarefa> {
  return requisitar<Tarefa>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ titulo, prioridade }),
  });
}

/** PATCH /api/tasks/:id — envia só os campos que mudaram. */
export function atualizarTarefa(
  id: number,
  campos: Partial<Pick<Tarefa, "titulo" | "status" | "prioridade">>,
): Promise<Tarefa> {
  return requisitar<Tarefa>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(campos),
  });
}

/** DELETE /api/tasks/:id */
export function deletarTarefa(id: number): Promise<{ message: string }> {
  return requisitar<{ message: string }>(`/api/tasks/${id}`, { method: "DELETE" });
}
