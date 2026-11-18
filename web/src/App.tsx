/**
 * App.tsx — escolhe a tela: sem usuário mostra o Login, com usuário mostra
 * a lista de tarefas. O "está logado" sai direto do estado `usuario`, assim
 * não existe um segundo estado que possa ficar fora de sincronia.
 */

import { useState } from "react";
import Login from "./Login";
import Tarefas from "./Tarefas";
import { apagarToken, usuarioLogado, type Usuario } from "./api";

export default function App() {
  // Função como valor inicial: o token só é lido uma vez, na montagem.
  const [usuario, setUsuario] = useState<Usuario | null>(usuarioLogado);

  const sair = (): void => {
    apagarToken(); // o único lugar do front que encerra a sessão
    setUsuario(null);
  };

  if (!usuario) {
    return <Login aoEntrar={() => setUsuario(usuarioLogado())} />;
  }

  return <Tarefas usuario={usuario} aoSair={sair} />;
}
