/**
 * App.tsx — o "cérebro" da sessão.
 *
 * Decide qual tela aparece olhando só para uma coisa: existe usuário?
 *   - não -> <Login />
 *   - sim -> <Tarefas />
 *
 * O App não sabe nada de tarefas. Ele é dono da sessão (Lifting State Up):
 * o Login avisa quando entrou (aoLogar) e o Tarefas avisa quando a pessoa
 * quer sair (aoSair). Quem apaga o token é sempre o App.
 */

import { useCallback, useState } from "react";
import Login from "./Login";
import Tarefas from "./Tarefas";
import { clearToken, getUsuario, type Usuario } from "./api";

export default function App() {
  /**
   * Lazy initialization: passando a função () => getUsuario(), o React só a
   * executa na montagem. Com getUsuario() direto, o localStorage seria lido e
   * o token decodificado a cada re-render (a cada tecla nos formulários).
   */
  const [usuario, setUsuario] = useState<Usuario | null>(() => getUsuario());

  /** Mensagem mostrada no Login quando a sessão cai sozinha (401). */
  const [aviso, setAviso] = useState("");

  /**
   * Estado derivado: "logado" é calculado a partir de `usuario`, não é um
   * segundo useState. Assim não existe chance de logado = true com
   * usuario = null. Um estado a menos é uma classe de bugs a menos.
   */
  const logado = usuario !== null;

  /** Chamado pelo Login depois que o token foi salvo. */
  const aoLogar = (): void => {
    setAviso("");
    setUsuario(getUsuario());
  };

  /**
   * Chamado pelo botão "Sair" do Tarefas, ou quando a API responde 401.
   * Único lugar do front que encerra a sessão. O useCallback mantém a
   * mesma referência entre renders (o Tarefas usa essa função no carregar).
   */
  const aoSair = useCallback((mensagem = ""): void => {
    clearToken();
    setAviso(mensagem);
    setUsuario(null);
  }, []);

  if (!logado) {
    return <Login aoLogar={aoLogar} aviso={aviso} />;
  }

  return <Tarefas usuario={usuario} aoSair={aoSair} />;
}
