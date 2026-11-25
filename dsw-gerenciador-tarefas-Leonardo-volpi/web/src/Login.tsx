/**
 * Login.tsx — uma tela só para entrar ou criar conta.
 * O estado `modo` decide qual rota é chamada e quais textos aparecem.
 */

import { useState, type FormEvent } from "react";
import { login, registrar } from "./api";

type Modo = "login" | "registro";

interface LoginProps {
  /** Avisa o App que o token foi salvo. */
  aoLogar: () => void;
  /** Mensagem vinda do App (ex.: sessão expirada). */
  aviso?: string;
}

const CLASSE_INPUT =
  "rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none";

export default function Login({ aoLogar, aviso = "" }: LoginProps) {
  // Componentes controlados: o React é a única fonte da verdade dos campos.
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<Modo>("login");

  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const ehLogin = modo === "login";

  /**
   * Validação no cliente: retorno imediato, sem ir ao servidor.
   * Não substitui a validação do back, que sempre confere de novo.
   */
  const validar = (): string => {
    if (!email.trim()) return "Informe o e-mail.";
    if (!email.includes("@")) return "Informe um e-mail válido.";
    if (!senha) return "Informe a senha.";
    if (!ehLogin && senha.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
    return "";
  };

  const enviar = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    // Sem isso o navegador recarrega a página e todo o estado da SPA se perde.
    e.preventDefault();

    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }

    setErro("");
    setCarregando(true);
    try {
      const emailLimpo = email.trim();
      // O register não devolve token: depois de criar a conta já fazemos o
      // login, para a pessoa não ter que digitar tudo de novo.
      if (!ehLogin) await registrar(emailLimpo, senha);
      await login(emailLimpo, senha);
      aoLogar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível autenticar.");
    } finally {
      setCarregando(false); // destrava o botão no sucesso e no erro
    }
  };

  const trocarModo = (): void => {
    setModo(ehLogin ? "registro" : "login");
    setErro("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">Gerenciador de Tarefas</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          {ehLogin ? "Entre para continuar" : "Crie sua conta para começar"}
        </p>

        {aviso && !erro && (
          <p
            role="status"
            className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
          >
            {aviso}
          </p>
        )}

        <form onSubmit={enviar} className="mt-8 flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-300">
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
              className={CLASSE_INPUT}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-slate-300">
            Senha
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder={ehLogin ? "Sua senha" : "Mínimo de 6 caracteres"}
              autoComplete={ehLogin ? "current-password" : "new-password"}
              className={CLASSE_INPUT}
            />
          </label>

          {erro && (
            <p role="alert" className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {erro}
            </p>
          )}

          {/* disabled evita clique duplo enquanto a requisição está em voo */}
          <button
            type="submit"
            disabled={carregando}
            className="flex items-center justify-center gap-2 rounded-md bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando && <Spinner />}
            {carregando ? "Aguarde..." : ehLogin ? "Entrar" : "Criar conta"}
          </button>

          {/* type="button": dentro do form, um botão sem type enviaria o formulário. */}
          <button type="button" onClick={trocarModo} className="text-sm text-slate-400 transition hover:text-white">
            {ehLogin ? "Não tem conta? Registre-se" : "Já tem conta? Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}
