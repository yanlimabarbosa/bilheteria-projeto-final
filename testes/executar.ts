// Roda uma bateria de testes contra o arquivo de um aluno (ou a pasta src/ de um projeto)
// e imprime o resultado em JSON.
//   npx tsx executar.ts testes/aula-07.ts /caminho/exercicio.ts
//   npx tsx executar.ts testes/projeto.ts /caminho/do/grupo/src
// Uso interno dos scripts corrigir-*.sh; também serve para conferir um arquivo à mão.
import { readFileSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export interface Teste {
  nome: string;
  peso: number;
  // `aluno` = o módulo importado; `fonte` = o código sem comentários (para regras de estilo).
  rodar: (aluno: any, fonte: string) => void | Promise<void>;
}

export function semComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

// Proíbe palavras/trechos no código. `lista` aceita regex ou texto literal.
export function proibir(fonte: string, lista: Array<[RegExp, string]>): void {
  const achados = lista.filter(([re]) => re.test(fonte)).map(([, nome]) => nome);
  if (achados.length > 0) throw new Error(`usa ${achados.join(", ")}`);
}

const TEMPO_POR_TESTE_MS = 8000;

async function comLimite<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`passou de ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([p, limite]);
  } finally {
    clearTimeout(timer);
  }
}

async function principal(): Promise<void> {
  const [arqTestes, arqAluno] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const { testes } = (await import(pathToFileURL(resolve(arqTestes)).href)) as { testes: Teste[] };
  const total = testes.reduce((s, t) => s + t.peso, 0);

  let aluno: any = null;
  let erroImport = "";
  let fonte = "";
  try {
    if (statSync(arqAluno).isDirectory()) {
      // Projeto: os testes importam cada arquivo da pasta por conta própria.
      aluno = { pasta: resolve(arqAluno) };
    } else {
      fonte = semComentarios(readFileSync(arqAluno, "utf8"));
      aluno = await import(pathToFileURL(resolve(arqAluno)).href);
    }
  } catch (e) {
    erroImport = `não compila/não carrega: ${(e as Error).message.split("\n")[0]}`;
  }

  const itens = [];
  for (const t of testes) {
    if (!aluno) {
      itens.push({ nome: t.nome, peso: t.peso, ok: false, erro: erroImport });
      continue;
    }
    try {
      await comLimite(Promise.resolve().then(() => t.rodar(aluno, fonte)), TEMPO_POR_TESTE_MS);
      itens.push({ nome: t.nome, peso: t.peso, ok: true, erro: "" });
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      itens.push({ nome: t.nome, peso: t.peso, ok: false, erro: msg.replace(/\s+/g, " ").slice(0, 220) });
    }
  }

  const pontos = itens.filter((i) => i.ok).reduce((s, i) => s + i.peso, 0);
  if (process.argv.includes("--legivel")) {
    for (const i of itens) console.log(`${i.ok ? "✔" : "✘"} [${i.peso}] ${i.nome}${i.ok ? "" : `\n      ${i.erro}`}`);
    console.log(`\nPontos: ${pontos} de ${total} (${Math.round((pontos / total) * 100)}%)`);
  } else {
    console.log("@@RESULTADO@@" + JSON.stringify({ pontos, total, itens }));
  }
  process.exit(0);
}

principal();
