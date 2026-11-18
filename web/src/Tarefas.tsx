/**
 * Tarefas.tsx — tela principal depois do login.
 *
 * Partes da tela:
 *   - cabeçalho com o e-mail do usuário e o botão Sair
 *   - formulário para criar tarefa (título + prioridade)
 *   - campo de busca com debounce
 *   - lista com contadores, concluir/reabrir e excluir
 *   - modal de confirmação antes de excluir
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  atualizarTarefa,
  criarTarefa,
  excluirTarefa,
  listarTarefas,
  type Prioridade,
  type Tarefa,
  type Usuario,
} from "./api";

// ---------------------------------------------------------------------------
// Constantes de apresentação
// ---------------------------------------------------------------------------

/** A API usa os valores em inglês; a tela mostra em português. */
const ROTULO_PRIORIDADE: Record<Prioridade, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const ESTILO_PRIORIDADE: Record<Prioridade, string> = {
  low: "bg-slate-700/60 text-slate-300 ring-slate-600",
  medium: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  high: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
};

const OPCOES_PRIORIDADE: Prioridade[] = ["low", "medium", "high"];

/** Novas tarefas começam como prioridade Alta. */
const PRIORIDADE_INICIAL: Prioridade = "high";

/** Tempo sem digitar antes de disparar a busca. */
const ESPERA_BUSCA_MS = 400;

const CLASSE_CAMPO =
  "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none";

const textoDoErro = (e: unknown, padrao: string): string => (e instanceof Error ? e.message : padrao);

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface TarefasProps {
  usuario: Usuario;
  aoSair: () => void;
}

export default function Tarefas({ usuario, aoSair }: TarefasProps) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // `textoBusca` muda a cada tecla; `termo` só muda depois do debounce
  // e é ele que vai para a API.
  const [textoBusca, setTextoBusca] = useState("");
  const [termo, setTermo] = useState("");

  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>(PRIORIDADE_INICIAL);
  const [salvando, setSalvando] = useState(false);

  const [tarefaParaExcluir, setTarefaParaExcluir] = useState<Tarefa | null>(null);

  /**
   * Contador de requisições. Cada carga recebe um número e só a mais recente
   * pode atualizar a lista — assim uma resposta atrasada de uma busca antiga
   * não sobrescreve o resultado certo.
   */
  const ultimaRequisicao = useRef(0);

  const recarregar = useCallback(async (): Promise<void> => {
    const minha = ++ultimaRequisicao.current;
    try {
      const dados = await listarTarefas(termo);
      if (minha !== ultimaRequisicao.current) return;
      setTarefas(dados);
      setErro("");
    } catch (e) {
      if (minha !== ultimaRequisicao.current) return;
      setErro(textoDoErro(e, "Não foi possível carregar suas tarefas."));
    } finally {
      if (minha === ultimaRequisicao.current) setCarregando(false);
    }
  }, [termo]);

  /** Último termo enviado à API — usado só dentro do timer, por isso é ref. */
  const termoEnviado = useRef("");

  // Debounce: só aplica o termo quando a pessoa para de digitar.
  // Se o termo não mudou (ex.: na montagem), não liga o "carregando",
  // senão a tela ficaria presa em "Carregando..." sem nenhuma busca nova.
  useEffect(() => {
    const timer = setTimeout(() => {
      const novo = textoBusca.trim();
      if (novo === termoEnviado.current) return;
      termoEnviado.current = novo;
      setCarregando(true);
      setTermo(novo);
    }, ESPERA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [textoBusca]);

  // Busca na montagem e sempre que o termo aplicado mudar.
  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // --- ações ---------------------------------------------------------------

  const adicionar = async (evento: FormEvent<HTMLFormElement>): Promise<void> => {
    evento.preventDefault();

    const tituloLimpo = titulo.trim();
    if (tituloLimpo.length < 3) {
      setErro("O título da tarefa deve ter pelo menos 3 caracteres.");
      return;
    }

    setErro("");
    setSalvando(true);
    try {
      await criarTarefa(tituloLimpo, prioridade);
      setTitulo("");
      setPrioridade(PRIORIDADE_INICIAL);
      await recarregar();
    } catch (e) {
      setErro(textoDoErro(e, "Não foi possível criar a tarefa."));
    } finally {
      setSalvando(false);
    }
  };

  const alternarStatus = async (tarefa: Tarefa): Promise<void> => {
    setErro("");
    try {
      await atualizarTarefa(tarefa.id, {
        status: tarefa.status === "completed" ? "pending" : "completed",
      });
      await recarregar();
    } catch (e) {
      setErro(textoDoErro(e, "Não foi possível atualizar a tarefa."));
    }
  };

  const confirmarExclusao = async (): Promise<void> => {
    const alvo = tarefaParaExcluir;
    if (!alvo) return;

    setTarefaParaExcluir(null); // fecha o modal sem esperar a rede
    setErro("");
    try {
      await excluirTarefa(alvo.id);
      await recarregar();
    } catch (e) {
      setErro(textoDoErro(e, "Não foi possível excluir a tarefa."));
    }
  };

  // Referência estável: o modal usa no useEffect e não deve re-executar a cada render.
  const fecharModal = useCallback(() => setTarefaParaExcluir(null), []);

  // --- números -------------------------------------------------------------

  const concluidas = tarefas.filter((t) => t.status === "completed").length;
  const pendentes = tarefas.length - concluidas;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Minhas Tarefas</h1>
          <p className="mt-1 text-sm text-slate-400">
            Conectado como <span className="text-slate-200">{usuario.email}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={aoSair}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Sair
        </button>
      </header>

      {/* Nova tarefa */}
      <form
        onSubmit={adicionar}
        className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4 sm:flex-row"
      >
        <label className="flex-1">
          <span className="sr-only">Título da nova tarefa</span>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="O que precisa ser feito?"
            maxLength={120}
            className={CLASSE_CAMPO}
          />
        </label>

        <label>
          <span className="sr-only">Prioridade</span>
          <select
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as Prioridade)}
            className={`${CLASSE_CAMPO} sm:w-auto`}
          >
            {OPCOES_PRIORIDADE.map((p) => (
              <option key={p} value={p}>
                {ROTULO_PRIORIDADE[p]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50"
        >
          {salvando ? "Criando..." : "Nova Tarefa"}
        </button>
      </form>

      {/* Busca */}
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
        Buscar por título
        <input
          type="search"
          value={textoBusca}
          onChange={(e) => setTextoBusca(e.target.value)}
          placeholder="Digite para filtrar..."
          className={CLASSE_CAMPO}
        />
      </label>

      {erro && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => setErro("")}
            aria-label="Fechar aviso"
            className="shrink-0 text-rose-300 transition hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {/* Lista */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <p aria-live="polite" className="mb-3 text-sm text-slate-400">
          {carregando ? "Carregando..." : `${pendentes} pendente(s) e ${concluidas} concluída(s).`}
        </p>

        {carregando ? (
          <p className="py-6 text-center text-sm text-slate-500">Buscando suas tarefas...</p>
        ) : tarefas.length === 0 ? (
          <ListaVazia termo={termo} />
        ) : (
          <ul className="flex max-h-[60vh] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
            {tarefas.map((t) => (
              <ItemTarefa
                key={t.id}
                tarefa={t}
                aoAlternar={() => void alternarStatus(t)}
                aoExcluir={() => setTarefaParaExcluir(t)}
              />
            ))}
          </ul>
        )}
      </section>

      {tarefaParaExcluir && (
        <ModalExclusao
          tarefa={tarefaParaExcluir}
          aoCancelar={fecharModal}
          aoConfirmar={() => void confirmarExclusao()}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

function ListaVazia({ termo }: { termo: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-slate-300">
        {termo ? `Nenhuma tarefa contém "${termo}".` : "Nenhuma tarefa por aqui ainda."}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {termo ? "Tente outro termo de busca." : "Use o formulário acima para criar a primeira."}
      </p>
    </div>
  );
}

interface ItemTarefaProps {
  tarefa: Tarefa;
  aoAlternar: () => void;
  aoExcluir: () => void;
}

function ItemTarefa({ tarefa, aoAlternar, aoExcluir }: ItemTarefaProps) {
  const concluida = tarefa.status === "completed";

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${concluida ? "text-slate-500 line-through" : "text-slate-100"}`}>
          {tarefa.titulo}
        </p>
        <span
          className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ring-1 ${ESTILO_PRIORIDADE[tarefa.prioridade]}`}
        >
          {ROTULO_PRIORIDADE[tarefa.prioridade]}
        </span>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={aoAlternar}
          className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          {concluida ? "Reabrir" : "Concluir"}
        </button>
        <button
          type="button"
          onClick={aoExcluir}
          className="rounded border border-rose-500/40 px-3 py-1 text-xs text-rose-300 transition hover:border-rose-400 hover:text-rose-200"
        >
          Excluir
        </button>
      </div>
    </li>
  );
}

interface ModalExclusaoProps {
  tarefa: Tarefa;
  aoCancelar: () => void;
  aoConfirmar: () => void;
}

/** Confirmação de exclusão: foca o botão Excluir ao abrir e fecha com Esc. */
function ModalExclusao({ tarefa, aoCancelar, aoConfirmar }: ModalExclusaoProps) {
  const botaoExcluir = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    botaoExcluir.current?.focus();

    const aoPressionar = (e: KeyboardEvent): void => {
      if (e.key === "Escape") aoCancelar();
    };
    document.addEventListener("keydown", aoPressionar);
    return () => document.removeEventListener("keydown", aoPressionar);
  }, [aoCancelar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={aoCancelar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-exclusao"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl"
      >
        <h2 id="titulo-modal-exclusao" className="text-lg font-semibold text-white">
          Excluir esta tarefa?
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          <span className="text-slate-200">{tarefa.titulo}</span> será removida permanentemente. Não dá para
          desfazer.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={aoCancelar}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Cancelar
          </button>
          <button
            ref={botaoExcluir}
            type="button"
            onClick={aoConfirmar}
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
