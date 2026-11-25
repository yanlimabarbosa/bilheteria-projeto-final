// Abertura de vendas: dispara muitos pedidos ao mesmo tempo contra o serviço no ar.
// Pronto. Use os números na apresentação.
//   npm start            (num terminal)
//   npm run bench        (em outro)          ou   npm run bench -- 500 2
//                                                  pedidos ^   ^ eventoId
const pedidos = Number(process.argv[2] ?? 200);
const eventoId = Number(process.argv[3] ?? 1);
const url = process.env.URL ?? "http://localhost:3000";

// Cada pedido escolhe uma poltrona; com mais pedidos que poltronas, várias pessoas disputam a mesma.
const lista = await fetch(`${url}/eventos`).then((r) => r.json());
const capacidade: number = lista.find((e: { id: number }) => e.id === eventoId)?.capacidade ?? 1;

const inicio = performance.now();
const respostas = await Promise.all(
  Array.from({ length: pedidos }, (_, i) =>
    fetch(`${url}/reservas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventoId,
        ingressos: [{ nome: `cliente${i}`, idade: 20 + (i % 50), estudante: i % 3 === 0, pcd: false, poltrona: (i % capacidade) + 1 }],
      }),
    }).then((r) => r.status),
  ),
);
const ms = performance.now() - inicio;

const contagem = respostas.reduce<Record<number, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});
console.log(`${pedidos} pedidos em ${ms.toFixed(0)} ms (${((pedidos / ms) * 1000).toFixed(0)} pedidos/s)`);
console.log("por status HTTP:", contagem, " (201 vendido, 409 poltrona ocupada, 502 pagamento)");
const eventos = await fetch(`${url}/eventos`).then((r) => r.json());
console.log("eventos agora:", eventos);
