/* Barra "Pergunte sua dúvida" (todas as páginas com login e o link individual; a Agenda não tem): manda a pergunta + um resumo curto dos dados da página para a API (acao perguntar),
   mostra a resposta resumida embaixo e, quando vier, um gráfico simples (barras ou pizza). Limites ficam na API. */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const brl = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
  const CORES = ['#f0507e', '#7fdda9', '#f5c451', '#6fa8ff', '#b48cff', '#ff9f6b', '#5fd3e0', '#c9c4d6', '#e86fb8', '#9bd36f', '#d9a066', '#8899aa'];
  const ERR = { sem_chave: 'O assistente ainda não foi ligado (falta a chave da API).', limite: 'Você usou todo o limite de hoje. Amanhã libera de novo.', link: 'Este link não vale mais.',
    limite_geral: 'O limite de perguntas do app por hoje acabou. Amanhã libera de novo.', ocupado: 'O assistente está ocupado agora. Tente de novo em 1 minuto.',
    recusa: 'Não consegui responder essa. Tente perguntar de outro jeito.', acesso: 'Sem acesso ao assistente.', pergunta: 'Escreva a pergunta.' };
  const CSS = `.lbq{margin:4px 0 14px}.lbq form{display:flex;gap:8px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 6px 6px 14px;align-items:center}
.lbq input{flex:1;min-width:0;border:0;background:transparent;color:var(--ink);font:inherit;font-size:15px;outline:none;padding:8px 0}
.lbq button{border:0;background:var(--pink);color:#fff;border-radius:10px;padding:10px 14px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap}.lbq button:disabled{opacity:.5}
.lbq .qr{background:var(--card);border-radius:14px;padding:14px 16px;margin-top:8px;border-left:3px solid var(--pink)}.lbq .qp{font-size:12px;color:var(--muted);margin-bottom:6px}
.lbq .qt{font-size:15px;line-height:1.5;color:var(--ink);white-space:pre-line}.lbq .qn{font-size:11.5px;color:var(--muted);margin-top:10px;display:flex;justify-content:space-between;gap:8px}
.lbq .qn a{color:var(--muted)}.lbq .qe{color:var(--pinkl)}.lbq .qg{margin-top:12px}.lbq .qg b{display:block;font-size:12px;color:var(--sub);margin-bottom:8px;letter-spacing:.04em;text-transform:uppercase}
.lbq .qb{display:grid;grid-template-columns:minmax(70px,34%) 1fr auto;gap:5px 8px;align-items:center;font-size:12.5px}.lbq .qb span{color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbq .qb i{display:block;height:10px;border-radius:99px;min-width:2px}.lbq .qb em{font-style:normal;color:var(--ink);font-weight:700;white-space:nowrap}
.lbq .qz{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.lbq .qz ul{list-style:none;margin:0;padding:0;font-size:12.5px;flex:1;min-width:150px}.lbq .qz li{display:flex;gap:6px;align-items:center;padding:2px 0;color:var(--sub)}
.lbq .qz li i{width:9px;height:9px;border-radius:3px;flex:none}.lbq .qz li em{margin-left:auto;font-style:normal;color:var(--ink);font-weight:700}
.lbq .ql{display:inline-block;width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--pink);border-radius:99px;animation:lbqs .8s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes lbqs{to{transform:rotate(360deg)}}`;
  const fmt = (v, it) => it.some(x => Math.abs(x.valor) >= 100) ? brl(v) : String(Math.round(v * 10) / 10).replace('.', ',');
  function grafico(g) {
    const it = (g.itens || []).filter(x => isFinite(+x.valor)).slice(0, 12); if (it.length < 2) return '';
    if (g.tipo === 'pizza') {
      const pos = it.filter(x => x.valor > 0), tt = pos.reduce((a, x) => a + x.valor, 0); if (!tt) return '';
      let a0 = 0; const R = 15.9155, arc = pos.map((x, i) => { const p = x.valor / tt * 100, c = `<circle r="${R}" cx="21" cy="21" fill="none" stroke="${CORES[i % 12]}" stroke-width="6" stroke-dasharray="${Math.max(p - .6, .1)} ${100 - Math.max(p - .6, .1)}" stroke-dashoffset="${25 - a0}"/>`; a0 += p; return c; }).join('');
      return `<div class="qg"><b>${esc(g.titulo)}</b><div class="qz"><svg viewBox="0 0 42 42" width="104" height="104" aria-hidden="true"><circle r="${R}" cx="21" cy="21" fill="none" stroke="var(--card2)" stroke-width="6"/>${arc}</svg><ul>${pos.map((x, i) => `<li><i style="background:${CORES[i % 12]}"></i>${esc(x.rotulo)}<em>${fmt(x.valor, it)} · ${Math.round(x.valor / tt * 100)}%</em></li>`).join('')}</ul></div></div>`;
    }
    const mx = Math.max(...it.map(x => Math.abs(x.valor))) || 1;
    return `<div class="qg"><b>${esc(g.titulo)}</b><div class="qb">${it.map(x => `<span title="${esc(x.rotulo)}">${esc(x.rotulo)}</span><i style="width:${Math.abs(x.valor) / mx * 100}%;background:${x.valor < 0 ? 'var(--neg)' : 'var(--pink)'}"></i><em>${fmt(x.valor, it)}</em>`).join('')}</div></div>`;
  }
  /* el = elemento; op.contexto() = texto curto com os dados; op.base = caminho até config.json; op.exemplos = sugestões no placeholder */
  function montar(el, op) {
    if (!el) return; if (!document.getElementById('lbqcss')) { const s = document.createElement('style'); s.id = 'lbqcss'; s.textContent = CSS; document.head.appendChild(s); }
    el.className = 'lbq';
    el.innerHTML = `<form><input maxlength="300" placeholder="💬 Pergunte sua dúvida${op.exemplo ? ' · ex.: ' + esc(op.exemplo) : ''}" aria-label="Pergunte sua dúvida" enterkeyhint="send"><button>Perguntar</button></form><div class="qo"></div>`;
    const f = el.querySelector('form'), inp = f.querySelector('input'), bt = f.querySelector('button'), out = el.querySelector('.qo');
    let api = '';
    f.onsubmit = async e => {
      e.preventDefault(); const q = inp.value.trim(); if (q.length < 3 || bt.disabled) return;
      bt.disabled = true; out.innerHTML = `<div class="qr"><div class="qp">${esc(q)}</div><div class="qt"><span class="ql"></span>Pensando…</div></div>`;
      try {
        if (!api) api = (await (await fetch((op.base || '') + 'config.json', { cache: 'no-store' })).json()).api_url;
        let ctx = ''; try { ctx = op.contexto(); } catch (er) { }
        const r = await (await fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ acao: 'perguntar', pergunta: q, contexto: limpa(ctx).slice(0, 16000), base: op.base_dados ? String(op.base_dados() || '').slice(0, 400000) : '' }, op.auth ? op.auth() : { usuario: LB.login, senha: LB.senha, nome: LB.usuario })) })).json();
        if (!r.ok) { out.innerHTML = `<div class="qr"><div class="qp">${esc(q)}</div><div class="qt qe">${r.erro === 'espera' ? `Espere ${r.s} s para a próxima pergunta.` : ERR[r.erro] || 'Não consegui responder agora. Tente de novo.'}</div></div>`; return; }
        out.innerHTML = `<div class="qr"><div class="qp">${esc(q)}</div><div class="qt">${esc(r.resposta)}</div>${r.grafico ? grafico(r.grafico) : ''}<div class="qn"><span>Resposta automática com os dados do app · confira os valores antes de decidir</span><span>${r.uso != null ? 'uso de hoje: ' + r.uso + '% · ' : ''}<a href="#" class="qx">fechar</a></span></div></div>`;
        inp.value = '';
      } catch (er) { out.innerHTML = `<div class="qr"><div class="qt qe">Sem conexão. Tente de novo.</div></div>`; }
      finally { setTimeout(() => { bt.disabled = false; }, 3000); }
    };
    out.addEventListener('click', e => { if (e.target.closest('.qx')) { e.preventDefault(); out.innerHTML = ''; } });
  }
  /* dados pessoais nunca vão para o assistente: some PIX, CPF/CNPJ, telefone, e-mail e dados de conta */
  function limpa(t) {
    return String(t || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[e-mail]').replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[doc]').replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[doc]')
      .replace(/\(?\b\d{2}\)?\s?9\d{4}-?\d{4}\b/g, '[tel]').replace(/\b(PIX|chave pix|chave)\s*:?\s*(?=[^\s,;·|]*\d{5}|[^\s,;·|]*@)[^\s,;·|]+/gi, '$1 [oculto]').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[chave]')
      .replace(/\b(ag(ência)?|conta|cc)\s*:?\s*\d[\d.-]{2,}/gi, '$1 [oculto]');
  }
  /* texto que está visível na tela agora (aba aberta), sem o próprio chat, botões e campos */
  function texto(root) {
    if (!root) return ''; const c = root.cloneNode(true), vivo = [...root.querySelectorAll('*')], copia = [...c.querySelectorAll('*')];
    vivo.forEach((e, i) => { const x = copia[i]; if (!x) return; if (e.classList.contains('lbq') || e.matches('script,style,button,input,select,textarea,svg,datalist') || e.getClientRects().length === 0) x.setAttribute('data-lbqx', '1'); });
    c.querySelectorAll('[data-lbqx]').forEach(x => x.remove());
    return (c.innerText || c.textContent || '').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  }
  /* coloca a barra antes do elemento "onde" e usa o que está na tela como dados */
  function auto(onde, op) { if (!onde) return; const el = document.createElement('div'); onde.parentNode.insertBefore(el, onde); const raiz = op.raiz || onde.parentNode;
    montar(el, Object.assign({ contexto: () => (op.extra ? op.extra() + '\n\n' : '') + 'TELA ABERTA (' + (op.pagina || document.title) + '):\n' + texto(raiz) }, op)); return el; }
  window.LBCHAT = { montar, grafico, texto, auto, limpa };
})();
