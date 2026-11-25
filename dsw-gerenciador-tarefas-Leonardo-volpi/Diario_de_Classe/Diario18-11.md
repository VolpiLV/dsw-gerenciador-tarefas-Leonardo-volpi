# Diário: configurando o Node.js e o npm no Windows

**Data:** 18/11/2026

## O que foi feito

Fui rodar o projeto e o comando `npm install` não funcionava no terminal do VS Code. Passei por três erros em sequência até conseguir instalar as dependências. Abaixo está o passo a passo de cada erro e como resolvi.

### 1. Instalar o Node.js

```powershell
winget install OpenJS.NodeJS.LTS
```

No meu caso o Node já estava instalado (o winget respondeu "Foi encontrado um pacote existente já instalado"). Ele fica em `C:\Program Files\nodejs\`.

### 2. Erro: "O termo 'npm' não é reconhecido"

```
npm : O termo 'npm' não é reconhecido como nome de cmdlet, função, arquivo de script ou programa operável.
```

**Causa:** o terminal foi aberto **antes** da instalação do Node, então ele ainda usa o PATH antigo, que não tem a pasta do Node. Os terminais novos abertos dentro do VS Code herdam o PATH do próprio VS Code, então só abrir outro terminal não resolve.

**Solução definitiva:** fechar o VS Code inteiro (todas as janelas) e abrir de novo.

**Solução rápida (só para o terminal atual):**

```powershell
$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
```

Para conferir se funcionou:

```powershell
node -v
npm -v
```

### 3. Erro: "a execução de scripts foi desabilitada neste sistema"

```
npm : O arquivo C:\Program Files\nodejs\npm.ps1 não pode ser carregado porque a execução de scripts foi desabilitada neste sistema.
```

**Causa:** o Windows bloqueia por padrão a execução de scripts do PowerShell (`.ps1`), e o comando `npm` no PowerShell é um script desses.

**Solução:** liberar scripts só para o meu usuário (não precisa de administrador). Se perguntar, responder **S**:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Outra opção, sem mudar nenhuma configuração, é usar a versão `.cmd` do npm: `npm.cmd install`.

### 4. Erro: "O termo 'npm.cmd' não é reconhecido"

Esse erro aparece quando a solução rápida do passo 2 foi feita em outro terminal. A variável `$env:Path` só vale para o terminal onde foi definida.

**Solução:** reiniciar o VS Code (passo 2) ou chamar o npm pelo caminho completo:

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
```

### 5. Rodar o projeto

```powershell
npm install          # instala as dependências do servidor
npm run dev          # inicia o servidor e reinicia sozinho quando o código muda
npm start            # inicia o servidor uma vez
npm run dev:web      # inicia o front-end (pasta web)
```

Se o servidor reclamar do `esbuild` (o npm avisou que o script de instalação dele não foi executado), rode:

```powershell
npm install-scripts approve esbuild
npm rebuild esbuild
```

## Por que isso é importante

Sem o Node e o npm funcionando não dá para instalar as dependências nem rodar o servidor. Entender a causa de cada erro (PATH desatualizado e política de execução de scripts) ajuda a resolver o mesmo problema em outro computador, como os do laboratório.

## Dificuldades

- O Node estava instalado, mas o terminal dizia que o `npm` não existia. Demorei para entender que o problema era o terminal, e não a instalação.
- Corrigi o PATH em um terminal e depois usei outro, que voltou a dar erro.

## O que aprendi

- O **PATH** é a lista de pastas onde o sistema procura os programas. Programas instalados depois que o terminal abriu só aparecem depois de reiniciar o terminal (no VS Code, o editor inteiro).
- O PowerShell tem uma **política de execução** que pode bloquear scripts, e o `RemoteSigned` no escopo do usuário é a configuração comum para quem programa.
- Quando um comando não é encontrado, dá para chamar o programa pelo **caminho completo**.
