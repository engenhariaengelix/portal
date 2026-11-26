// ===== PONTO: perfis, feriados, horas do mês, retroativo (26/11/2026) =====
var PONTO_PERFIS = ['pleno'];        // perfis que usam o Ponto. Ao validar, trocar por ['pleno', 'gerencia', 'operacional']
var PONTO_TESTE = ['EngTestes'];     // nomes liberados mesmo fora dos perfis acima (usuário de testes)
var PONTO_ALMOCO_MAX_MIN = 210;      // 3h30 sem voltar do almoço: a volta fica como esquecida
var PONTO_RETRO_DIAS = 7;            // dias para trás no registro retroativo
var PONTO_LINK = 'https://engenhariaengelix.github.io/portal/#ponto';
var PONTO_FALTAS = ['início do dia', 'saída para o almoço', 'volta do almoço', 'finalização do dia'];
var PONTO_FERIADOS_ABA = 'Feriados';

function pontoPermitido_(papel, nome) {
  return PONTO_PERFIS.indexOf(papel) >= 0 || PONTO_TESTE.some(function (n) { return chave_(n) === chave_(nome); });
}
function exigirPonto_(u) {
  if (!pontoPermitido_(papelEngenharia_(u), u.nome)) throw new Error(MSG_SEM_PERMISSAO);
}
/** Quem o usuário pode ver no Ponto: pleno vê todos; gerência vê o próprio e os operacionais; operacional vê só o próprio. */
function pontoVisiveis_(u) {
  var papel = papelEngenharia_(u), out = [], vistos = {};
  linhasUsuarios_().forEach(function (x) {
    if (x.empresa !== 'engenharia' || ['pleno', 'gerencia', 'operacional'].indexOf(x.papel) < 0) return;
    var k = chave_(x.nome);
    if (vistos[k] || !pontoPermitido_(x.papel, x.nome)) return;
    var eu = k === chave_(u.nome);
    if (eu || papel === 'pleno' || (papel === 'gerencia' && x.papel === 'operacional')) { vistos[k] = 1; out.push({ nome: x.nome, papel: x.papel }); }
  });
  out.sort(function (a, b) {
    var ea = chave_(a.nome) === chave_(u.nome) ? 0 : 1, eb = chave_(b.nome) === chave_(u.nome) ? 0 : 1;
    return (ea - eb) || cmp_(a.nome, b.nome);
  });
  return out;
}

// ---------- feriados ----------
function pontoPascoa_(ano) {
  var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}
function pontoYmd_(d) { return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd'); }
function pontoSoma_(d, n) { return new Date(d.getTime() + n * 86400000); }
/** Feriados que valem sempre: nacionais, Sexta-feira Santa e aniversário de Florianópolis. { 'yyyy-MM-dd': nome } */
function pontoFeriadosFixos_(ano) {
  var f = {};
  [['01-01', 'Confraternização Universal'], ['03-23', 'Aniversário de Florianópolis'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'],
   ['09-07', 'Independência do Brasil'], ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'],
   ['11-20', 'Consciência Negra'], ['12-25', 'Natal']].forEach(function (x) { f[ano + '-' + x[0]] = x[1]; });
  f[pontoYmd_(pontoSoma_(pontoPascoa_(ano), -2))] = 'Sexta-feira Santa';
  return f;
}
/** Pontos facultativos: o pleno decide, na Administração do app, se é feriado ou dia normal (padrão: dia normal). */
function pontoFacultativos_(ano) {
  var p = pontoPascoa_(ano), f = {};
  f[pontoYmd_(pontoSoma_(p, -48))] = 'Segunda-feira de Carnaval';
  f[pontoYmd_(pontoSoma_(p, -47))] = 'Terça-feira de Carnaval';
  f[pontoYmd_(pontoSoma_(p, -46))] = 'Quarta-feira de Cinzas';
  f[pontoYmd_(pontoSoma_(p, 60))] = 'Corpus Christi';
  f[ano + '-10-28'] = 'Dia do Servidor Público';
  f[ano + '-12-24'] = 'Véspera de Natal';
  f[ano + '-12-31'] = 'Véspera de Ano-Novo';
  return f;
}
function pontoFeriadosAba_(criar) {
  var id = PropertiesService.getScriptProperties().getProperty('ID_PONTO');
  if (!id) return null;
  var ss = SpreadsheetApp.openById(id), aba = ss.getSheetByName(PONTO_FERIADOS_ABA);
  if (aba || !criar) return aba;
  aba = ss.insertSheet(PONTO_FERIADOS_ABA);
  aba.getRange(1, 1, 1, 3).setValues([['Data', 'Nome', 'Situação']]).setFontWeight('bold');
  aba.getRange('A:A').setNumberFormat('@');
  aba.setFrozenRows(1);
  return aba;
}
/** Decisões do pleno: { 'yyyy-MM-dd': { nome, situacao: 'Feriado' | 'Dia normal' } } */
function pontoFeriadosMapa_() {
  var mapa = {}, aba = null;
  try { aba = pontoFeriadosAba_(false); } catch (err) { aba = null; }
  if (!aba || aba.getLastRow() < 2) return mapa;
  aba.getRange(2, 1, aba.getLastRow() - 1, 3).getValues().forEach(function (l) {
    var k = (l[0] instanceof Date) ? Utilities.formatDate(l[0], PONTO_TZ, 'yyyy-MM-dd') : limpar_(l[0]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(k)) mapa[k] = { nome: limpar_(l[1]), situacao: limpar_(l[2]) === 'Feriado' ? 'Feriado' : 'Dia normal' };
  });
  return mapa;
}
function pontoEhFeriado_(ymd, mapa) {
  return !!pontoFeriadosFixos_(Number(ymd.slice(0, 4)))[ymd] || !!(mapa[ymd] && mapa[ymd].situacao === 'Feriado');
}
/** Segunda a sexta que não seja feriado. */
function pontoDiaUtil_(data, mapa) {
  var dow = Number(Utilities.formatDate(data, PONTO_TZ, 'u'));
  return dow <= 5 && !pontoEhFeriado_(Utilities.formatDate(data, PONTO_TZ, 'yyyy-MM-dd'), mapa);
}
function appFeriadosAdmin_(u, req) {
  exigirPlenoEng_(u);
  var ano = Number(req && req.ano) || Number(pontoTexto_(new Date(), 'yyyy')), mapa = pontoFeriadosMapa_(), lista = [];
  var fx = pontoFeriadosFixos_(ano), fac = pontoFacultativos_(ano);
  Object.keys(fx).forEach(function (k) { lista.push({ data: k, nome: fx[k], tipo: 'fixo', situacao: 'Feriado' }); });
  Object.keys(fac).forEach(function (k) { lista.push({ data: k, nome: fac[k], tipo: 'facultativo', situacao: mapa[k] ? mapa[k].situacao : 'Dia normal' }); });
  Object.keys(mapa).forEach(function (k) {
    if (k.slice(0, 4) === String(ano) && !fx[k] && !fac[k]) lista.push({ data: k, nome: mapa[k].nome, tipo: 'extra', situacao: mapa[k].situacao });
  });
  lista.sort(function (a, b) { return a.data < b.data ? -1 : (a.data > b.data ? 1 : 0); });
  return { ano: ano, lista: lista };
}
/** situacao: 'Feriado', 'Dia normal' ou 'Remover' (só para datas extras). Só pleno. */
function appFeriadoSalvar_(u, req) {
  exigirPlenoEng_(u);
  var data = limpar_(req.data), sit = limpar_(req.situacao), nome = limpar_(req.nome).slice(0, 60) || 'Folga do escritório';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data inválida.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var aba = pontoFeriadosAba_(true), n = aba.getLastRow(), linha = 0;
    if (n >= 2) {
      aba.getRange(2, 1, n - 1, 1).getValues().forEach(function (l, i) {
        var k = (l[0] instanceof Date) ? Utilities.formatDate(l[0], PONTO_TZ, 'yyyy-MM-dd') : limpar_(l[0]);
        if (k === data) linha = i + 2;
      });
    }
    if (sit === 'Remover') { if (linha) aba.deleteRow(linha); }
    else {
      var sv = sit === 'Feriado' ? 'Feriado' : 'Dia normal';
      if (!linha) { linha = Math.max(2, n + 1); aba.getRange(linha, 1).setNumberFormat('@'); }
      aba.getRange(linha, 1, 1, 3).setValues([[data, nome, sv]]);
    }
  } finally {
    lock.releaseLock();
  }
  return appFeriadosAdmin_(u, { ano: data.slice(0, 4) });
}

// ---------- leitura dos registros ----------
function pontoAbaLer_(nome) {
  var id = PropertiesService.getScriptProperties().getProperty('ID_PONTO');
  if (!id) return null;
  try { return pontoAba_(SpreadsheetApp.openById(id), nome, false); } catch (err) { return null; }
}
function pontoMin_(hhmm) { var p = String(hhmm).split(':'); return Number(p[0]) * 60 + Number(p[1]); }
function pontoMs_(dataBR, hhmm) { return Utilities.parseDate(dataBR + ' ' + hhmm, PONTO_TZ, 'dd/MM/yyyy HH:mm').getTime(); }
/** Aba inteira agrupada por dia: { 'dd/MM/yyyy': { 'Iniciou o trabalho': 'HH:mm', ... } } */
function pontoLerDias_(aba) {
  var dias = {};
  if (!aba || aba.getLastRow() < 2) return dias;
  aba.getRange(2, 1, aba.getLastRow() - 1, 3).getValues().forEach(function (l) {
    var d = pontoTexto_(l[0], 'dd/MM/yyyy'), ev = String(l[2]);
    if (PONTO_EVENTOS.indexOf(ev) < 0) return;
    (dias[d] = dias[d] || {})[ev] = pontoTexto_(l[1], 'HH:mm:ss').slice(0, 5);
  });
  return dias;
}
/** Estado de hoje: eventos, qual é o próximo (0 a 3; 4 = encerrado), hora da saída do almoço (para a contagem de 1 h) e se a volta ficou esquecida (3h30). */
function pontoEstado_(aba, dias) {
  var agora = new Date(), hoje = pontoTexto_(agora, 'dd/MM/yyyy'), ev = (dias || pontoLerDias_(aba))[hoje] || {};
  var lista = [], proximo = 0, saidaMs = 0, esquecida = false;
  PONTO_EVENTOS.forEach(function (n) { if (ev[n]) lista.push({ evento: n, hora: ev[n] }); });
  if (ev[PONTO_EVENTOS[3]]) proximo = 4;
  else {
    while (proximo < 3 && ev[PONTO_EVENTOS[proximo]]) proximo++;
    if (proximo === 2) {
      saidaMs = pontoMs_(hoje, ev[PONTO_EVENTOS[1]]);
      if (agora.getTime() - saidaMs > PONTO_ALMOCO_MAX_MIN * 60000) { esquecida = true; proximo = 3; saidaMs = 0; }
    }
  }
  return { eventos: lista, proximo: proximo, almocoSaida: (proximo === 2 ? saidaMs : 0), esquecida: esquecida, agora: agora.getTime() };
}
/** Dias dos últimos 7 (sem contar hoje) que têm registro mas estão sem algum horário. */
function pontoPendencias_(dias, agora) {
  var out = [];
  for (var i = PONTO_RETRO_DIAS; i >= 1; i--) {
    var d = pontoTexto_(new Date(agora.getTime() - i * 86400000), 'dd/MM/yyyy'), ev = dias[d];
    if (!ev) continue;
    var falta = [];
    PONTO_EVENTOS.forEach(function (n, k) { if (!ev[n]) falta.push(PONTO_FALTAS[k]); });
    if (falta.length) out.push({ data: d, falta: falta });
  }
  return out;
}
/** Cálculo de um dia: (fim - início) - almoço. Sem a volta/saída do almoço: estimado com 1 h. Sem início ou fim: não calculado. */
function pontoCalcDia_(ev, ehHoje) {
  var m = function (k) { return ev[PONTO_EVENTOS[k]] ? pontoMin_(ev[PONTO_EVENTOS[k]]) : null; };
  var ini = m(0), sai = m(1), vol = m(2), fim = m(3), r = { min: 0, estado: 'ok', falta: [] };
  PONTO_EVENTOS.forEach(function (n, k) { if (!ev[n]) r.falta.push(PONTO_FALTAS[k]); });
  if (ehHoje && fim === null) { r.estado = 'andamento'; return r; }
  if (ini === null || fim === null) { r.estado = 'nao_calculado'; return r; }
  var almoco = 60;
  if (sai !== null && vol !== null) almoco = vol - sai; else r.estado = 'estimado';
  r.min = Math.max(0, fim - ini - almoco);
  return r;
}
function pontoHorasDe_(aba, ym) {
  var dias = pontoLerDias_(aba), hoje = pontoTexto_(new Date(), 'dd/MM/yyyy'), lista = [], total = 0, est = [], nc = [];
  Object.keys(dias).filter(function (d) { return d.slice(6) === ym.slice(0, 4) && d.slice(3, 5) === ym.slice(5, 7); }).sort().forEach(function (d) {
    var ev = dias[d], c = pontoCalcDia_(ev, d === hoje);
    lista.push({ data: d, ini: ev[PONTO_EVENTOS[0]] || '', sai: ev[PONTO_EVENTOS[1]] || '', vol: ev[PONTO_EVENTOS[2]] || '', fim: ev[PONTO_EVENTOS[3]] || '',
                 min: c.min, estado: c.estado, falta: c.falta });
    if (c.estado === 'ok' || c.estado === 'estimado') total += c.min;
    if (c.estado === 'estimado') est.push(d.slice(0, 2));
    if (c.estado === 'nao_calculado') nc.push(d.slice(0, 2));
  });
  return { mes: ym, total: total, dias: lista, estimados: est, naoCalculados: nc };
}
function pontoPainel_(u, aba, dias) {
  dias = dias || pontoLerDias_(aba);
  var est = pontoEstado_(aba, dias), vis = pontoVisiveis_(u);
  est.pendencias = pontoPendencias_(dias, new Date());
  est.equipe = vis.length > 1;
  est.retroDias = PONTO_RETRO_DIAS;
  est.pessoas = papelEngenharia_(u) === 'pleno' ? vis.map(function (x) { return x.nome; }) : [];
  return est;
}

// ---------- ações do app ----------
function appPonto_(u) {
  exigirPonto_(u);
  return pontoPainel_(u, pontoAbaLer_(u.nome));
}
function appPontoRegistrar_(u) {
  exigirPonto_(u);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  var est, msg;
  try {
    var ss = pontoSS_(), aba = pontoAba_(ss, u.nome, true);
    est = pontoEstado_(aba);
    if (est.proximo >= 4) throw new Error('Sua jornada de hoje já foi finalizada.');
    var ult = aba.getLastRow();
    var ultimo = ult >= 2 ? aba.getRange(ult, 4).getValue() : null;
    if (ultimo instanceof Date && new Date().getTime() - ultimo.getTime() < PONTO_ESPERA_SEG * 1000) throw new Error('Aguarde alguns segundos antes de registrar de novo.');
    var agora = new Date(), r = ult + 1;
    aba.getRange(r, 1, 1, 3).setNumberFormat('@').setValues([[pontoTexto_(agora, 'dd/MM/yyyy'), pontoTexto_(agora, 'HH:mm:ss'), PONTO_EVENTOS[est.proximo]]]);
    aba.getRange(r, 4).setValue(agora);
    msg = PONTO_AVISOS[est.proximo];
    est = pontoPainel_(u, aba);
  } finally {
    lock.releaseLock();
  }
  est.aviso = msg; // sem push por evento; o app mostra a janela flutuante.
  return est;
}
/** Registro retroativo (últimos 7 dias, hoje incluído). req: { data: 'yyyy-MM-dd', evento: 0 a 3, hora: 'HH:mm', alvo?: nome }. A própria pessoa ou o pleno. */
function appPontoRetro_(u, req) {
  exigirPonto_(u);
  var alvo = u.nome;
  if (limpar_(req.alvo) && chave_(req.alvo) !== chave_(u.nome)) {
    if (papelEngenharia_(u) !== 'pleno') throw new Error(MSG_SEM_PERMISSAO);
    var achado = pontoVisiveis_(u).filter(function (x) { return chave_(x.nome) === chave_(req.alvo); })[0];
    if (!achado) throw new Error('Pessoa não encontrada no Ponto.');
    alvo = achado.nome;
  }
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpar_(req.data));
  if (!m) throw new Error('Escolha o dia.');
  var ev = PONTO_EVENTOS[Number(req.evento)];
  if (!ev) throw new Error('Escolha o horário que faltou.');
  var hm = /^(\d{1,2}):(\d{2})$/.exec(limpar_(req.hora));
  if (!hm || Number(hm[1]) > 23 || Number(hm[2]) > 59) throw new Error('Digite a hora no formato 08:30.');
  var dataBR = m[3] + '/' + m[2] + '/' + m[1], hora = ('0' + hm[1]).slice(-2) + ':' + hm[2], agora = new Date();
  if (m[1] + m[2] + m[3] < pontoTexto_(new Date(agora.getTime() - PONTO_RETRO_DIAS * 86400000), 'yyyyMMdd')) throw new Error('O lançamento retroativo vale para os últimos ' + PONTO_RETRO_DIAS + ' dias.');
  if (pontoMs_(dataBR, hora) > agora.getTime()) throw new Error('Esse horário ainda não chegou.');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = pontoSS_(), aba = pontoAba_(ss, alvo, true), dia = pontoLerDias_(aba)[dataBR] || {};
    if (dia[ev]) throw new Error('Esse horário já está registrado nesse dia (' + dia[ev] + ').');
    var ult = -1, fora = false;
    PONTO_EVENTOS.forEach(function (n) {
      var h = (n === ev) ? hora : dia[n];
      if (!h) return;
      var v = pontoMin_(h);
      if (v <= ult) fora = true;
      ult = v;
    });
    if (fora) throw new Error('Esse horário não combina com os outros do dia. A ordem é: início, saída para o almoço, volta do almoço e finalização.');
    var r = aba.getLastRow() + 1;
    aba.getRange(r, 1, 1, 3).setNumberFormat('@').setValues([[dataBR, hora + ':00', ev]]);
    aba.getRange(r, 4).setValue(agora);
    aba.getRange(r, 5).setValue('Retroativo' + (chave_(alvo) !== chave_(u.nome) ? ' (lançado por ' + u.nome + ')' : ''));
    if (!aba.getRange(1, 5).getValue()) aba.getRange(1, 5).setValue('Origem').setFontWeight('bold');
  } finally {
    lock.releaseLock();
  }
  var out = pontoPainel_(u, pontoAbaLer_(u.nome));
  out.aviso = 'Horário lançado: ' + ev.toLowerCase() + ' às ' + hora + ' do dia ' + dataBR.slice(0, 5) + '.';
  return out;
}
function pontoMesReq_(req) { return /^\d{4}-\d{2}$/.test(String(req && req.mes)) ? String(req.mes) : pontoTexto_(new Date(), 'yyyy-MM'); }
/** Horas do mês de uma pessoa (a própria, ou quem o perfil pode ver). */
function appPontoHoras_(u, req) {
  exigirPonto_(u);
  var alvo = limpar_(req.alvo) || u.nome;
  var item = pontoVisiveis_(u).filter(function (x) { return chave_(x.nome) === chave_(alvo); })[0];
  if (!item) throw new Error(MSG_SEM_PERMISSAO);
  var r = pontoHorasDe_(pontoAbaLer_(item.nome), pontoMesReq_(req));
  r.nome = item.nome;
  return r;
}
/** Totais do mês de todos que o perfil pode ver (aba Horas da equipe). */
function appPontoEquipe_(u, req) {
  exigirPonto_(u);
  var vis = pontoVisiveis_(u);
  if (vis.length < 2) throw new Error(MSG_SEM_PERMISSAO);
  var ym = pontoMesReq_(req);
  return { mes: ym, pessoas: vis.map(function (x) {
    var r = pontoHorasDe_(pontoAbaLer_(x.nome), ym);
    return { nome: x.nome, papel: x.papel, total: r.total, diasComRegistro: r.dias.length, estimados: r.estimados, naoCalculados: r.naoCalculados };
  }) };
}

