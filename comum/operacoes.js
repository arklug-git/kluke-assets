/* Operações por CFOP, CSOSN e regimes — dado curado pela Kluke, editado à mão.
   Compartilhado pela consulta (vinculo-ncm-nbs-cclasstrib.html) e pela página
   "Monte sua nota": corrigir aqui corrige as duas. As regras de cada operação
   estão no CLAUDE.md, seção "Consulta por CFOP". Script comum, não JSON: fetch()
   não funciona com a página aberta do disco (file://). */
window.KLUKE_OPERACOES = (function () {
  'use strict';

  /* ─── Consulta por CFOP ───
     Dado curado pela Kluke, não vem do SVRS: a tabela de classificação não liga
     cClassTrib a CFOP. Cada operação diz de onde sai o IBS/CBS:
       produto   — depende do NCM/NBS: manda para a tabela abaixo (venda)
       fixo      — código da operação, qualquer que seja o produto (c = cClassTrib)
       original  — repete o da nota que está sendo devolvida
       consulte  — sem regra única; falar com a Kluke
     Um CFOP com mais de um caso (5910: bonificação, brinde ou doação) lista os
     casos com "quando", e o cliente escolhe o seu.
     Os demais impostos dependem do regime e são informados pela Kluke, por CFOP
     exato (nunca herdado do par 5/6):
       normal: { '5152': [[rótulo, valor], ...] }  — Lucro Presumido/Real
     O CSOSN (Simples e híbrido) fica na tabela CSOSN, logo abaixo.
     Base legal conferida no texto da LC 214/2025 (arts. 4º a 8º e 82) e nomes
     dos cClassTrib na tabela do SVRS em 06/10/2026. */
  var LC = 'https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm#art';
  var CST_OP = { '000': 'Tributação integral', '410': 'Imunidade e não incidência', '550': 'Suspensão', '620': 'Tributação monofásica' };
  var CLASSE_OP = {
    '410001': { cst: '410', art: 5,  n: 'Bonificação que consta na própria nota e não depende de evento posterior' },
    '410002': { cst: '410', art: 6,  n: 'Transferência entre estabelecimentos do mesmo contribuinte' },
    '410003': { cst: '410', art: 6,  n: 'Doação de bem que não gerou crédito de IBS/CBS para quem doa' },
    '410004': { cst: '410', art: 8,  n: 'Exportação de bens e serviços' },
    '410026': { cst: '410', art: 6,  n: 'Doação com anulação do crédito tomado na compra do bem doado' },
    '410030': { cst: '410', art: 47, n: 'Estorno de crédito por perda, deterioração, roubo, furto ou extravio' },
    '410031': { cst: '410', art: 544, n: 'Fornecimento anterior ao início da cobrança do IBS e da CBS' },
    '000001': { cst: '000', art: 4,  n: 'Tributação integral pelo IBS e pela CBS' },
    '410999': { cst: '410', art: 4,  n: 'Operação sem cobrança, não especificada em outro código (remessas em que o bem continua sendo de quem envia)' },
    '550001': { cst: '550', art: 82, n: 'Exportação de bens materiais — suspensão' },
    '620007': { cst: '620', art: 47, n: 'Perda, deterioração, roubo, furto ou extravio no regime monofásico' }
  };
  var IND_AVISO = 'Na volta, o industrializador emite <b>uma nota só</b> para o encomendante, citando a nota de remessa: os insumos item a item com NCM e, em itens separados, ' +
    'o serviço de industrialização e as mercadorias da própria indústria empregadas. No Simples, serviço e mercadorias próprias vão num item só, como "parcela agregada" (' +
    '<a href="https://legislacao.sef.sc.gov.br/html/regulamentos/icms/ricms_01_06.htm" target="_blank" rel="noopener">RICMS/SC, Anexo 6, arts. 71 e 71-A</a>). ' +
    'No regime normal, o ICMS do serviço fica diferido, salvo encomenda de não contribuinte ou para uso e consumo do encomendante, quando é tributado. ' +
    'Empresa do Simples não usa a suspensão do IPI na industrialização por encomenda (Receita Federal, Solução de Consulta COSIT 200/2025).';

  /* Dois caminhos de industrialização com CFOPs parecidos — o erro comum é
     misturar os pares (5902 com 5125, ou 5925 com 5124). O quadro mostra os
     dois lado a lado em todo cartão de industrialização, com o do CFOP
     consultado em destaque; cada código leva ao próprio cartão. */
  var FLUXOS = [
    { id: 'comum', n: 'Industrialização comum', q: 'os insumos saem do próprio encomendante',
      ida: [['5901', '6901', 'remessa dos insumos, pelo encomendante']],
      volta: [['5902', '6902', 'insumos usados'], ['5124', '6124', 'o que o industrializador cobra'], ['5903', '6903', 'sobra de insumo não usado']] },
    { id: 'tri', n: 'Industrialização triangular', q: 'os insumos vão direto do fornecedor ao industrializador, por conta e ordem do encomendante',
      ida: [['5924', '6924', 'remessa dos insumos, pelo fornecedor (a venda ao encomendante vai em outra nota)']],
      volta: [['5925', '6925', 'insumos usados'], ['5125', '6125', 'o que o industrializador cobra'], ['5903', '6903', 'sobra de insumo não usado']] }
  ];
  var FLUXO_DE = Object.create(null);
  FLUXOS.forEach(function (f) { f.ida.concat(f.volta).forEach(function (x) { FLUXO_DE[x[0]] = FLUXO_DE[x[0]] ? 'ambos' : f.id; FLUXO_DE[x[1]] = FLUXO_DE[x[0]]; }); });

  // Regime normal, ICMS conforme a tabela cBenef da SEF/SC. CST com origem 0 (nacional).
  var IND_INSUMOS = [['ICMS — CST', '050'], ['ICMS — cBenef', 'SC840008'], ['PIS e COFINS — CST', '49'], ['IPI — CST', null]];
  var IND_COBRA_INT = [['ICMS do serviço — CST', '051'], ['ICMS do serviço — cBenef', 'SC830080'],
                       ['ICMS das mercadorias próprias — CST', '000'], ['PIS e COFINS — CST', '01'], ['IPI — CST', null]];
  var IND_COBRA_INTER = [['ICMS do serviço', null], ['ICMS das mercadorias próprias — CST', '000'], ['PIS e COFINS — CST', '01'], ['IPI — CST', null]];
  /* Lista "TRIBUTAÇÃO POR CFOP" da Kluke (out/2026), conferida pela Kluke em
     29/10/2026 (Andrews):
       - IPI: a lista dizia "49/99", mas 49 é CST de entrada. Empresa comercial
         usa 99. Industrial: "tributado só no 7101" — ver o comentário da
         exportação; ali a página manda falar com a Kluke.
       - "00 — tributado" virou 01 no PIS/COFINS (5922) e 50 no IPI (5912,
         5913, 5116/5117): 00 não existe na saída.
       - 6151 e 6152 iguais a 5151 e 5152. Os demais CFOPs sem valor ficam
         "fale com a gente": a Kluke vê caso a caso.
     Um CFOP só recebe valores quando a Kluke o nomeia, nunca herdado do par. */
  var porCfop = function (cs, v) { var o = {}; cs.forEach(function (c) { o[c] = v; }); return o; };
  var SEM_ICMS_SC = ['Dados adicionais da NF-e', 'Não incidência do ICMS conforme art. 2º da Lei nº 10.297/1996 de SC, conforme Súmula 573 do STF.'];
  var N_TRANSF = [['ICMS — CST', '051'], ['ICMS — cBenef', 'SC830073'], ['PIS e COFINS — CST', '08/49'], ['IPI — CST', '99']];
  var N_EXPORT = [['ICMS — CST', '041'], ['ICMS — cBenef', 'SC800011'], ['PIS e COFINS — CST', '08'], ['IPI — CST', '99']];
  // 7101 é a exportação da produção própria: só quem fabrica o emite, e a Kluke
  // disse que ali o IPI da indústria é tributado. A exportação é imune de IPI
  // (CF, art. 153, § 3º, III): até esclarecer, o IPI do 7101 fica "fale com a gente".
  var N_EXPORT_FAB = [['ICMS — CST', '041'], ['ICMS — cBenef', 'SC800011'], ['PIS e COFINS — CST', '08'], ['IPI — CST', null]];
  var N_IND_IDA = [['ICMS — CST', '050'], ['ICMS — cBenef', 'SC840007'], ['PIS e COFINS — CST', '08/49'], ['IPI — CST', '99']];
  var N_IND_VOLTA = [['ICMS — CST', '050'], ['ICMS — cBenef', 'SC840008'], ['PIS e COFINS — CST', '08/49'], ['IPI — CST', '99']];
  var N_COMODATO = [['ICMS — CST', '041'], ['ICMS — cBenef', 'SC999999'], ['PIS e COFINS — CST', '08/49'], ['IPI — CST', '99'], SEM_ICMS_SC];
  var N_DEMO = [['ICMS — CST', '050'], ['ICMS — cBenef', 'SC840021'], ['PIS e COFINS — CST', '08/49'],
                ['IPI — CST', '50 — tributado se a empresa for industrial ou equiparada (destaque o IPI também no retorno, 5913/6913)']];
  var N_DEMO_VOLTA = N_DEMO.slice(0, 3).concat([['IPI — CST', '50 — tributado se a empresa for industrial ou equiparada'],
                ['Atenção', 'A nota de retorno precisa repetir a de remessa (5912/6912).']]);
  var IND_COBRADO = [{ t: 'fixo', c: '000001', nota: 'Paga IBS e CBS só sobre o valor cobrado (serviço e mercadorias da própria indústria), não sobre os insumos do encomendante. ' +
    'Se o produto pronto tem redução na tabela de NCM, fale com a gente antes de aplicar: a redução é do fornecimento do bem, e aqui o que se cobra é a industrialização.' }];
  var REMESSA = [{ t: 'fixo', c: '410999', nota: 'O bem continua sendo de quem envia e não há cobrança: não há operação tributável. A nota é exigida pelo ICMS.' }];
  var TRANSF = [{ t: 'fixo', c: '410002', nota: 'Só entre estabelecimentos com a <b>mesma raiz de CNPJ</b> (os 8 primeiros dígitos). Para outra empresa do grupo não é transferência: é venda ou remessa.' }];
  var DEVOL = [{ t: 'original' }];
  var VENDA = [{ t: 'produto' }];
  // A Kluke confere a ST caso a caso (29/10/2026): os códigos ficam, com o aviso.
  var ST_AVISO = 'Venda com substituição tributária: <b>confira com a gente antes de emitir</b>. O tratamento depende do produto, do estado de destino e do protocolo ou convênio aplicável.';

  var OPERACOES = [
    // Vendas: o IBS/CBS sai do produto
    { c: ['5102', '6102'], d: 'Venda de mercadoria adquirida ou recebida de terceiros', ibs: VENDA, k: 'revenda comercio loja' },
    { c: ['5101', '6101'], d: 'Venda de produção do estabelecimento', ibs: VENDA, k: 'industria fabricacao producao propria' },
    { c: ['5405'], d: 'Venda de mercadoria de terceiros sujeita à substituição tributária, como contribuinte substituído', ibs: VENDA, aviso: ST_AVISO, k: 'st substituicao tributaria icms retido' },
    { c: ['5403', '6403'], d: 'Venda de mercadoria de terceiros sujeita à substituição tributária, como contribuinte substituto', ibs: VENDA, aviso: ST_AVISO, k: 'st substituicao tributaria substituto' },
    { c: ['5401', '6401'], d: 'Venda de produção do estabelecimento sujeita à substituição tributária', ibs: VENDA, aviso: ST_AVISO, k: 'st substituicao tributaria industria' },
    { c: ['6404'], d: 'Venda de mercadoria sujeita à substituição tributária, com o imposto já retido anteriormente', ibs: VENDA, aviso: ST_AVISO, k: 'st substituicao tributaria retido' },
    // Entrega futura: o IBS/CBS sai no pagamento antecipado (art. 10, § 4º), não na entrega.
    { c: ['5922', '6922'], d: 'Simples faturamento de venda para entrega futura', ibs: [
        { t: 'fixo', c: '410999', quando: 'Sem pagamento antecipado', nota: 'O simples faturamento não transfere a mercadoria: o IBS e a CBS saem na nota de entrega (5116/5117).' },
        { t: 'consulte', quando: 'Com pagamento antecipado, total ou parcial', nota: 'O pagamento antes da entrega antecipa o IBS e a CBS (<a href="' + LC + '10" target="_blank" rel="noopener">LC 214/2025, art. 10, § 4º</a>): para cada pagamento, emita uma nota de débito 5922 com o valor recebido, tributada. Fale com a gente para acertar cada caso.' }
      ], k: 'entrega futura simples faturamento venda antecipada adiantamento',
      normal: porCfop(['5922', '6922'], [['ICMS — CST', '041'], ['ICMS — cBenef', 'SC800017'], ['PIS e COFINS — CST', '01 — tributado'], ['IPI — CST', '99']]) },
    { c: ['5116', '5117', '6116', '6117'], d: 'Venda originada de encomenda para entrega futura (a entrega da mercadoria)', ibs: [{ t: 'produto', nota: 'O IBS e a CBS já antecipados nos pagamentos são acertados nesta nota. Fale com a gente para conferir cada caso.' }], k: 'entrega futura remessa entrega venda antecipada',
      normal: porCfop(['5116', '5117', '6116', '6117'], [['ICMS — CST', '000'], ['ICMS — cBenef', 'não utiliza'], ['PIS e COFINS — CST', '08/49'],
        ['IPI — CST', '50 — tributado se a empresa for industrial ou equiparada; comercial: 99']]) },
    { c: ['5551', '6551'], d: 'Venda de bem do ativo imobilizado', ibs: [{ t: 'consulte', nota: 'A venda de bem do ativo também paga IBS e CBS (<a href="' + LC + '4" target="_blank" rel="noopener">LC 214/2025, art. 4º, § 4º</a>), mas tem regras específicas. Fale com a gente antes de emitir: conferimos também, pelo valor contábil do bem, se a venda gera ganho de capital.' }], k: 'ativo imobilizado maquina veiculo equipamento usado',
      normal: porCfop(['5551', '6551'], [['ICMS — CST', '041'], ['ICMS — cBenef', 'SC800006'], ['PIS e COFINS — CST', '08/49'], ['IPI — CST', '99']]) },
    { c: ['5933', '6933'], d: 'Prestação de serviço sujeito ao ISS (nota conjugada)', ibs: [{ t: 'produto', nota: 'Aqui o código vem do <b>NBS</b> do serviço, não do NCM.' }], k: 'servico iss nbs conjugada' },
    { c: ['7101', '7102'], d: 'Venda para o exterior (exportação direta)', ibs: [{ t: 'fixo', c: '410004', nota: 'Exportação é imune. Se a mercadoria vai para uma comercial exportadora no Brasil, a nota é outra: veja 5501/5502.' }], k: 'exportacao exterior',
      normal: { '7101': N_EXPORT_FAB, '7102': N_EXPORT } },
    { c: ['5501', '5502', '6501', '6502'], d: 'Remessa com fim específico de exportação (para comercial exportadora)', ibs: [
        { t: 'fixo', c: '550001', quando: 'Comercial exportadora habilitada pelo Comitê Gestor e pela Receita (certificada OEA, entre outros requisitos)', nota: 'A suspensão vira alíquota zero depois que a mercadoria é exportada (<a href="' + LC + '82" target="_blank" rel="noopener">art. 82</a>).' },
        { t: 'produto', quando: 'Comercial exportadora sem essa habilitação', nota: 'Sem a habilitação não há suspensão: a nota é tributada como venda.' }
      ], k: 'exportacao trading comercial exportadora fim especifico',
      // A lista da Kluke dizia 410004 para o 6501; a Kluke confirmou (29/10/2026)
      // a regra do art. 82: suspensão só para a comercial exportadora habilitada.
      normal: { '6501': N_EXPORT } },

    // Devoluções: repete a nota original
    { c: ['5202', '6202'], d: 'Devolução de compra para comercialização', ibs: DEVOL, k: 'devolucao fornecedor' },
    { c: ['5201', '6201'], d: 'Devolução de compra para industrialização ou produção rural', ibs: DEVOL, k: 'devolucao fornecedor materia prima insumo' },
    { c: ['5411', '6411'], d: 'Devolução de compra para comercialização em operação com substituição tributária', ibs: DEVOL, k: 'devolucao fornecedor st' },
    { c: ['5556', '6556'], d: 'Devolução de compra de material de uso ou consumo', ibs: DEVOL, k: 'devolucao fornecedor uso consumo' },
    { c: ['1202', '2202'], d: 'Devolução de venda de mercadoria adquirida ou recebida de terceiros (entrada)', ibs: DEVOL, k: 'devolucao cliente entrada' },
    { c: ['1201', '2201'], d: 'Devolução de venda de produção do estabelecimento (entrada)', ibs: DEVOL, k: 'devolucao cliente entrada industria' },
    { c: ['1411', '2411'], d: 'Devolução de venda de mercadoria de terceiros com substituição tributária (entrada)', ibs: DEVOL, k: 'devolucao cliente entrada st' },

    // Transferências: mesma raiz de CNPJ
    { c: ['5152', '6152'], d: 'Transferência de mercadoria adquirida ou recebida de terceiros', ibs: TRANSF, k: 'transferencia filial matriz',
      normal: { '5152': N_TRANSF, '6152': N_TRANSF } },
    { c: ['5151', '6151'], d: 'Transferência de produção do estabelecimento', ibs: TRANSF, k: 'transferencia filial matriz industria', normal: { '5151': N_TRANSF, '6151': N_TRANSF } },
    { c: ['5409', '6409'], d: 'Transferência de mercadoria de terceiros sujeita à substituição tributária', ibs: TRANSF, k: 'transferencia filial matriz st' },
    { c: ['5408', '6408'], d: 'Transferência de produção do estabelecimento sujeita à substituição tributária', ibs: TRANSF, k: 'transferencia filial matriz st industria' },
    { c: ['5552', '6552'], d: 'Transferência de bem do ativo imobilizado', ibs: TRANSF, k: 'transferencia filial matriz ativo imobilizado' },
    { c: ['5557', '6557'], d: 'Transferência de material de uso ou consumo', ibs: TRANSF, k: 'transferencia filial matriz uso consumo' },

    // Bonificação, doação ou brinde: um CFOP, quatro tratamentos
    { c: ['5910', '6910'], d: 'Remessa em bonificação, doação ou brinde', ibs: [
        { t: 'fixo', c: '410001', quando: 'Bonificação que aparece na mesma nota da venda e não depende de nada depois', nota: 'Não vale para bonificação condicionada a meta, volume ou outro evento futuro (<a href="' + LC + '5" target="_blank" rel="noopener">art. 5º, § 1º</a>).' },
        { t: 'produto', quando: 'Brinde, ou bonificação que depende de evento posterior', nota: 'Brinde e bonificação <b>pagam</b> IBS e CBS (<a href="' + LC + '5" target="_blank" rel="noopener">art. 5º, II</a>). Combustível e outros bens com alíquota por unidade pagam mesmo na bonificação da própria nota.' },
        { t: 'fixo', c: '410003', quando: 'Doação de bem que não deu crédito de IBS/CBS na compra', nota: 'Doação sem contrapartida para quem doa (<a href="' + LC + '6" target="_blank" rel="noopener">art. 6º, VIII</a>).' },
        { t: 'fixo', c: '410026', quando: 'Doação de bem que deu crédito, anulando esse crédito', nota: 'Quem doa escolhe: ou anula o crédito (este código), ou paga o imposto sobre o valor de mercado — aí o código vem do NCM, como na venda (<a href="' + LC + '6" target="_blank" rel="noopener">art. 6º, § 2º</a>).' }
      ], k: 'bonificacao doacao brinde brindes gratis' },

    // Remessas em que o bem continua sendo de quem envia
    { c: ['5915', '6915'], d: 'Remessa de mercadoria ou bem para conserto ou reparo', ibs: REMESSA, k: 'conserto reparo manutencao assistencia', normal: porCfop(['5915', '6915'], N_IND_IDA) },
    { c: ['5916', '6916'], d: 'Retorno de mercadoria ou bem recebido para conserto ou reparo', ibs: [{ t: 'fixo', c: '410999', nota: 'Se a nota também cobra peças ou mão de obra, esses itens são venda e levam o código do produto ou serviço.' }], k: 'conserto reparo retorno manutencao', normal: porCfop(['5916', '6916'], N_IND_VOLTA) },
    { c: ['5912', '6912'], d: 'Remessa de mercadoria ou bem para demonstração ou mostruário', ibs: [{ t: 'fixo', c: '410999', nota: 'Se o bem não voltar, a saída vira venda e paga IBS e CBS.' }], k: 'demonstracao mostruario representante', normal: porCfop(['5912', '6912'], N_DEMO) },
    { c: ['5913', '6913'], d: 'Retorno de mercadoria ou bem recebido para demonstração ou mostruário', ibs: REMESSA, k: 'demonstracao mostruario retorno', normal: porCfop(['5913', '6913'], N_DEMO_VOLTA) },
    { c: ['5901', '6901'], d: 'Remessa para industrialização por encomenda (insumos do próprio encomendante)', ibs: REMESSA, k: 'industrializacao encomenda terceiros beneficiamento',
      aviso: 'Quem emite é o <b>encomendante</b>, mandando os próprios insumos ao industrializador.', normal: porCfop(['5901', '6901'], N_IND_IDA) },
    { c: ['5902', '6902'], d: 'Retorno de mercadoria utilizada na industrialização por encomenda', ibs: [{ t: 'fixo', c: '410999', nota: 'O valor cobrado pela industrialização vai em item próprio (CFOP 5124/6124) e esse item paga IBS e CBS.' }], k: 'industrializacao encomenda retorno beneficiamento', aviso: IND_AVISO, normal: porCfop(['5902', '6902'], N_IND_VOLTA) },

    // Industrialização por conta e ordem do adquirente ("triangular"): o
    // fornecedor manda os insumos direto ao industrializador (5924/6924) e
    // vende ao encomendante em outra nota. O industrializador devolve numa nota
    // só: insumos em 5925/6925 e o que cobra em 5125/6125 (RICMS/SC, Anexo 6,
    // arts. 71 e 71-A). ICMS conferido em out/2026 na tabela cBenef da SEF/SC:
    // SC840007 é da SAÍDA (Anexo 2, art. 27, I); o retorno é SC840008 (art. 27,
    // II), ambos com CST 50; o serviço é diferido, SC830080 com CST 51 (Anexo 3,
    // art. 8º, X). IPI ficou em aberto: a suspensão do RIPI, art. 43, VI e VII,
    // pede insumos remetidos pelo próprio encomendante (COSIT 145/2017), o que
    // no triangular não acontece; e o Simples não usa a suspensão (COSIT 200/2025).
    { c: ['5924', '6924'], d: 'Remessa para industrialização por conta e ordem do adquirente (insumos que não passam pelo adquirente)',
      ibs: [{ t: 'fixo', c: '410999', nota: 'Esta nota só acompanha o transporte dos insumos até o industrializador. A venda dos insumos ao encomendante vai em outra nota, emitida junto, que paga IBS e CBS como venda.' }],
      k: 'industrializacao triangular conta e ordem adquirente encomendante fornecedor remessa',
      aviso: 'Quem emite é o <b>fornecedor</b> dos insumos, junto com a nota de venda ao encomendante, sem destaque do ICMS (RICMS/SC, Anexo 6, art. 71-A, I).' },
    { c: ['5925', '6925'], d: 'Retorno de insumos recebidos para industrialização por conta e ordem do adquirente (devolução dos insumos)',
      ibs: [{ t: 'fixo', c: '410999', nota: 'Os insumos são do encomendante e voltam para ele, sem cobrança. O que você cobra vai no item 5125/6125.' }],
      k: 'industrializacao triangular conta e ordem retorno insumos encomendante 6924', aviso: IND_AVISO,
      normal: { '5925': IND_INSUMOS, '6925': IND_INSUMOS } },
    // Insumo que sobrou: mesma suspensão do retorno (Anexo 2, art. 27, II) e o
    // mesmo tratamento dos insumos devolvidos em 5925/5902.
    { c: ['5903', '6903'], d: 'Retorno de insumos recebidos para industrialização e não usados (sobra de material)',
      ibs: [{ t: 'fixo', c: '410999', nota: 'Os insumos são do encomendante e voltam para ele sem cobrança.' }],
      k: 'industrializacao encomenda retorno sobra insumo nao aplicado nao utilizado devolucao material',
      aviso: 'Quem emite é o <b>industrializador</b>, devolvendo ao encomendante os insumos que não foram usados. Eles podem ir na mesma nota do retorno do produto pronto: ' +
             'nela entram os insumos "empregados ou não" (<a href="https://legislacao.sef.sc.gov.br/html/regulamentos/icms/ricms_01_06.htm" target="_blank" rel="noopener">RICMS/SC, Anexo 6, art. 71, II, b</a>). ' +
             'A suspensão do ICMS vale se o retorno ocorrer em até <b>180 dias</b> da remessa, prazo que pode ser prorrogado uma vez pela Gerência Regional ' +
             '(<a href="https://legislacao.sef.sc.gov.br/html/regulamentos/icms/ricms_01_02.htm" target="_blank" rel="noopener">Anexo 2, art. 27</a>).',
      normal: { '5903': IND_INSUMOS, '6903': IND_INSUMOS } },
    { c: ['5125', '6125'], d: 'Industrialização para outra empresa, com insumos que não passaram pelo adquirente (o que você cobra)',
      ibs: IND_COBRADO, k: 'industrializacao triangular conta e ordem servico cobrado encomendante 6924', aviso: IND_AVISO,
      normal: { '5125': IND_COBRA_INT, '6125': IND_COBRA_INTER } },
    { c: ['5124', '6124'], d: 'Industrialização efetuada para outra empresa, com insumos do próprio encomendante (o que você cobra)',
      ibs: IND_COBRADO, k: 'industrializacao encomenda servico cobrado beneficiamento', aviso: IND_AVISO,
      normal: { '5124': IND_COBRA_INT, '6124': IND_COBRA_INTER } },
    { c: ['5905', '6905'], d: 'Remessa para depósito fechado ou armazém geral', ibs: [
        { t: 'fixo', c: '410002', quando: 'Depósito fechado da própria empresa (mesma raiz de CNPJ)', nota: 'É transferência entre estabelecimentos.' },
        { t: 'fixo', c: '410999', quando: 'Armazém geral de outra empresa' }
      ], k: 'deposito armazem geral' },
    { c: ['5908', '6908'], d: 'Remessa de bem por conta de contrato de comodato', ibs: [
        { t: 'fixo', c: '410999', quando: 'Comodato com empresa ou pessoa sem ligação com a sua', nota: '' },
        { t: 'produto', quando: 'Comodato com parte relacionada (sócio, empresa do grupo, parente)', nota: 'Fornecimento sem cobrança a parte relacionada paga IBS e CBS sobre o valor de mercado (<a href="' + LC + '5" target="_blank" rel="noopener">art. 5º, IV</a>).' }
      ], k: 'comodato emprestimo', normal: porCfop(['5908', '6908'], N_COMODATO) },
    { c: ['5909', '6909'], d: 'Retorno de bem recebido por conta de contrato de comodato', ibs: [{ t: 'fixo', c: '410999', nota: 'O bem volta para o dono, sem cobrança.' }], k: 'comodato emprestimo retorno devolucao',
      normal: porCfop(['5909', '6909'], N_COMODATO) },
    // Decisão da Kluke (29/10/2026): a LC 214 não tem regra própria para amostra.
    // Se a amostra deu crédito de IBS/CBS na compra, ela é tributada (art. 5º, I:
    // fornecimento não oneroso); se não deu, 410999. Mesma lógica da doação (art. 6º, VIII).
    { c: ['5911', '6911'], d: 'Remessa de amostra grátis', ibs: [
        { t: 'fixo', c: '410999', quando: 'A amostra não deu crédito de IBS/CBS na compra', nota: 'Sem crédito na compra, a amostra sai sem cobrança do IBS e da CBS.' },
        { t: 'produto', quando: 'A amostra deu crédito de IBS/CBS na compra', nota: 'Com crédito na compra, a amostra é tributada como fornecimento sem cobrança (<a href="' + LC + '5" target="_blank" rel="noopener">LC 214/2025, art. 5º, I</a>): o código vem do produto, como na venda.' }
      ], k: 'amostra gratis brinde degustacao',
      aviso: 'No ICMS a amostra é isenta, interna ou interestadual, se for de valor comercial diminuto ou nenhum e na quantidade estritamente necessária para mostrar a natureza, a espécie e a qualidade da mercadoria.',
      normal: porCfop(['5911', '6911'], [['ICMS — CST', '040'], ['ICMS — cBenef', 'SC810043'], ['PIS e COFINS — CST', '08/49'], ['IPI — CST', '99']]) },
    { c: ['5914', '6914'], d: 'Remessa de mercadoria ou bem para exposição ou feira', ibs: REMESSA, k: 'feira exposicao evento' },
    { c: ['5920', '6920'], d: 'Remessa de vasilhame ou sacaria', ibs: REMESSA, k: 'vasilhame sacaria embalagem retornavel botijao' },

    // Perda e casos abertos
    // A Kluke mandou 410999; a LC 214 tem regra própria (art. 47, § 6º: estornar
    // o crédito do bem que perece ou é roubado) e o SVRS tem código próprio para
    // ela, 410030 — mantido. Nos dados adicionais, a Kluke citava também o
    // Anexo 5, art. 26, II, que trata de nota complementar por diferença de preço
    // ou quantidade, não de perda: trocado pelo art. 36, IV (estorno do crédito).
    { c: ['5927'], d: 'Baixa de estoque por perda, roubo ou deterioração', ibs: [
        { t: 'fixo', c: '410030', quando: 'Produto comum', nota: 'O crédito de IBS/CBS tomado na compra desse produto precisa ser estornado (<a href="' + LC + '47" target="_blank" rel="noopener">LC 214/2025, art. 47, § 6º</a>). Fale com a gente antes de emitir para acertar o valor.' },
        { t: 'fixo', c: '620007', quando: 'Combustível do regime monofásico' }
      ], k: 'perda roubo furto extravio deterioracao vencido avaria quebra baixa estoque',
      aviso: 'O destinatário da nota é a <b>própria empresa</b>. Em SC, emita a nota em até <b>48 horas</b> da ocorrência, relacionando as mercadorias pelo preço de custo. ' +
             'Se a perda passar de 0,5% da receita do mês anterior ou de R$ 20 mil, guarde laudo (Polícia Civil, Bombeiros ou Defesa Civil) e a declaração de responsabilidade ' +
             '(<a href="https://legislacao.sef.sc.gov.br/html/regulamentos/icms/ricms_01_05.htm" target="_blank" rel="noopener">RICMS/SC, Anexo 5, art. 180</a>).',
      normal: { '5927': [['ICMS — CST', '041'], ['ICMS — cBenef', 'SC999999'], ['PIS e COFINS — CST', '08/49'], ['IPI — CST', '99'],
                         ['Dados adicionais da NF-e', 'Benefício fiscal não previsto na lista cBenef/SC. Legislação: RICMS/SC, art. 36, IV, e Anexo 5, art. 180.']] } },
    { c: ['5949', '6949'], d: 'Outra saída de mercadoria ou prestação de serviço não especificada', ibs: [{ t: 'consulte', nota: 'Este CFOP serve para muitas operações diferentes, e o código do IBS/CBS depende de qual é. Use um CFOP específico sempre que existir. Se não houver, fale com a gente antes de emitir.' }], k: 'outras saidas diversas' }
  ];

  /* ─── CSOSN (Simples Nacional e Simples híbrido) ───
     Não existe correlação oficial CFOP × CSOSN: a Tabela B do Ajuste SINIEF
     03/10 define cada CSOSN pela situação do ICMS. Decisão da Kluke (out/2026):
     seguir as respostas de consulta da SEFAZ-SP. O critério que elas aplicam:
       101/102  venda tributada, com ou sem crédito para o comprador
       400      operação que não gera receita no Simples (remessa, transferência)
       900      residual (devolução de compra, bonificação com ST, isenção)
       300      imune (exportação — exigido pela validação da NF-e)
     Cada grupo diz a fonte. Onde a SEFAZ-SP não respondeu e o critério não
     basta (perda, bonificação sem ST, devolução de venda, 5949), fica sem
     código: a página manda falar com a Kluke. Caso com v: null = idem. */
  var SPF = 'https://legislacao.fazenda.sp.gov.br/Paginas/';
  var LW = 'https://www.legisweb.com.br/legislacao/?id=';
  var link = function (u, t) { return '<a href="' + u + '" target="_blank" rel="noopener">' + t + '</a>'; };
  var DEF_CSOSN = link('https://www.confaz.fazenda.gov.br/legislacao/ajustes/2010/AJ_003_10', 'Ajuste SINIEF 03/10, Tabela B');
  // Transferência e remessas: 400 pelo critério da SEFAZ-SP ("não gera receita
  // no Simples" — RC 7630/2016, RC 31107/2025). A Kluke pediu para não exibir
  // essa nota na página (out/2026); a fonte fica registrada aqui.
  var CSOSN = [
    { c: ['5101', '6101', '5102', '6102'],
      casos: [['Comprador é empresa fora do Simples que vai revender ou industrializar', '101'],
              ['Consumidor final, pessoa física ou empresa do Simples', '102']],
      fonte: 'No 101, informe também o percentual e o valor do crédito (pCredSN e vCredICMSSN). ' +
             'Definição: ' + DEF_CSOSN + '; crédito ao comprador: LC 123/2006, art. 23; ' + link(LW + '462074', 'SEFAZ-SP, RC 29823/2024') + '.' },
    { c: ['5124', '6124', '5125', '6125'],
      casos: [['Encomendante é empresa fora do Simples que vai revender ou industrializar o produto', '101'],
              ['Demais encomendantes', '102']],
      fonte: 'O valor cobrado pela industrialização é receita tributada no Simples; serviço e mercadorias próprias vão num item só, como "parcela agregada" (RICMS/SC, Anexo 6, art. 71, III). Definição: ' + DEF_CSOSN + '.' },
    { c: ['5401', '6401', '5403', '6403'],
      casos: [['Comprador é empresa fora do Simples que vai revender ou industrializar', '201'],
              ['Consumidor final, pessoa física ou empresa do Simples', '202']],
      fonte: 'Venda com cobrança do ICMS por substituição tributária. Definição: ' + DEF_CSOSN + '.' },
    { c: ['5405', '6404'], casos: [['', '500']],
      fonte: 'ICMS já cobrado antes por substituição tributária. Definição: ' + DEF_CSOSN + '.' },
    { c: ['5201', '6201', '5202', '6202', '5411', '6411', '5556', '6556'], casos: [['', '900']],
      fonte: 'Repita na nota a base e o ICMS (e o ICMS retido, se houver) da nota original. ' + link(SPF + 'RC26579_2022.aspx', 'SEFAZ-SP, RC 26579/2022') + '.' },
    { c: ['5151', '6151', '5152', '6152', '5408', '6408', '5409', '6409', '5552', '6552', '5557', '6557'], casos: [['', '400']],
      fonte: 'Desde 2024 a transferência entre estabelecimentos do mesmo titular não tem ICMS (STF, ADC 49; ' +
             link(LW + '461713', 'SEFAZ-SP, RC 29332/2024') + ').' },
    { c: ['5915', '6915', '5916', '6916', '5912', '6912', '5913', '6913', '5901', '6901', '5902', '6902',
          '5908', '6908', '5909', '6909', '5914', '6914', '5920', '6920', '5905', '6905', '5924', '6924', '5925', '6925', '5903', '6903'], casos: [['', '400']],
      fonte: 'Remessa sem venda: o bem continua sendo de quem envia.' },
    { c: ['5910', '6910'],
      casos: [['Mercadoria com substituição tributária', '900'], ['Demais casos', null]],
      fonte: link(SPF + 'RC31044_2024.aspx', 'SEFAZ-SP, RC 31044/2024') + ' (modificada em 2025: era 400, passou a 900). ' +
             'Para bonificação, brinde ou doação sem ST a SEFAZ-SP não respondeu.' },
    { c: ['7101', '7102'], casos: [['', '300']],
      fonte: 'Exportação é imune. A própria NF-e rejeita outro código em CFOP iniciado por 7 (rejeição 527).' }
  ];
  var CSOSN_CFOP = Object.create(null);
  CSOSN.forEach(function (g) { g.c.forEach(function (c) { CSOSN_CFOP[c] = g; }); });

  /* ─── Regime da empresa ───
     Decide o que vai na nota além do IBS/CBS:
       sn   Simples Nacional ou MEI — CSOSN; IBS/CBS dentro da guia, fora da nota
            em 2026. A obrigação começa em 2027 — NF-e e NFC-e em 01/03/2027, NFS-e
            da maioria dos serviços em 01/01/2027 (Ato Conjunto RFB/CGIBS nº 4, art.
            1º, § 1º, na redação do nº 7/2026) —, mas o leiaute do CRT 1 ainda não
            foi publicado (NT 2025.002). Não afirmar "nunca preenche".
       hib  Simples com IBS/CBS por fora (opção até 30/10/2026, efeito em
            01/01/2027) — CSOSN e IBS/CBS destacados, pela tabela.
       rn   Lucro Presumido ou Real — CST de ICMS, PIS/COFINS e IPI caso a caso,
            e IBS/CBS pela tabela. */
  var REGIMES = {
    sn:  { n: 'Simples Nacional ou MEI',
           nota: 'No ICMS vai o <b>CSOSN</b>. O IBS e a CBS são pagos dentro da guia do Simples (DAS) e <b>não são preenchidos na nota em 2026</b>. ' +
                 'A NF-e e a NFC-e do Simples passam a ter os campos de IBS e CBS a partir de <b>01/03/2027</b> (Ato Conjunto RFB/CGIBS nº 7/2026); as regras desse preenchimento ainda não foram publicadas, e avisaremos quando saírem.' },
    hib: { n: 'Simples com IBS e CBS por fora',
           nota: 'Vale para quem optou por pagar o IBS e a CBS fora do Simples: <b>começa em 01/01/2027</b> (opção até 30/10/2026). ' +
                 'Na nota vão o <b>CSOSN</b> no ICMS e o <b>IBS e a CBS destacados</b>, com CST e cClassTrib desta consulta. Até 31/12/2026 a nota segue como a do Simples.' },
    rn:  { n: 'Lucro Presumido ou Lucro Real',
           nota: 'Na nota vão o <b>IBS e a CBS</b> com CST e cClassTrib desta consulta, obrigatórios desde 03/08/2026. ' +
                 'O <b>ICMS, o PIS/COFINS e o IPI</b> dependem do produto, do estado e da tributação da sua empresa: <b>configuramos caso a caso</b>.' }
  };
  var IBS_SIMPLES = '<b>Não preencha o IBS e a CBS em 2026.</b> No Simples eles são pagos dentro da guia (DAS). ' +
                    'Para 2027 as regras da nota do Simples ainda não foram publicadas.';

  /* ─── Nome de balcão de cada classificação que aparece em NCM ───
     O nome oficial ("Vendas de produtos destinados à alimentação humana
     (Anexo I)") não diz nada ao cliente. Quando duas classificações caem no
     mesmo código, o nome tem de separá-las: quase sempre é quem compra (órgão
     público) ou a lista (alíquota zero ou redução). O oficial continua
     aparecendo ao lado ou no balão. */
  var NOME_LEIGO = {
    '200003': 'Alimento da cesta básica, para consumo humano',
    '200034': 'Alimento para consumo humano',
    '200014': 'Hortaliça, fruta ou ovo',
    '200038': 'Insumo agropecuário: semente, ração, adubo e afins',
    '515001': 'Insumo agropecuário, com diferimento (confirme com a gente)',
    '200035': 'Produto de higiene pessoal ou limpeza',
    '200013': 'Absorvente ou tampão higiênico',
    '200004': 'Dispositivo médico da lista de alíquota zero',
    '200030': 'Dispositivo médico, para qualquer comprador',
    '200005': 'Dispositivo médico vendido a órgão público ou entidade de saúde imune',
    '200007': 'Equipamento de acessibilidade da lista de alíquota zero',
    '200031': 'Equipamento de acessibilidade para pessoa com deficiência',
    '200008': 'Equipamento de acessibilidade vendido a órgão público',
    '200033': 'Nutrição enteral ou parenteral',
    '200011': 'Nutrição enteral ou parenteral vendida a órgão público',
    '200043': 'Bem de soberania ou segurança nacional vendido à administração pública',
    '200044': 'Bem de segurança da informação ou cibernética, de empresa com sócio brasileiro',
    '200039': 'Bem para produção artística, cultural, jornalística ou audiovisual',
    '510001': 'Energia elétrica, com diferimento',
    '620006': 'Combustível com imposto já cobrado na origem (monofásico)'
  };

  /* ─── Validade ───
     As duas páginas foram escritas com as regras de 2026. Na virada, o Simples
     passa a ter IBS/CBS na nota (leiaute do CRT 1 ainda não publicado) e o
     Simples híbrido começa: a partir de REVISAO.desde as páginas mostram a
     faixa abaixo até alguém rever os textos e adiar a data. A tabela do SVRS
     também envelhece: passados DIAS_SVRS da coleta, a página diz a data. */
  var REVISAO = { desde: '2027-01-01',
    texto: 'Esta página foi escrita com as regras de 2026. Desde 01/01/2027 mudam a nota do Simples e a do Simples com IBS e CBS por fora, e parte do que está aqui pode estar desatualizado. Confira com a gente antes de emitir.' };
  var DIAS_SVRS = 120;
  function avisosValidade(coletadoEm, hoje) {
    hoje = hoje || new Date();
    // Data local, não UTC: em SC, toISOString() vira o dia às 21h.
    var dois = function (n) { return (n < 10 ? '0' : '') + n; };
    var iso = hoje.getFullYear() + '-' + dois(hoje.getMonth() + 1) + '-' + dois(hoje.getDate()), out = [];
    if (iso >= REVISAO.desde) out.push(REVISAO.texto);
    var p = String(coletadoEm).split('-'), c = new Date(+p[0], +p[1] - 1, +p[2]);
    if (!isNaN(c) && (hoje - c) / 864e5 > DIAS_SVRS)
      out.push('A tabela oficial de classificação (SVRS) usada aqui foi coletada em ' + coletadoEm.split('-').reverse().join('/') + '. Pode haver códigos novos ou alterados desde então.');
    return out;
  }

  return { VENDA: VENDA, NOME_LEIGO: NOME_LEIGO, avisosValidade: avisosValidade, LC: LC, CST_OP: CST_OP, CLASSE_OP: CLASSE_OP, FLUXOS: FLUXOS, FLUXO_DE: FLUXO_DE, OPERACOES: OPERACOES, CSOSN: CSOSN, CSOSN_CFOP: CSOSN_CFOP, REGIMES: REGIMES, IBS_SIMPLES: IBS_SIMPLES };
})();
