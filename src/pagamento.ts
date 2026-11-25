// Operadora de pagamento FALSA, para rodar sem internet. Pronto: não altere.
//   const pagar = criarPagamentoFalso({ latenciaMs: 80, taxaDeFalha: 0.1 });
//   await pagar(150);   // resolve se passou, rejeita se falhou

// Uma operadora é uma função que recebe o valor e devolve uma Promise.
export type Pagamento = (valor: number) => Promise<void>;

export interface OpcoesPagamento {
  latenciaMs: number; // quanto cada cobrança demora
  taxaDeFalha: number; // 0 = nunca falha, 0.2 = falha 20% das vezes
}

export function criarPagamentoFalso({ latenciaMs, taxaDeFalha }: OpcoesPagamento): Pagamento {
  return (valor) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        if (valor <= 0) reject(new Error("valor inválido"));
        else if (Math.random() < taxaDeFalha) reject(new Error("operadora instável"));
        else resolve();
      }, latenciaMs);
    });
}
