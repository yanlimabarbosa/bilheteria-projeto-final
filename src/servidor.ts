// Camada HTTP com Express. Só monta o app: quem chama listen() é o main.ts.
import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { Bilheteria } from "./bilheteria.ts";
import { ErroDeNegocio } from "./dominio.ts";

export function criarServidor(bilheteria: Bilheteria) {
  const app = express();
  app.use(express.json());

  app.get("/eventos", (req, res) => {
    res.json(bilheteria.listarEventos());
  });

  app.post("/reservas", async (req, res) => {
    const comprovante = await bilheteria.reservar(req.body);
    res.status(201).json(comprovante);
  });

  // O Express 5 manda para cá o erro de qualquer rota, inclusive das async.
  // Ele só reconhece o tratador de erro pelos 4 parâmetros, mesmo sem usar o `next`.
  app.use((erro: Error, req: Request, res: Response, next: NextFunction) => {
    if (erro instanceof ErroDeNegocio) {
      res.status(erro.status).json({ mensagem: erro.message });
    } else if (erro instanceof SyntaxError) {
      res.status(400).json({ mensagem: "JSON inválido" });
    } else {
      console.error(erro);
      res.status(500).json({ mensagem: "erro interno" });
    }
  });

  return app;
}
