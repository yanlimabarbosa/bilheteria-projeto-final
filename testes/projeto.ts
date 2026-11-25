import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AddressInfo } from "node:net";
import { proibir, semComentarios, type Teste } from "./executar.ts";

const importar = (m: any, arq: string) => import(pathToFileURL(join(m.pasta, arq)).href);
const fonte = (m: any, arq: string) => semComentarios(readFileSync(join(m.pasta, arq), "utf8"));
const exigir = (fonte: string, lista: Array<[RegExp, string]>): void => {
  const faltando = lista.filter(([re]) => !re.test(fonte)).map(([, nome]) => nome);
  if (faltando.length > 0) throw new Error(`falta usar ${faltando.join(", ")}`);
};
const esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const pessoa = (nome: string, poltrona = 1, idade = 30, estudante = false, pcd = false) => ({
  nome,
  idade,
  estudante,
  pcd,
  poltrona,
});

// Operadora falsa com contadores. `roteiro` decide cada cobrança pela ordem: "ok", "falha" ou ms de demora.
function operadora(latenciaMs = 20) {
  const estado = { cobrancas: 0, aprovadas: 0, roteiro: [] as Array<"ok" | "falha" | number> };
  const pagar = async (valor: number) => {
    const passo = estado.roteiro.shift() ?? "ok";
    estado.cobrancas++;
    await esperar(typeof passo === "number" ? passo : latenciaMs);
    if (passo === "falha" || valor <= 0) throw new Error("operadora instável");
    estado.aprovadas++;
  };
  return { estado, pagar };
}

async function montar(m: any, capacidades: number[], op = operadora(), extra: Record<string, unknown> = {}) {
  const { Evento } = await importar(m, "dominio.ts");
  const { criarBilheteria } = await importar(m, "bilheteria.ts");
  const eventos = capacidades.map((c, i) => new Evento(i + 1, `Evento ${i + 1}`, 100, c));
  const b = criarBilheteria({ eventos, pagar: op.pagar, limitePagamentoMs: 300, ...extra });
  return { b, eventos, op };
}

const nomeDoErro = async (p: Promise<unknown>) => {
  try {
    await p;
    return "nenhum";
  } catch (e) {
    return (e as Error).constructor.name;
  }
};

export const testes: Teste[] = [
  // ---------------------------------------------------------------- OO (dominio.ts)
  {
    nome: "OO: erros de negócio com herança e status HTTP",
    peso: 1,
    rodar: async (m) => {
      const d = await importar(m, "dominio.ts");
      const esperado: Record<string, number> = {
        DadosInvalidosErro: 400,
        NaoEncontradoErro: 404,
        PoltronaOcupadaErro: 409,
        PagamentoErro: 502,
      };
      for (const [classe, status] of Object.entries(esperado)) {
        const e: any = new d[classe]("x");
        assert.equal(e instanceof d.ErroDeNegocio, true, `${classe} não herda de ErroDeNegocio`);
        assert.equal(e instanceof Error, true);
        assert.equal(e.status, status, `${classe}.status`);
        assert.equal(e.message, "x");
      }
    },
  },
  {
    nome: "OO: Evento reserva, libera e protege as poltronas",
    peso: 1,
    rodar: async (m) => {
      const d = await importar(m, "dominio.ts");
      const e = new d.Evento(7, "Show", 50, 3);
      assert.equal(e.disponivel, 3);
      e.reservar([1, 2]);
      assert.equal(e.disponivel, 1);
      assert.throws(() => e.reservar([2]), (x: any) => x instanceof d.PoltronaOcupadaErro, "vendeu a poltrona 2 duas vezes");
      assert.throws(() => e.reservar([0]), (x: any) => x instanceof d.DadosInvalidosErro, "aceitou a poltrona 0");
      assert.throws(() => e.reservar([4]), (x: any) => x instanceof d.DadosInvalidosErro, "aceitou a poltrona 4 num evento de 3");
      assert.throws(() => e.reservar([]), (x: any) => x instanceof d.DadosInvalidosErro, "aceitou lista vazia");
      e.liberar([1]);
      assert.equal(e.disponivel, 2);
      assert.throws(() => e.liberar([1]), (x: any) => x instanceof d.DadosInvalidosErro, "liberou uma poltrona que não estava vendida");
      e.reservar([1]);
      assert.deepEqual(e.info(), { id: 7, nome: "Show", preco: 50, capacidade: 3, disponivel: 1 });
      try {
        (e as any).disponivel = 999;
      } catch {
        // atribuir a um getter sem setter estoura TypeError: também conta como protegido
      }
      assert.equal(e.disponivel, 1, "dá para mudar as poltronas por fora da classe");
    },
  },
  {
    nome: "OO: Evento reserva todas as poltronas do pedido ou nenhuma",
    peso: 1,
    rodar: async (m) => {
      const d = await importar(m, "dominio.ts");
      const e = new d.Evento(1, "Show", 50, 5);
      e.reservar([2]);
      assert.throws(() => e.reservar([1, 2, 3]), (x: any) => x instanceof d.PoltronaOcupadaErro);
      assert.equal(e.disponivel, 4, "marcou parte do pedido que foi recusado");
      assert.throws(() => e.reservar([4, 4]), (x: any) => x instanceof d.DadosInvalidosErro, "aceitou a mesma poltrona duas vezes no pedido");
      assert.equal(e.disponivel, 4, "marcou parte do pedido que foi recusado");
      e.reservar([1, 3]);
      assert.equal(e.disponivel, 2);
    },
  },
  // ---------------------------------------------------------------- Funcional (preco.ts)
  {
    nome: "Funcional: valorDoIngresso e aplicarTaxa devolvem funções",
    peso: 1,
    rodar: async (m) => {
      const p = await importar(m, "preco.ts");
      const de80 = p.valorDoIngresso(80);
      assert.equal(typeof de80, "function");
      assert.equal(de80("inteira"), 80);
      assert.equal(de80("meia"), 40);
      assert.equal(p.valorDoIngresso(45.5)("meia"), 22.75);
      assert.equal(p.aplicarTaxa(0.1)(100), 110);
      assert.equal(p.aplicarTaxa(0.1)(33.33), 36.66);
      assert.equal(p.aplicarTaxa(0)(10), 10);
    },
  },
  {
    nome: "Funcional: montarIngressos e calcularTotal sem alterar a entrada",
    peso: 1,
    rodar: async (m) => {
      const p = await importar(m, "preco.ts");
      const pessoas = Object.freeze([pessoa("Ana", 4, 20, true), pessoa("Beto", 5), pessoa("Caio", 6, 70)].map((x) => Object.freeze(x)));
      const ingressos = p.montarIngressos(100, pessoas, (x: any) => x.estudante || x.idade >= 60);
      assert.deepEqual(ingressos, [
        { nome: "Ana", poltrona: 4, tipo: "meia", valor: 50 },
        { nome: "Beto", poltrona: 5, tipo: "inteira", valor: 100 },
        { nome: "Caio", poltrona: 6, tipo: "meia", valor: 50 },
      ]);
      const soBetoTemMeia = p.montarIngressos(100, pessoas, (x: any) => x.nome === "Beto");
      assert.deepEqual(
        soBetoTemMeia.map((i: any) => i.tipo),
        ["inteira", "meia", "inteira"],
        "montarIngressos tem que usar a função recebida para decidir a meia",
      );
      assert.equal(p.calcularTotal(Object.freeze(ingressos.map((i: any) => Object.freeze(i)))), 220);
      assert.equal(p.calcularTotal([]), 0);
    },
  },
  {
    nome: "Funcional: preco.ts usa map, reduce e aplicarTaxa, sem laço nem mutação",
    peso: 1,
    rodar: async (m) => {
      const p = await importar(m, "preco.ts");
      assert.equal(p.aplicarTaxa(0.1)(100), 110); // não pontua o esqueleto
      const codigo = fonte(m, "preco.ts");
      exigir(codigo, [
        [/\.map\s*\(/, "map"],
        [/\.reduce\s*\(/, "reduce"],
        [/(?<!function\s)\baplicarTaxa\s*\(/, "aplicarTaxa (chamar para somar a taxa no calcularTotal)"],
      ]);
      proibir(codigo, [
        [/\blet\s/, "let"],
        [/\bvar\s/, "var"],
        [/\bfor\s*\(/, "for"],
        [/\bwhile\s*\(/, "while"],
        [/\.push\s*\(/, "push"],
        [/\.forEach\s*\(/, "forEach"],
        [/\bclass\s/, "class"],
      ]);
    },
  },
  // ---------------------------------------------------------------- Meia-entrada (regras.ts)
  {
    nome: "Regras: direitoAMeia",
    peso: 1,
    rodar: async (m) => {
      const r = await importar(m, "regras.ts");
      assert.equal(r.direitoAMeia(pessoa("Ana", 1, 20, true)), true);
      assert.equal(r.direitoAMeia(pessoa("Beto", 1, 30)), false);
      assert.equal(r.direitoAMeia(pessoa("Caio", 1, 60)), true);
      assert.equal(r.direitoAMeia(pessoa("Davi", 1, 59)), false);
      assert.equal(r.direitoAMeia(pessoa("Eva", 1, 35, false, true)), true);
    },
  },
  // ---------------------------------------------------------------- Concorrente (bilheteria.ts)
  {
    nome: "Concorrente: reserva simples gera comprovante com meia e taxa",
    peso: 1,
    rodar: async (m) => {
      const { b } = await montar(m, [10]);
      const c = await b.reservar({ eventoId: 1, ingressos: [pessoa("Ana", 1, 20, true), pessoa("Beto", 2)] });
      assert.equal(c.eventoId, 1);
      assert.deepEqual(c.ingressos, [
        { nome: "Ana", poltrona: 1, tipo: "meia", valor: 50 },
        { nome: "Beto", poltrona: 2, tipo: "inteira", valor: 100 },
      ]);
      assert.equal(c.total, 165);
      const c2 = await b.reservar({ eventoId: 1, ingressos: [pessoa("Caio", 3)] });
      assert.notEqual(c2.reservaId, c.reservaId, "reservaId repetido");
      assert.equal(b.listarEventos()[0].disponivel, 7);
    },
  },
  {
    nome: "Concorrente: pedido inválido e evento inexistente",
    peso: 1,
    rodar: async (m) => {
      const { b, op } = await montar(m, [10]);
      assert.equal(await nomeDoErro(b.reservar({ eventoId: 1, ingressos: [] })), "DadosInvalidosErro");
      assert.equal(await nomeDoErro(b.reservar({ eventoId: 99, ingressos: [pessoa("A")] })), "NaoEncontradoErro");
      assert.equal(await nomeDoErro(b.reservar({ eventoId: 1, ingressos: [pessoa("A", 11)] })), "DadosInvalidosErro");
      assert.equal(op.estado.cobrancas, 0, "cobrou um pedido inválido");
    },
  },
  {
    nome: "Concorrente: 200 pedidos simultâneos disputando 50 poltronas",
    peso: 2,
    rodar: async (m) => {
      const { b, op } = await montar(m, [50]);
      const r = await Promise.allSettled(
        Array.from({ length: 200 }, (_, i) => b.reservar({ eventoId: 1, ingressos: [pessoa(`c${i}`, (i % 50) + 1)] })),
      );
      const vendidos = r.filter((x) => x.status === "fulfilled").length;
      assert.equal(vendidos, 50, `vendeu ${vendidos} de 50`);
      assert.equal(b.listarEventos()[0].disponivel, 0);
      const ocupadas = r.filter((x) => x.status === "rejected" && x.reason?.constructor?.name === "PoltronaOcupadaErro").length;
      assert.equal(ocupadas, 150, "os recusados deveriam ser PoltronaOcupadaErro");
      assert.equal(op.estado.aprovadas, 50, `cobrou ${op.estado.aprovadas} pessoas por 50 poltronas`);
    },
  },
  {
    nome: "Concorrente: pedidos não esperam uns pelos outros",
    peso: 1,
    rodar: async (m) => {
      const { b } = await montar(m, [100, 100], operadora(100));
      const inicio = Date.now();
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => b.reservar({ eventoId: (i % 2) + 1, ingressos: [pessoa(`c${i}`, i + 1)] })),
      );
      const gasto = Date.now() - inicio;
      assert.ok(gasto < 600, `20 pedidos levaram ${gasto} ms; um a um levariam 2000 ms`);
    },
  },
  {
    nome: "Concorrente: pagamento recusado devolve as poltronas",
    peso: 1,
    rodar: async (m) => {
      const op = operadora();
      op.estado.roteiro.push("falha");
      const { b } = await montar(m, [5], op);
      assert.equal(await nomeDoErro(b.reservar({ eventoId: 1, ingressos: [pessoa("Ana", 1), pessoa("Bia", 2)] })), "PagamentoErro");
      assert.equal(op.estado.cobrancas, 1);
      assert.equal(b.listarEventos()[0].disponivel, 5, "as poltronas não voltaram para a venda");
      const c = await b.reservar({ eventoId: 1, ingressos: [pessoa("Ana", 1), pessoa("Bia", 2)] });
      assert.equal(c.total, 220, "as poltronas 1 e 2 deveriam estar livres de novo");
    },
  },
  {
    nome: "Concorrente: tempo limite na operadora",
    peso: 1,
    rodar: async (m) => {
      const op = operadora();
      op.estado.roteiro.push(5000);
      const { b } = await montar(m, [5], op, { limitePagamentoMs: 100 });
      const inicio = Date.now();
      assert.equal(await nomeDoErro(b.reservar({ eventoId: 1, ingressos: [pessoa("Ana")] })), "PagamentoErro");
      const gasto = Date.now() - inicio;
      assert.ok(gasto < 1000, `esperou ${gasto} ms pela operadora travada`);
      assert.equal(b.listarEventos()[0].disponivel, 5);
    },
  },
  // ---------------------------------------------------------------- Serviço HTTP de ponta a ponta
  {
    nome: "Serviço HTTP: abertura de vendas com 120 pedidos simultâneos",
    peso: 2,
    rodar: async (m) => {
      const { criarServidor } = await importar(m, "servidor.ts");
      const { b } = await montar(m, [30]);
      const app = criarServidor(b);
      // vale app do Express ou http.Server: os dois têm listen()
      const servidor: any = await new Promise((ok) => {
        const s = app.listen(0, "127.0.0.1", () => ok(s));
      });
      const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
      try {
        const status = await Promise.all(
          Array.from({ length: 120 }, (_, i) =>
            fetch(`${url}/reservas`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ eventoId: 1, ingressos: [pessoa(`c${i}`, (i % 30) + 1)] }),
            }).then((r) => r.status),
          ),
        );
        assert.equal(status.filter((s) => s === 201).length, 30);
        assert.equal(status.filter((s) => s === 409).length, 90);
        const eventos = await fetch(`${url}/eventos`).then((r) => r.json());
        assert.equal(eventos[0].disponivel, 0);
        const r404 = await fetch(`${url}/reservas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventoId: 9, ingressos: [pessoa("a")] }),
        });
        assert.equal(r404.status, 404);
      } finally {
        servidor.close();
      }
    },
  },
];
