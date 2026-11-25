import type { Pessoa } from "./tipos.ts";

export function direitoAMeia(pessoa: Pessoa): boolean {
  return pessoa.estudante || pessoa.pcd || pessoa.idade >= 60;
}
