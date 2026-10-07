import{useState} from "react";


function App(){
  const[contador, setContador] = useState(0);

  function incrementar(){
    setContador(contador + 1);
  }
   
  function decrementar(){
    setContador(contador - 1);
  }

  return (
    <>
    <h2> Total de clics: {contador}</h2>

    <button onClick={incrementar}>
      Adicionar +1
    </button>

    <button onClick={decrementar}>
      Remover +1
    </button>
    </>

  )

}
 

export default App ;