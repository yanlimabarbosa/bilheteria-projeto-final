# Guia: preparar o projeto e o servidor

Siga na ordem. Cada passo termina com um comando que mostra se deu certo.

## 0. O que precisa estar instalado

- **Node.js 22 ou mais novo** (a correção roda no 22). Confira com `node -v`.
- **Git**, para o repositório do grupo. Confira com `git --version`.

## 1. Instalar as dependências

O `package.json` e o `tsconfig.json` já vêm prontos. Dentro da pasta do repositório:

```bash
npm install
```

Confira: `npm test` roda e mostra `0 de 16`. Os arquivos que vocês escrevem estão vazios, por isso os testes falham.

Os imports levam a extensão: `import { Evento } from "./dominio.ts";`. O `tsx` roda o código mesmo
com erro de tipo, então rode o `npm run typecheck` de vez em quando.

## 2. Express em uma página

O `servidor.ts` do projeto vem pronto. Este exemplo, com **outro** assunto (uma lista de tarefas),
mostra as peças que ele usa, para vocês lerem o arquivo e explicarem no vídeo.

```ts
// src/exemplo.ts
import express from "express";
import type { NextFunction, Request, Response } from "express";

class TarefaNaoEncontrada extends Error {
  readonly status = 404;
}

const tarefas = [{ id: 1, titulo: "estudar" }];

export function criarApp() {
  const app = express();
  app.use(express.json());              // transforma o corpo JSON em objeto: req.body

  app.get("/tarefas", (req, res) => {   // GET: devolve dados
    res.json(tarefas);                  // status 200 é o padrão
  });

  app.get("/tarefas/:id", (req, res) => {
    const tarefa = tarefas.find((t) => t.id === Number(req.params.id));
    if (!tarefa) throw new TarefaNaoEncontrada("não existe");
    res.json(tarefa);
  });

  app.post("/tarefas", async (req, res) => {   // POST: recebe dados em req.body
    const nova = { id: tarefas.length + 1, titulo: req.body.titulo };
    tarefas.push(nova);
    res.status(201).json(nova);         // 201 = criado
  });

  // Tratador de erro: tem 4 parâmetros e fica depois das rotas.
  // Um throw em qualquer rota, até nas async, vem parar aqui.
  app.use((erro: unknown, req: Request, res: Response, next: NextFunction) => {
    if (erro instanceof TarefaNaoEncontrada) {
      res.status(erro.status).json({ mensagem: erro.message });
    } else {
      res.status(500).json({ mensagem: "erro interno" });
    }
  });

  return app;
}

// Quem liga o servidor é outro arquivo (no projeto, o main.ts):
//   criarApp().listen(3000, () => console.log("no ar"));
```

Teste no terminal, com o servidor no ar:

```bash
curl localhost:3000/tarefas
curl localhost:3000/tarefas/9                       # 404
curl -X POST localhost:3000/tarefas -H 'Content-Type: application/json' -d '{"titulo":"dormir"}'
```

Sem o cabeçalho `Content-Type: application/json`, o `express.json()` não lê o corpo e o
`req.body` fica `undefined`.

## 3. Ordem sugerida

1. Ler o `tipos.ts` (pronto). Depois `regras.ts` e `preco.ts`: não dependem de nada. Rode `npm test` a cada função.
2. `dominio.ts`: os erros e o `Evento`.
3. `bilheteria.ts`: usa os três anteriores e a operadora de `pagamento.ts`.
4. `main.ts` (o `servidor.ts` vem pronto). Depois, `npm start` num terminal e `npm run bench` em outro.
5. `README.md`.
