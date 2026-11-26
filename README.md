# Bilheteria concorrente

**Vídeo:** https://drive.google.com/file/d/1w-VGZnNbrf4ksRzlw-4LGtJkuTyiF6WW/view?usp=sharing

Projeto final de Paradigmas de Linguagens de Programação. Enunciado completo no Blackboard.

Os arquivos de `src/` que vocês escrevem já existem, vazios; o `tipos.ts` e o `servidor.ts` vêm prontos. O que vai em cada um está no passo
indicado do enunciado:

| Arquivo | Passo do enunciado |
| :--- | :--- |
| `src/tipos.ts` (pronto) | 1: os tipos |
| `src/regras.ts` | 2: meia-entrada |
| `src/preco.ts` | 3: preço (funcional) |
| `src/dominio.ts` | 4: evento e erros (orientado a objetos) |
| `src/bilheteria.ts` | 5: a venda, onde a concorrência aparece |
| `src/servidor.ts` (pronto) e `src/main.ts` | 6: ligar o servidor |

Não alterem `src/pagamento.ts`, `src/servidor.ts`, `src/bench.ts` nem `testes/`: a correção usa os originais.

Para começar, sigam o `GUIA.md`. Depois dele, os comandos são:

```bash
npm install
npm test          # correção automática: mostra os pontos
npm start         # serviço em http://localhost:3000
npm run bench     # com o serviço no ar: 200 pedidos simultâneos no evento 1, dois por poltrona
```

Exemplo de pedido:

```bash
curl -X POST localhost:3000/reservas -H 'Content-Type: application/json' \
  -d '{"eventoId":1,"ingressos":[{"nome":"Ana","idade":20,"estudante":true,"pcd":false,"poltrona":7}]}'
```

---

## Preencham (avaliado no vídeo)

**Link do vídeo:** https://drive.google.com/file/d/1w-VGZnNbrf4ksRzlw-4LGtJkuTyiF6WW/view?usp=sharing

### Integrantes

| Nome | Usuário do GitHub | Parte principal |
| :--- | :--- | :--- |
| Yan Lima Barbosa | yanlimabarbosa | Concorrência (`bilheteria.ts`), `regras.ts`, `main.ts` e README |
| João Gabriel Souza Oliveira | Joaogabreil25 | Funcional (`preco.ts`) |
| Wanchristersenn Victtor da Silva Ideao | Wanchristersenn | Orientado a objetos (`dominio.ts`) |

### Decisões

1. **Concorrência.** Como vocês garantem que duas pessoas não ficam com a mesma poltrona? Onde estava o
   `await` perigoso?

   No `bilheteria.reservar`, as poltronas são marcadas com `evento.reservar(poltronas)` **antes** do
   `await` do pagamento. O Node só troca de pedido num `await`; do começo do `reservar` até a marcação
   nenhum outro pedido roda no meio. Então, quando o segundo pedido da mesma poltrona chega, ela já está
   marcada e ele recebe `PoltronaOcupadaErro` sem ser cobrado. O `await` perigoso é o da operadora: se a
   marcação ficasse depois dele, os quatro pedidos da mesma poltrona passariam pela checagem enquanto o
   primeiro esperava o pagamento, e os quatro seriam cobrados por uma poltrona só. Se o pagamento falha
   ou passa do tempo limite (`comTempoLimite` com `Promise.race`), o `catch` chama `evento.liberar` e a
   poltrona volta para a venda.

2. **OO.** O que o `Evento` esconde e por quê? Por que o `reservar` é tudo ou nada? Por que os erros são uma hierarquia de classes?

   O `Evento` esconde a lista de poltronas vendidas num campo `#vendidas`. De fora só dá para ler quantas
   restam (`get disponivel`, sem setter) e mudar pelos métodos `reservar` e `liberar`, que conferem as
   regras. Se a lista fosse pública, qualquer parte do código poderia marcar ou apagar uma poltrona sem
   validação. O `reservar` é tudo ou nada porque o pedido é de uma família: se uma poltrona falha e as
   outras ficam marcadas, o evento fica com poltronas presas que ninguém comprou. Por isso ele confere a
   lista inteira primeiro e só depois marca. Os erros são uma hierarquia porque cada um carrega o próprio
   `status` HTTP: o `servidor.ts` só testa `erro instanceof ErroDeNegocio` e responde com `erro.status`.
   Um erro novo é uma classe nova, sem mexer no servidor.

3. **Funcional.** O que ganhamos com `preco.ts` puro? Como vocês testariam ele sem subir o servidor?

   As funções do `preco.ts` só dependem dos argumentos e não alteram nada: a mesma entrada dá sempre a
   mesma saída. Isso deixa o cálculo previsível, fácil de reaproveitar (as fábricas `valorDoIngresso(80)`
   e `aplicarTaxa(0.1)` geram funções prontas) e seguro de chamar de vários pedidos ao mesmo tempo, porque
   não existe estado compartilhado para um pedido estragar o do outro. Para testar basta importar e
   chamar: `calcularTotal([{ ..., valor: 50 }, { ..., valor: 100 }])` tem que dar `165`, sem servidor,
   sem operadora e sem mock. É o que o `npm test` faz nos testes de "Funcional".

4. **Se fosse em outro paradigma.** Escolham uma das partes e expliquem como ficaria em outro
   paradigma, e se ficaria melhor ou pior.

   O preço em OO ficaria como uma classe `CalculadoraDePreco` com `precoBase` e `taxa` em campos e um
   método `calcular(pessoas)` com um `for` somando num total. Funciona, mas o estado nos campos permite
   que alguém mude a taxa no meio de uma venda, e para testar é preciso montar o objeto antes. Para uma
   conta que só transforma entrada em saída, o funcional fica melhor: menos código e nada para dar errado
   entre uma chamada e outra. Já o `Evento` ficaria pior no funcional puro: sem estado mutável, cada
   reserva devolveria um evento novo, e alguém ainda precisaria guardar "o evento atual" num lugar só,
   que é justamente o que a classe faz.

5. **Concorrente × paralelo.** O Node roda o JavaScript numa linha só: os pedidos de vocês são
   concorrentes, não paralelos. O que mudaria se a venda rodasse em vários núcleos ao mesmo tempo?

   Hoje o trecho entre dois `await` nunca é interrompido, então "conferir se a poltrona está livre e
   marcar" acontece de uma vez, sem trava. Com vários núcleos executando ao mesmo tempo, dois pedidos
   poderiam conferir a mesma poltrona no mesmo instante, os dois ver "livre" e os dois marcar. Seria
   preciso tornar essa operação atômica: um mutex por evento, operações atômicas sobre memória
   compartilhada, ou, no caso comum de vários servidores, deixar o banco de dados garantir (transação
   com `UNIQUE (evento, poltrona)` ou `SELECT ... FOR UPDATE`). O ganho seria processar mais pedidos por
   segundo; o custo, a complexidade das travas e o risco de deadlock.

### Resultados do bench

| Cenário | Pedidos | Tempo (ms) | Vendidos | Poltrona ocupada | Falha de pagamento |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Padrão (`main.ts`) | 200 | 193 | 90 | 100 | 10 |

O bench ocupa as poltronas do evento 1: para rodar de novo, parem o `npm start` (Ctrl+C) e subam outra
vez.

O que os números mostram: os 200 pedidos terminaram em cerca de 190 ms, perto de 1000 pedidos por
segundo. Um a um, com 80 ms de operadora cada, levariam uns 16 s: enquanto um pedido espera o pagamento,
o Node atende os outros. Nenhuma poltrona foi vendida duas vezes. Os 100 recusados com 409 são o segundo
pedido de cada poltrona, que chega com ela já marcada e não é cobrado. Os 10 com 502 são a operadora
falsa falhando 10% das vezes; essas poltronas voltaram para a venda (`liberar`), por isso vendidos +
falhas = 100. Elas ficaram livres porque o segundo pedido da mesma poltrona já tinha recebido 409 antes
de o pagamento do primeiro falhar. Em três execuções os números foram 87/100/13, 90/100/10 e 90/100/10.
