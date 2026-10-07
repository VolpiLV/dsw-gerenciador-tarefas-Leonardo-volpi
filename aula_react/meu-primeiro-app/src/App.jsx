import Botao from "./Botao";

function App(){
  return (
    <div>
      <h1>Minha pagina com componentes coustomisados </h1>
      <p>Abaixo componente botao customizado via props: </p>

      <Botao texto="confirmar" cor="#28a745" />

    </div>
  );
};

export default App ;