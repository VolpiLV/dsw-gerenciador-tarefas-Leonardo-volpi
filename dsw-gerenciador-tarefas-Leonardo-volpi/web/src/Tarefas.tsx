/**
 * Tarefas.tsx — tela principal depois do login.
 *
 * Partes da tela:
 *   1. cabeçalho  — e-mail de quem está conectado e botão Sair
 *   2. formulário — título + prioridade da nova tarefa
 *   3. busca      — por título, com debounce (vai para a API)
 *   4. filtro     — chips por prioridade (local, sem chamar a API)
 *   5. lista      — contadores, concluir/reabrir e excluir
 *   6. modal      — confirmação antes de excluir
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  atualizarTarefa,
  criarTarefa,
  deletarTarefa,
  listarTarefas,
  SessaoExpiradaError,
  type Prioridade,
  type Status,
  type Tarefa,
  type Usuario,
} from "./api";

// ---------------------------------------------------------------------------
// Constantes de apresentação
// ---------------------------------------------------------------------------

/**
 * Dicionário tipado: a API fala inglês, a tela fala português.
 * Record<Prioridade, string> obriga a traduzir 100% dos valores aceitos.
 * Se o contrato ganhar uma prioridade nova, o tsc reclama aqui.
 */
const PRIORIDADES_PT: Record<Prioridade, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

/** Cores semânticas do badge: verde baixa, amarelo média, vermelho alta. */
const COR_PRIORIDADE: Record<Prioridade, string> = {
  low: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40",
  medium: "bg-amber-500/15 text-amber-300 ring-amber-500/40",
  high: "bg-rose-500/15 text-rose-300 ring-rose-500/40",
};

/** Ordem das opções no <select>. */
const PRIORIDADES: Prioridade[] = ["low", "medium", "high"];

/** Filtro local: "todas" ou uma das prioridades do contrato. */
type FiltroPrioridade = "todas" | Prioridade;
const FILTROS: FiltroPrioridade[] = ["todas", ...PRIORIDADES];

/** Mesma prioridade padrão do back-end. */
const PRIORIDADE_INICIAL: Prioridade = "medium";

/** Tempo sem digitar antes de aplicar a busca. */
const DEBOUNCE_MS = 400;

const CLASSE_CAMPO =
  "w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none";

const mensagemDe = (e: unknown, padrao: string): string => (e instanceof Error ? e.message : padrao);

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface TarefasProps {
  /** Quem está logado — vem do App, que decodificou o token. */
  usuario: Usuario;
  /** Avisa o App para encerrar a sessão (quem apaga o token é o App). */
  aoSair: (mensagem?: string) => void;
}

export default function Tarefas({ usuario, aoSair }: TarefasProps) {
  // --- dados ---------------------------------------------------------------
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  // --- busca ---------------------------------------------------------------
  // `busca` muda a cada tecla (input fluido); `buscaAplicada` só muda depois
  // do debounce, e é ela que vai para a API.
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");

  // --- formulário de criação ----------------------------------------------
  const [titulo, setTitulo] = useState("");
  const [prioridade, setPrioridade] = useState<Prioridade>(PRIORIDADE_INICIAL);
  const [criando, setCriando] = useState(false);

  // --- filtro e modal ------------------------------------------------------
  const [filtroPrioridade, setFiltroPrioridade] = useState<FiltroPrioridade>("todas");
  const [paraExcluir, setParaExcluir] = useState<Tarefa | null>(null);

  /**
   * Trata qualquer erro das chamadas. Se for sessão expirada (401), devolve
   * a pessoa para o login com o aviso; senão mostra a mensagem na tela.
   */
  const tratarErro = useCallback(
    (e: unknown, padrao: string): void => {
      if (e instanceof SessaoExpiradaError) {
        aoSair(e.message);
        return;
      }
      setErro(mensagemDe(e, padrao));
    },
    [aoSair],
  );

  /**
   * Controle de concorrência. Cada carga recebe um número; só a mais recente
   * pode mexer na lista. Assim a resposta atrasada da busca "c" não
   * sobrescreve o resultado de "ca".
   *
   * É useRef (e não useState) porque mudar o contador não precisa redesenhar
   * a tela, e o callback assíncrono sempre lê o valor atual em .current.
   */
  const requisicaoAtual = useRef(0);

  /** Último termo realmente aplicado — só é lido dentro do timer. */
  const ultimaBusca = useRef("");

  /**
   * Recarrega a lista depois de criar, concluir ou excluir.
   * useCallback memoriza a função entre renders e só a recria quando
   * buscaAplicada muda.
   */
  const carregar = useCallback(async (): Promise<void> => {
    const meuId = ++requisicaoAtual.current;
    try {
      const dados = await listarTarefas(buscaAplicada);
      // Outra requisição começou enquanto esta viajava: descarta.
      if (meuId !== requisicaoAtual.current) return;
      setTarefas(dados);
      setErro("");
    } catch (e) {
      if (meuId !== requisicaoAtual.current) return;
      tratarErro(e, "Não foi possível carregar suas tarefas.");
    } finally {
      if (meuId === requisicaoAtual.current) setCarregando(false);
    }
  }, [buscaAplicada, tratarErro]);

  /**
   * Debounce ("efeito máquina de escrever"). A função de limpeza cancela o
   * timer anterior se outra tecla for digitada antes de 400 ms. Digitar
   * "comprar" gera 1 requisição em vez de 7.
   *
   * O setCarregando fica dentro do timer e depois do `if`: se o termo não
   * mudou (ex.: na montagem), nenhuma busca sai e a tela não pode ficar
   * presa em "Carregando...".
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      const termo = busca.trim();
      if (termo === ultimaBusca.current) return;
      ultimaBusca.current = termo;
      setCarregando(true);
      setBuscaAplicada(termo);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [busca]);

  /**
   * Busca na montagem e sempre que a busca aplicada mudar.
   *
   * O estado só é tocado dentro dos callbacks do .then (padrão recomendado
   * pelo React para buscar dados em efeito). São duas travas:
   *   - `ativo`: limpeza do efeito; se a busca mudar ou a tela sair antes da
   *     resposta, ela é ignorada;
   *   - `requisicaoAtual`: descarta respostas fora de ordem, inclusive as
   *     disparadas pelos botões (criar, concluir, excluir).
   */
  useEffect(() => {
    const meuId = ++requisicaoAtual.current;
    let ativo = true;

    listarTarefas(buscaAplicada).then(
      (dados) => {
        if (!ativo || meuId !== requisicaoAtual.current) return;
        setTarefas(dados);
        setErro("");
        setCarregando(false);
      },
      (e: unknown) => {
        if (!ativo || meuId !== requisicaoAtual.current) return;
        tratarErro(e, "Não foi possível carregar suas tarefas.");
        setCarregando(false);
      },
    );

    return () => {
      ativo = false;
    };
  }, [buscaAplicada, tratarErro]);

  // --- ações ---------------------------------------------------------------

  const criar = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    const tituloLimpo = titulo.trim();
    if (tituloLimpo.length < 3) {
      setErro("O título da tarefa deve ter pelo menos 3 caracteres.");
      return;
    }

    setErro("");
    setCriando(true);
    try {
      await criarTarefa(tituloLimpo, prioridade);
      setTitulo("");
      setPrioridade(PRIORIDADE_INICIAL);
      await carregar();
    } catch (e) {
      tratarErro(e, "Não foi possível criar a tarefa.");
    } finally {
      setCriando(false);
    }
  };

  const alternarStatus = async (tarefa: Tarefa): Promise<void> => {
    const novoStatus: Status = tarefa.status === "completed" ? "pending" : "completed";
    setErro("");
    try {
      // O await garante a ordem: grava primeiro, depois relê a lista.
      await atualizarTarefa(tarefa.id, { status: novoStatus });
      await carregar();
    } catch (e) {
      tratarErro(e, "Não foi possível atualizar a tarefa.");
    }
  };

  const confirmarExcluir = async (): Promise<void> => {
    const alvo = paraExcluir;
    if (!alvo) return;

    setParaExcluir(null); // fecha o modal sem esperar a rede
    setErro("");
    try {
      await deletarTarefa(alvo.id);
      await carregar();
    } catch (e) {
      tratarErro(e, "Não foi possível excluir a tarefa.");
    }
  };

  // Referência estável para o useEffect do modal não re-executar à toa.
  const fecharModal = useCallback(() => setParaExcluir(null), []);

  // --- números e lista derivada -------------------------------------------

  const total = tarefas.length;
  const concluidas = tarefas.filter((t) => t.status === "completed").length;
  const pendentes = total - concluidas;
  const progresso = total === 0 ? 0 : Math.round((concluidas / total) * 100);

  /**
   * A lista da tela é uma DERIVAÇÃO de tarefas + filtro, não um estado novo.
   * useMemo só refaz o filter quando um dos dois muda.
   */
  const tarefasFiltradas = useMemo(
    () => (filtroPrioridade === "todas" ? tarefas : tarefas.filter((t) => t.prioridade === filtroPrioridade)),
    [tarefas, filtroPrioridade],
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-10">
      {/* 1. cabeçalho */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Minhas Tarefas</h1>
          <p className="mt-1 text-sm text-slate-400">
            Conectado como <span className="text-slate-200">{usuario.email}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => aoSair()}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Sair
        </button>
      </header>

      {/* 2. nova tarefa */}
      <form
        onSubmit={criar}
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
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {PRIORIDADES_PT[p]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={criando}
          className="flex items-center justify-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {criando && <Spinner escuro />}
          {criando ? "Criando..." : "Adicionar"}
        </button>
      </form>

      {/* 3. busca */}
      <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
        Buscar por título
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite para filtrar..."
          className={CLASSE_CAMPO}
        />
      </label>

      {/* 4. filtro por prioridade (local) */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por prioridade">
        {FILTROS.map((f) => {
          const ativo = filtroPrioridade === f;
          const corAtivo = f === "todas" ? "bg-white/10 text-white ring-white/30" : COR_PRIORIDADE[f];
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFiltroPrioridade(f)}
              aria-pressed={ativo}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                ativo ? corAtivo : "bg-slate-800 text-slate-300 ring-slate-700 hover:bg-slate-700"
              }`}
            >
              {f === "todas" ? "Todas" : PRIORIDADES_PT[f]}
            </button>
          );
        })}
      </div>

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

      {/* 5. lista */}
      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
        <div aria-live="polite" className="mb-3">
          <p className="text-sm text-slate-400">
            {carregando ? "Carregando..." : `${pendentes} pendente(s) e ${concluidas} concluída(s).`}
          </p>
          {!carregando && total > 0 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800" aria-hidden="true">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progresso}%` }} />
            </div>
          )}
        </div>

        {carregando ? (
          <div className="flex items-center justify-center gap-3 py-8 text-sm text-slate-500">
            <Spinner />
            Buscando suas tarefas...
          </div>
        ) : total === 0 ? (
          <ListaVazia busca={buscaAplicada} />
        ) : tarefasFiltradas.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-slate-300">
              Nenhuma tarefa com prioridade {filtroPrioridade === "todas" ? "" : PRIORIDADES_PT[filtroPrioridade]}.
            </p>
            <button
              type="button"
              onClick={() => setFiltroPrioridade("todas")}
              className="mt-2 text-sm text-slate-400 underline transition hover:text-white"
            >
              Mostrar todas
            </button>
          </div>
        ) : (
          <ul className="flex max-h-[60vh] list-none flex-col gap-2 overflow-y-auto p-0 pr-1">
            {tarefasFiltradas.map((t) => (
              <ItemTarefa
                key={t.id}
                tarefa={t}
                aoAlternar={() => void alternarStatus(t)}
                aoExcluir={() => setParaExcluir(t)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 6. modal de exclusão */}
      {paraExcluir && (
        <ModalExclusao tarefa={paraExcluir} aoCancelar={fecharModal} aoConfirmar={() => void confirmarExcluir()} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------------

function Spinner({ escuro = false }: { escuro?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-4 animate-spin rounded-full border-2 ${
        escuro ? "border-slate-900/30 border-t-slate-900" : "border-slate-600 border-t-slate-200"
      }`}
    />
  );
}

function ListaVazia({ busca }: { busca: string }) {
  return (
    <div className="py-10 text-center">
      <p className="text-slate-300">
        {busca ? `Nenhuma tarefa contém "${busca}".` : "Nenhuma tarefa por aqui ainda."}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {busca ? "Tente outro termo de busca." : "Use o formulário acima para criar a primeira."}
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
  const feita = tarefa.status === "completed";

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${feita ? "text-slate-500 line-through" : "text-slate-100"}`}>
          {tarefa.titulo}
        </p>
        <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ring-1 ${COR_PRIORIDADE[tarefa.prioridade]}`}>
          {PRIORIDADES_PT[tarefa.prioridade]}
        </span>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={aoAlternar}
          className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          {feita ? "Reabrir" : "Concluir"}
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
    const aoTeclar = (e: KeyboardEvent): void => {
      if (e.key === "Escape") aoCancelar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
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
          <span className="text-slate-200">{tarefa.titulo}</span> será removida permanentemente. Não dá para desfazer.
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
