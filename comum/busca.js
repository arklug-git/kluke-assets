/* Busca por nome popular, comum à consulta e ao "Monte sua nota". Usa o
   dicionário de comum/sinonimos.js (carregue antes deste). Só define
   KLUKE_BUSCA.

   Casa quando cada palavra digitada começa uma palavra do nome ("sabon" acha
   "sabonete") ou é o plural dela ("sabonetes"); ou quando o nome inteiro está
   no que foi digitado ("chuveiro elétrico" acha "chuveiro"). Plural é só -s,
   -es e -ões: "boneca" não é plural de "boné". Pesos: as duas coisas juntas 2;
   só o digitado no nome 1; só o nome no digitado 0,5 — este fica abaixo de
   tudo, porque a palavra a mais pode mudar o produto ("alho em pó" não é alho
   fresco) e só vale quando nada mais casa. */
window.KLUKE_BUSCA = (function () {
  'use strict';
  function dobra(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  var PARADA = /^(a|o|e|de|da|do|das|dos|em|com|para)$/;
  function palavras(s) { return dobra(s).split(/[^a-z0-9]+/).filter(function (w) { return w && !PARADA.test(w); }); }
  function plural(w, k) { return w === k || w === k + 's' || w === k + 'es' || (/ao$/.test(k) && w === k.slice(0, -2) + 'oes'); }
  function digitadoNoNome(qw, nw) { return qw.every(function (w) { return nw.some(function (k) { return k.indexOf(w) === 0 || plural(w, k); }); }); }
  function nomeNoDigitado(qw, nw) { return nw.every(function (k) { return qw.some(function (w) { return plural(w, k); }); }); }

  var SIN = (window.KLUKE_SINONIMOS || []).map(function (l) {
    return { nomes: l[0].split(',').map(function (n) { return palavras(n.trim()); }),
             cods: l[1].split(/\s+/).map(function (c) { return c.replace(/\D/g, ''); }) };
  });

  /* As linhas do dicionário que casam com o texto, com o peso: [{ m, cods }]. */
  function linhas(texto) {
    var qw = palavras(texto), out = [];
    if (!qw.length || /^[\d.\s-]+$/.test(texto)) return out;
    SIN.forEach(function (s) {
      var m = 0;
      s.nomes.forEach(function (nw) { var a = digitadoNoNome(qw, nw), b = nomeNoDigitado(qw, nw); m = Math.max(m, a && b ? 2 : a ? 1 : b ? 0.5 : 0); });
      if (m) out.push({ m: m, cods: s.cods });
    });
    return out;
  }

  /* Para cada código (8 dígitos, sem pontos) da lista que começa com um prefixo
     das linhas que casam: { m: peso, o: ordem }. A ordem segue a escrita do
     dicionário — o mais comum primeiro. */
  function populares(texto, codigos) {
    var out = {}, ordem = 0;
    linhas(texto).forEach(function (l) {
      l.cods.forEach(function (p) {
        codigos.forEach(function (c) { if (c.indexOf(p) === 0 && (!out[c] || out[c].m < l.m)) out[c] = { m: l.m, o: ordem++ }; });
      });
    });
    return out;
  }

  return { dobra: dobra, linhas: linhas, populares: populares };
})();
