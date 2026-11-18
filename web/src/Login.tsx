/**
 * Login.tsx — tela única para entrar ou criar conta.
 * O estado `modo` define qual rota é chamada e quais textos aparecem.
 */

import { useState, type FormEvent } from "react";
import { cadastrar, entrar } from "./api";

type Modo = "entrar" | "cadastrar";

interface LoginProps {
  aoEntrar: () => void;
}

const CLASSE_INPUT =
  "rounded-md border border-slate-700 bg-slate-800 px-3 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none";

/** Mesmas regras do back, só para dar retorno rápido sem ir ao servidor. */
function validar(email: string, senha: string, modo: Modo): string | null {
  if (!email.trim()) return "Informe o e-mail.";
  if (!email.includes("@")) return "Informe um e-mail válido.";
  if (!senha) return "Informe a senha.";
  if (modo === "cadastrar" && senha.length < 6) return "A senha deve ter pelo menos 6 caracteres.";
  return null;
}

export default function Login({ aoEntrar }: LoginProps) {
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const ehEntrar = modo === "entrar";

  const enviar = async (evento: FormEvent<HTMLFormElement>): Promise<void> => {
    evento.preventDefault(); // sem isso o navegador recarrega a página

    const problema = validar(email, senha, modo);
    if (problema) {
      setErro(problema);
      return;
    }

    setErro("");
    setEnviando(true);
    try {
      const emailLimpo = email.trim();
      // No cadastro já fazemos o login em seguida, sem pedir os dados de novo.
      if (!ehEntrar) await cadastrar(emailLimpo, senha);
      await entrar(emailLimpo, senha);
      aoEntrar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível autenticar.");
    } finally {
      setEnviando(false);
    }
  };

  const trocarModo = (): void => {
    setModo(ehEntrar ? "cadastrar" : "entrar");
    setErro("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">Gerenciador de Tarefas</h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          {ehEntrar ? "Entre para continuar" : "Crie sua conta para começar"}
        </p>

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
              placeholder={ehEntrar ? "Sua senha" : "Mínimo de 6 caracteres"}
              autoComplete={ehEntrar ? "current-password" : "new-password"}
              className={CLASSE_INPUT}
            />
          </label>

          {erro && (
            <p role="alert" className="rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-emerald-600 py-2.5 font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Aguarde..." : ehEntrar ? "Entrar" : "Criar conta"}
          </button>

          {/* type="button": dentro do form, um botão sem type enviaria o formulário. */}
          <button
            type="button"
            onClick={trocarModo}
            className="text-sm text-slate-400 transition hover:text-white"
          >
            {ehEntrar ? "Não tem conta? Registre-se" : "Já tem conta? Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
