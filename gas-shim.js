/*
 * ENGELIX - ponte entre as telas no GitHub Pages e os apps do Apps Script.
 *
 * Por que existe: navegadores com mais de uma conta Google conectada não abrem apps
 * servidos direto por script.google.com ("Não foi possível abrir o arquivo", /u/1/).
 * Aqui a tela de cada app é buscada no próprio Apps Script (função __pagina do Api.gs)
 * e o google.script.run passa a ser um fetch ao doPost, sem cookies de conta Google.
 * Assim o app abre com qualquer quantidade de contas/perfis no navegador.
 *
 * Uso (página <app>/index.html):
 *   <script>window.GAS_API = 'https://script.google.com/macros/s/.../exec';</script>
 *   <script src="../gas-shim.js"></script>
 *   <script>GAS.carregar();</script>
 */
(function () {
  'use strict';
  var API = window.GAS_API;

  function chamar(fn, args) {
    return fetch(API, { method: 'POST', body: JSON.stringify({ fn: fn, args: args || [] }) })
      .then(function (r) { return r.json(); })
      .catch(function () { throw new Error('Sem conexão com o servidor. Verifique a internet e tente de novo.'); })
      .then(function (x) {
        if (!x || x.ok !== true) throw new Error((x && x.erro) || 'Erro no servidor.');
        return x.r;
      });
  }

  // Mesmo comportamento do google.script.run: withSuccessHandler / withFailureHandler / withUserObject.
  function runner(ok, falha, usuario) {
    return new Proxy({}, {
      get: function (t, nome) {
        if (nome === 'withSuccessHandler') return function (f) { return runner(f, falha, usuario); };
        if (nome === 'withFailureHandler') return function (f) { return runner(ok, f, usuario); };
        if (nome === 'withUserObject') return function (u) { return runner(ok, falha, u); };
        if (typeof nome !== 'string' || nome === 'then') return undefined;
        return function () {
          var args = Array.prototype.slice.call(arguments);
          chamar(nome, args).then(
            function (r) { if (ok) ok(r, usuario); },
            function (e) { if (falha) falha(e, usuario); else if (window.console) console.error(e); }
          );
        };
      }
    });
  }

  function localizacao() {
    var p = {}, ps = {};
    new URLSearchParams(location.search).forEach(function (v, k) {
      if (!(k in p)) p[k] = v;
      (ps[k] = ps[k] || []).push(v);
    });
    return { parameter: p, parameters: ps, hash: location.hash.replace(/^#/, '') };
  }

  window.google = window.google || {};
  window.google.script = {
    run: runner(null, null, undefined),
    url: { getLocation: function (cb) { setTimeout(function () { cb(localizacao()); }, 0); } },
    host: { close: function () {}, setHeight: function () {}, setWidth: function () {}, editor: { focus: function () {} }, origin: location.origin },
    history: { push: function () {}, replace: function () {}, setChangeHandler: function () {} }
  };

  function erroTela(msg) {
    document.body.innerHTML = '<div style="font-family:Arial,sans-serif;padding:24px;color:#1f3a5f">' +
      '<b>Não foi possível carregar o app.</b><br><br>' + String(msg).replace(/</g, '&lt;') +
      '<br><br><button onclick="location.reload()" style="padding:8px 14px">Tentar de novo</button></div>';
  }

  function carregar() {
    chamar('__pagina', []).then(function (html) {
      html = String(html || '');
      if (!/name=["']viewport["']/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, function (m) { return m + '<meta name="viewport" content="width=device-width, initial-scale=1">'; });
      }
      document.open();
      document.write(html);
      document.close();
    }, function (e) { erroTela(e.message); });
  }

  window.GAS = { carregar: carregar, chamar: chamar };
})();
