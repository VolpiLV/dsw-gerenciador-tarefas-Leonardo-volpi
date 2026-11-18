/**
 * api.ts — toda a comunicação do front com o server.ts passa por aqui.
 *
 * Conteúdo:
 *   - tipos que a API devolve
 *   - guarda do token JWT no localStorage
 *   - função genérica que transforma a resposta HTTP em dado ou erro
 *   - chamadas de autenticação e do CRUD de tarefas
 */

// ---------------------------------------------------------------------------
// Endereço da API
// ---------------------------------------------------------------------------

/**
 * Em desenvolvimento o Vite roda na porta 5173 e a API na 3000, então o
 * endereço precisa ser completo. Depois do build quem entrega a página é o
 * próprio server.ts, então página e API ficam na mesma origem e basta o
 * caminho relativo ("/api/...").
 */
const BASE_URL = import.meta.env.DEV ? "http://localhost:3000" : "";

const CHAVE_TOKEN = "gerenciador-tarefas:token";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Prioridade = "low" | "medium" | "high";
export type Status = "pending" | "completed";

export interface Tarefa {
  id: number;
  titulo: string;
  status: Status;
  prioridade: Prioridade;
}

export interface Usuario {
  id: number;
  email: string;
}

interface RespostaLogin {
  token: string;
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export const salvarToken = (token: string): void => localStorage.setItem(CHAVE_TOKEN, token);
export const lerToken = (): string | null => localStorage.getItem(CHAVE_TOKEN);
export const apagarToken = (): void => localStorage.removeItem(CHAVE_TOKEN);

/** Cabeçalhos com JSON + `Authorization: Bearer <token>` quando houver login. */
const cabecalhos = (): Record<string, string> => {
  const token = lerToken();
  return token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : { "Content-Type": "application/json" };
};

/**
 * Lê o e-mail e o id de dentro do token, só para mostrar na tela.
 *
 * Isso NÃO valida o token: a assinatura só pode ser conferida pelo servidor.
 * Se o token estiver quebrado ou vencido, ele é apagado e voltamos ao login.
 */
export const usuarioLogado = (): Usuario | null => {
  const token = lerToken();
  if (!token) return null;

  try {
    const [, payloadBase64Url] = token.split(".");
    if (!payloadBase64Url) throw new Error("token sem payload");

    // Base64Url -> Base64 e decodificação respeitando acentos (UTF-8).
    const base64 = payloadBase64Url.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
      id?: unknown;
      email?: unknown;
      exp?: unknown;
    };

    if (typeof payload.id !== "number" || typeof payload.email !== "string") {
      throw new Error("payload inesperado");
    }
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      throw new Error("token expirado");
    }

    return { id: payload.id, email: payload.email };
  } catch {
    apagarToken();
    return null;
  }
};

// ---------------------------------------------------------------------------
// Requisição genérica
// ---------------------------------------------------------------------------

/**
 * Faz o fetch e devolve o JSON. Se o status não for 2xx, lança um Error com a
 * mensagem `{ error }` enviada pelo back, para o componente só usar try/catch.
 */
async function requisitar<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`${BASE_URL}${caminho}`, {
    ...opcoes,
    headers: { ...cabecalhos(), ...(opcoes.headers ?? {}) },
  });

  const texto = await resposta.text();
  let corpo: unknown = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = null; // resposta que não é JSON
  }

  if (!resposta.ok) {
    const mensagem = (corpo as { error?: string } | null)?.error;
    throw new Error(mensagem ?? `Falha na requisição (HTTP ${resposta.status}).`);
  }

  return corpo as T;
}

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export async function entrar(email: string, senha: string): Promise<void> {
  const { token } = await requisitar<RespostaLogin>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
  salvarToken(token);
}

export async function cadastrar(email: string, senha: string): Promise<Usuario> {
  return requisitar<Usuario>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
}

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export function listarTarefas(busca = ""): Promise<Tarefa[]> {
  const query = busca ? `?search=${encodeURIComponent(busca)}` : "";
  return requisitar<Tarefa[]>(`/api/tasks${query}`);
}

export function criarTarefa(titulo: string, prioridade: Prioridade): Promise<Tarefa> {
  return requisitar<Tarefa>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({ titulo, prioridade }),
  });
}

export function atualizarTarefa(
  id: number,
  campos: Partial<Pick<Tarefa, "titulo" | "status" | "prioridade">>,
): Promise<Tarefa> {
  return requisitar<Tarefa>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(campos),
  });
}

export function excluirTarefa(id: number): Promise<{ message: string }> {
  return requisitar<{ message: string }>(`/api/tasks/${id}`, { method: "DELETE" });
}
