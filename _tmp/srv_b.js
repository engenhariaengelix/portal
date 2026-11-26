function pontoPush_(nome, texto) {
  return pushar_([[Utilities.getUuid().slice(0, 8), new Date(), nome, 'ponto', 'Ponto', texto, PONTO_LINK, nome, '']]);
}
function pontoDatasTexto_(pend) {
  var d = pend.map(function (p) { return p.data.slice(0, 5); });
  if (d.length === 1) return 'Ficou um horário em aberto no dia ' + d[0];
  if (d.length <= 3) return 'Ficaram horários em aberto nos dias ' + d.slice(0, -1).join(', ') + ' e ' + d[d.length - 1];
  return 'Ficaram horários em aberto em ' + d.length + ' dias, a partir de ' + d[0];
}
/** Gatilho (aquecer, a cada 5 min). Notificações amigáveis do Ponto, 1 vez cada:
 *  - almoço passou de 1 h sem registrar a volta (10h às 17h);
 *  - 9h (até 11h), dia útil: horário em aberto nos últimos 7 dias;
 *  - 20h, dia útil: ponto de hoje ainda aberto. */
function pontoVerificarAtraso_() {
  var agora = new Date(), hora = Number(pontoTexto_(agora, 'H'));
  if (hora < 9 || hora > 20) return;
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('ID_PONTO');
  if (!id) return;
  var ss = SpreadsheetApp.openById(id), hojeKey = pontoTexto_(agora, 'yyyy-MM-dd'), util = pontoDiaUtil_(agora, pontoFeriadosMapa_());
  linhasUsuarios_().filter(function (x) {
    return x.empresa === 'engenharia' && ['pleno', 'gerencia', 'operacional'].indexOf(x.papel) >= 0 && pontoPermitido_(x.papel, x.nome);
  }).forEach(function (x) {
    var aba = pontoAba_(ss, x.nome, false);
    if (!aba) return;
    var dias = pontoLerDias_(aba), est = pontoEstado_(aba, dias), n1 = limpar_(x.nome).split(' ')[0], k = chave_(x.nome);
    if (hora >= 10 && hora <= 17 && est.almocoSaida && agora.getTime() - est.almocoSaida >= 3600000) {
      var ka = 'PONTO_ATRASO_' + k;
      if (props.getProperty(ka) !== String(est.almocoSaida)) {
        props.setProperty(ka, String(est.almocoSaida));
        pontoPush_(x.nome, 'Oi, ' + n1 + '! A volta do almoço de hoje ficou sem registro. Toque aqui para lançar o horário. Leva um minutinho. 😊');
      }
    }
    if (util && hora >= 9 && hora <= 11) {
      var pend = pontoPendencias_(dias, agora), k9 = 'PONTO_9H_' + k;
      if (pend.length && props.getProperty(k9) !== hojeKey) {
        props.setProperty(k9, hojeKey);
        pontoPush_(x.nome, 'Bom dia, ' + n1 + '! ' + pontoDatasTexto_(pend) + '. Toque aqui e complete. Leva um minutinho. 😊');
      }
    }
    if (util && hora === 20 && est.eventos.length && est.proximo < 4) {
      var k20 = 'PONTO_20H_' + k;
      if (props.getProperty(k20) !== hojeKey) {
        props.setProperty(k20, hojeKey);
        pontoPush_(x.nome, 'Oi, ' + n1 + '! Seu ponto ainda está aberto... Se já terminou registre a saída. 😊');
      }
    }
  });
}
