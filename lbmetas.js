/* Metas com check (aba "Rotinas") e tarefas agrupadas por categoria.
   Usado na página Metas (login), no link individual (tarefas/eu) e no Admin (ver e corrigir marcações).
   freq: dia = todo dia · util = segunda a sexta · semana = "alvo" vezes por semana (seg a dom) · mes = "alvo" vezes no mês.
   Cada marcação pode ter uma justificativa (notas = {data: texto}). */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const ddmm = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const FREQ = { dia: '1 por dia', util: '1 por dia útil (seg a sex)', semana: 'por semana', mes: 'vezes no mês' };
  const dow = d => new Date(d + 'T12:00:00').getDay();
  const soma = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const seg = d => soma(d, -((dow(d) + 6) % 7)); // segunda-feira da semana
  function diasMes(m) { const n = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); return Array.from({ length: n }, (_, i) => m + '-' + String(i + 1).padStart(2, '0')); }
  function checks(r) { try { return JSON.parse(r.checks || '[]') || []; } catch (e) { return []; } }
  function notas(r) { try { return JSON.parse(r.notas || '{}') || {}; } catch (e) { return {}; } }
  const dentro = (r, d) => (!r.inicio || d >= r.inicio) && (!r.fim || d <= r.fim);
  const valeNoDia = (r, d) => dentro(r, d) && (r.freq !== 'util' || dow(d) % 6 !== 0);
  const alvo = r => Math.max(1, +r.alvo || 1);
  const naSemana = (r, w) => checks(r).filter(d => d >= w && d <= soma(w, 6)).length;
  /* resultado do mês m: feitos, total do mês, esperado até hoje, % do mês e % até hoje (ritmo) */
  function pct(r, m, hj) {
    hj = hj || hoje(); const ck = checks(r).filter(d => d.startsWith(m));
    if (r.freq === 'mes') {
      const al = alvo(r), dm = diasMes(m), passou = m < hj.slice(0, 7) ? 1 : m > hj.slice(0, 7) ? 0 : (+hj.slice(8, 10)) / dm.length;
      const ate = Math.max(1, Math.round(al * passou));
      return { feitos: ck.length, total: al, ate, pct: Math.min(1, ck.length / al), ritmo: Math.min(1, ck.length / ate) };
    }
    if (r.freq === 'semana') { // semanas que começam (segunda) no mês
      const al = alvo(r), ws = diasMes(m).filter(d => dow(d) === 1 && soma(d, 6) >= (r.inicio || '') && (!r.fim || d <= r.fim));
      let f = 0, ate = 0, fa = 0;
      ws.forEach(w => { const n = Math.min(al, naSemana(r, w)); f += n; if (soma(w, 6) < hj) { ate += al; fa += n; } else if (w <= hj && n) { ate += n; fa += n; } });
      return { feitos: f, total: ws.length * al, ate, pct: ws.length ? f / (ws.length * al) : 0, ritmo: ate ? fa / ate : null, semanas: ws.length };
    }
    const ds = diasMes(m).filter(d => valeNoDia(r, d)), set = new Set(ck), f = ds.filter(d => set.has(d)).length;
    const ate = ds.filter(d => d < hj || (d === hj && set.has(d))).length;
    return { feitos: f, total: ds.length, ate, pct: ds.length ? f / ds.length : 0, ritmo: ate ? f / ate : (f ? 1 : 0) };
  }
  /* o que falta marcar agora (hoje / esta semana / ritmo do mês) */
  function pend(r, hj) {
    hj = hj || hoje(); if (r.ativo === 'não' || (!dentro(r, hj) && r.freq !== 'semana')) return null;
    if (r.freq === 'dia' || r.freq === 'util') return valeNoDia(r, hj) && !checks(r).includes(hj) ? 'hoje' : null;
    if (r.freq === 'semana') { const w = seg(hj), n = naSemana(r, w); if ((r.inicio && soma(w, 6) < r.inicio) || (r.fim && w > r.fim)) return null;
      return n < alvo(r) ? 'esta semana' + (alvo(r) > 1 ? ` (${n} de ${alvo(r)})` : '') : null; }
    const x = pct(r, hj.slice(0, 7), hj); return x.feitos < x.ate ? `no mês (${x.feitos} de ${x.total})` : null;
  }
  const P100 = x => x == null ? '—' : Math.round(x * 100) + '%';
  const cor = x => x == null ? 'var(--muted)' : x >= .8 ? 'var(--pos)' : x >= .5 ? '#F5C451' : 'var(--neg)';
  function porCat(l) { const G = {}; l.forEach(t => (G[t.categoria || ''] = G[t.categoria || ''] || []).push(t)); return Object.entries(G).sort((a, b) => !a[0] - !b[0] || a[0].localeCompare(b[0])); }

  const CSS = `.rt{background:var(--card);border-radius:14px;padding:14px;border-left:4px solid var(--pink)}
.rt .rh{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.rt .rh b{font-size:16px}.rt .rp{font-size:22px;font-weight:900}
.rt .rs{font-size:12.5px;color:var(--muted);margin-top:2px}
.rt .br{height:6px;background:var(--card2);border-radius:99px;margin-top:8px;overflow:hidden}.rt .br i{display:block;height:100%;border-radius:99px}
.rk{margin-top:10px;width:100%;border:1px solid var(--line);background:var(--card2);border-radius:12px;padding:11px;font-size:15px;font-weight:700;color:var(--ink,#fff);cursor:pointer}
.rk.on{background:var(--pos);border-color:var(--pos);color:#141218}.rk.go{background:var(--pink);border-color:var(--pink);color:#fff}
.rkf{margin-top:10px;background:var(--card2);border-radius:12px;padding:10px}.rkf b{font-size:13px}.rkf textarea{width:100%;box-sizing:border-box;margin-top:6px;min-height:58px;border:1px solid var(--line);border-radius:10px;background:var(--bg,#141218);color:inherit;font:inherit;font-size:14px;padding:8px}
.rkf .rkb{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.rkf .rkb button{flex:1;min-width:90px;border:1px solid var(--line);background:transparent;color:inherit;border-radius:10px;padding:9px;font-weight:700;font-size:13.5px;cursor:pointer}
.rkf .rkb .ok{background:var(--pos);border-color:var(--pos);color:#141218}.rkf .rkb .x{color:var(--neg)}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px}.cal span{font-size:10px;color:var(--muted);text-align:center}
.cal button{aspect-ratio:1;border:1px solid var(--line);background:transparent;border-radius:8px;font-size:11px;color:var(--sub);padding:0;position:relative;cursor:pointer}
.cal button.ok{background:var(--pos);border-color:var(--pos);color:#141218;font-weight:700}.cal button.fx{border-color:rgba(255,143,168,.45);color:var(--neg)}
.cal button.nt::after{content:'';position:absolute;top:3px;right:3px;width:5px;height:5px;border-radius:9px;background:#141218;opacity:.55}
.cal button.hj{outline:2px solid var(--pinkl);outline-offset:1px}.cal button:disabled{opacity:.3;cursor:default}.cal button.na{visibility:hidden}
.rlg{margin-top:10px;font-size:12.5px}.rlg div{display:flex;gap:8px;padding:5px 0;border-top:1px solid var(--line)}.rlg div b{flex:none;width:40px;color:var(--sub)}.rlg div span{flex:1;min-width:0;word-break:break-word}
.alr{background:linear-gradient(135deg,rgba(225,29,72,.18),rgba(225,29,72,.06));border:1px solid rgba(240,80,126,.45);border-radius:14px;padding:12px 14px;margin:14px 0}
.alr>b{display:block;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--pinkl);margin-bottom:6px}
.alr button{display:flex;justify-content:space-between;gap:10px;width:100%;margin-top:6px;border:0;background:var(--card);color:inherit;border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer}.alr button small{color:var(--pinkl);font-weight:700;white-space:nowrap}
.alrok{font-size:13px;color:var(--pos);background:rgba(127,221,169,.08);border-radius:12px;padding:9px 12px;margin:14px 0}
.cat summary{list-style:none;display:flex;gap:8px;align-items:center;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--sub);margin:16px 2px 8px}
.cat summary::-webkit-details-marker{display:none}.cat summary small{color:var(--muted);letter-spacing:0}.cat summary::after{content:'▾';color:var(--muted);margin-left:auto}.cat:not([open]) summary::after{content:'▸'}`;
  function css() { if (!document.getElementById('lbmcss')) { const st = document.createElement('style'); st.id = 'lbmcss'; st.textContent = CSS; document.head.appendChild(st); } }

  /* cartão de uma meta. op.adm = Admin (qualquer dia do passado, sem limite de 40 dias) */
  function cardRot(r, hj, mesVer, op) {
    op = op || {}; const m = mesVer || hj.slice(0, 7), x = pct(r, m, hj), ck = checks(r), nt = notas(r), ehMes = m === hj.slice(0, 7);
    const nHj = ck.filter(d => d === hj).length, min = op.adm ? '2000-01-01' : soma(hj, -40);
    const ds = diasMes(m), pad = dow(ds[0]), sem = r.freq === 'semana';
    const cal = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<span>${d}</span>`).join('') + '<button class="na" disabled></button>'.repeat(pad) +
      ds.map(d => { const vale = sem || r.freq === 'mes' ? dentro(r, d) : valeNoDia(r, d), n = ck.filter(y => y === d).length, fut = d > hj, pode = !fut && d >= min && (vale || n);
        const c = n ? 'ok' : (vale && d < hj && (r.freq === 'dia' || r.freq === 'util') ? 'fx' : '');
        return `<button class="${c}${d === hj ? ' hj' : ''}${nt[d] ? ' nt' : ''}" ${pode ? `data-rf="${d}" data-rid="${esc(r.id)}"` : 'disabled'} title="${ddmm(d)}${nt[d] ? ' · ' + esc(nt[d]) : ''}">${(r.freq === 'mes' || sem) && n > 1 ? n : +d.slice(8)}</button>`; }).join('');
    const w = seg(hj), nW = naSemana(r, w);
    const sub = r.freq === 'mes' ? `meta ${r.alvo}× no mês · ${x.feitos} feitas`
      : sem ? `${alvo(r)}× por semana · ${x.feitos} de ${x.total} no mês`
      : `${FREQ[r.freq] || ''} · ${x.feitos} de ${x.total} dias no mês`;
    let bt = '';
    if (ehMes) {
      if (r.freq === 'mes') bt = `<button class="rk go" data-rf="${hj}" data-rid="${esc(r.id)}" data-novo="1">＋ Fiz mais uma hoje${nHj ? ' (' + nHj + ' hoje)' : ''}</button>`;
      else if (sem) bt = nW >= alvo(r) ? `<button class="rk on" data-rf="${ck.filter(d => d >= w && d <= hj).pop() || hj}" data-rid="${esc(r.id)}">✓ Feito esta semana</button>`
        : `<button class="rk go" data-rf="${hj}" data-rid="${esc(r.id)}" data-novo="1">Marcar esta semana${alvo(r) > 1 ? ` (${nW} de ${alvo(r)})` : ''}</button>`;
      else bt = valeNoDia(r, hj) ? `<button class="rk ${nHj ? 'on' : 'go'}" data-rf="${hj}" data-rid="${esc(r.id)}"${nHj ? '' : ' data-novo="1"'}>${nHj ? '✓ Feito hoje' : 'Marcar hoje'}</button>` : '<div class="rs" style="margin-top:8px">Hoje não conta para esta meta.</div>';
    }
    const reg = Object.keys(nt).filter(d => d.startsWith(m)).sort().reverse();
    return `<div class="rt" id="rt-${esc(r.id)}"><div class="rh"><b>${esc(r.titulo)}</b><span class="rp" style="color:${cor(ehMes ? x.ritmo : x.pct)}">${P100(ehMes ? x.ritmo : x.pct)}</span></div>
      <div class="rs">${sub}${ehMes ? ` · ${P100(x.pct)} do mês inteiro` : ''}</div><div class="br"><i style="width:${Math.round(x.pct * 100)}%;background:${cor(ehMes ? x.ritmo : x.pct)}"></i></div>
      ${bt}<div class="rkx"></div>
      <details${ehMes && !op.adm ? '' : ' open'}><summary style="margin:10px 2px 0;font-size:12px">Calendário de ${MESES[+m.slice(5, 7) - 1]} (toque num dia para marcar ou corrigir)</summary><div class="cal">${cal}</div>
      ${reg.length ? `<div class="rlg">${reg.map(d => `<div><b>${ddmm(d)}</b><span>${esc(nt[d])}</span></div>`).join('')}</div>` : ''}</details></div>`;
  }

  /* formulário rápido dentro do cartão: marcar (com justificativa), editar justificativa, desmarcar.
     box._rot() devolve a lista de metas atual; depois(resposta) redesenha. */
  function liga(box, chamar, depois) {
    box.addEventListener('click', async e => {
      const f = e.target.closest('[data-rf]'), a = e.target.closest('[data-rka]');
      if (f) {
        e.preventDefault(); const card = f.closest('.rt'), R = (box._rot ? box._rot() : []).find(x => x.id === f.dataset.rid); if (!card || !R) return;
        const d = f.dataset.rf, n = checks(R).filter(y => y === d).length, nt = notas(R)[d] || '', novo = f.dataset.novo === '1' || !n;
        card.querySelector('.rkx').innerHTML = `<div class="rkf"><b>${novo ? 'Marcar ' + (d === hoje() ? 'hoje' : ddmm(d)) : '✓ Marcado em ' + ddmm(d)}</b>
          <textarea placeholder="O que foi feito? (link do post, assunto da reunião…)">${novo && (R.freq === 'mes' || R.freq === 'semana') ? '' : esc(nt)}</textarea>
          <div class="rkb"><button class="ok" data-rka="${novo ? 'on' : 'nota'}" data-rd="${d}" data-rid="${esc(R.id)}">${novo ? '✓ Confirmar' : 'Salvar justificativa'}</button>${n ? `<button class="x" data-rka="off" data-rd="${d}" data-rid="${esc(R.id)}">Desmarcar</button>` : ''}<button data-rka="can">Cancelar</button></div></div>`;
        const ta = card.querySelector('.rkx textarea'); if (novo) setTimeout(() => ta.focus(), 30); card.querySelector('.rkx').scrollIntoView({ block: 'nearest' }); return;
      }
      if (!a) return; e.preventDefault(); const card = a.closest('.rt');
      if (a.dataset.rka === 'can') { card.querySelector('.rkx').innerHTML = ''; return; }
      if (a.dataset.rka === 'off' && a.dataset.ok !== '1') { a.dataset.ok = '1'; a.textContent = 'Toque de novo para desmarcar'; return; }
      const nota = (card.querySelector('.rkx textarea') || {}).value || ''; a.disabled = true; a.textContent = 'salvando…';
      try {
        const r = await chamar({ acao: 'marcar_rotina', id: a.dataset.rid, data: a.dataset.rd, on: a.dataset.rka !== 'off', so_nota: a.dataset.rka === 'nota', nota: nota.trim() });
        depois(r);
      } catch (err) { a.disabled = false; a.textContent = 'não salvou, tente de novo'; }
    });
  }

  /* página da pessoa: app = elemento, chamar(corpo) -> resposta da API ({perfil, tarefas, rotinas}) */
  async function pagina(app, chamar, titulo) {
    css();
    let r = await chamar({ acao: 'minhas_tarefas' });
    const ST = { P: r.perfil, T: r.tarefas || [], R: r.rotinas || [] };
    app._rot = () => ST.R;
    function card(t, HJ) {
      const atr = t.status !== 'Concluída' && t.prazo && t.prazo < HJ, c = t.status === 'Concluída' ? 'ok' : atr ? 'atr' : t.status === 'Em andamento' ? 'and' : '';
      return `<div class="tf ${c}"><b>${esc(t.titulo)}</b>${t.descricao ? `<div class="ds">${esc(t.descricao)}</div>` : ''}
    <div class="pz">${t.status === 'Concluída' ? 'Concluída em ' + ddmm(t.concluido_em) : t.prazo ? (atr ? '<span class="neg">Atrasada · era até ' + ddmm(t.prazo) + '</span>' : 'Entregar até ' + ddmm(t.prazo)) : 'Sem prazo'}</div>
    <div class="bts">${t.status === 'Concluída' ? `<button class="bt" data-id="${esc(t.id)}" data-s="A fazer">Reabrir</button>`
        : `<button class="bt${t.status === 'Em andamento' ? ' on' : ''}" data-id="${esc(t.id)}" data-s="${t.status === 'Em andamento' ? 'A fazer' : 'Em andamento'}">${t.status === 'Em andamento' ? '◐ Em andamento' : 'Comecei'}</button><button class="bt done" data-id="${esc(t.id)}" data-s="Concluída">✓ Concluí</button>`}</div></div>`;
    }
    function render() {
      const HJ = hoje(), MES = HJ.slice(0, 7), P = ST.P, T = ST.T, R = ST.R;
      const ab = T.filter(t => t.status !== 'Concluída').sort((a, b) => (a.prazo || '9').localeCompare(b.prazo || '9')),
        ok = T.filter(t => t.status === 'Concluída').sort((a, b) => (b.concluido_em || '').localeCompare(a.concluido_em || '')), okm = ok.filter(t => (t.concluido_em || '').startsWith(MES));
      const ant = new Date(+MES.slice(0, 4), +MES.slice(5, 7) - 2, 1), MA = ant.getFullYear() + '-' + String(ant.getMonth() + 1).padStart(2, '0');
      const rAnt = R.filter(x => (!x.inicio || x.inicio < MES + '-01'));
      const grupos = porCat(ab), comCat = grupos.some(g => g[0]);
      const PD = R.map(x => [x, pend(x, HJ)]).filter(y => y[1]);
      document.title = P.nome + ' · ' + titulo;
      app.innerHTML = `<h1>${esc(P.nome)}</h1><p class="fn">${esc(P.funcao || '')}</p>
    ${PD.length ? `<div class="alr"><b>⏰ Falta marcar</b>${PD.map(([x, q]) => `<button data-alr="${esc(x.id)}">${esc(x.titulo)}<small>${esc(q)} →</small></button>`).join('')}</div>`
          : R.length ? '<div class="alrok">✓ Tudo marcado por hoje.</div>' : ''}
    ${P.meta ? `<div class="meta"><span>Minha meta</span>${esc(P.meta)}</div>` : ''}
    ${R.length ? `<h3>Metas de ${MESES[+MES.slice(5, 7) - 1]}</h3><div class="list" data-max="0">${R.map(x => cardRot(x, HJ)).join('')}</div>` : ''}
    ${rAnt.length ? `<details><summary>Resultado de ${MESES[ant.getMonth()]}</summary><div class="list" data-max="0">${rAnt.map(x => cardRot(x, HJ, MA)).join('')}</div></details>` : ''}
    <div class="res"><div>A fazer<b>${ab.length}</b></div><div>Atrasadas<b style="${ab.some(t => t.prazo && t.prazo < HJ) ? 'color:var(--neg)' : ''}">${ab.filter(t => t.prazo && t.prazo < HJ).length}</b></div><div>Feitas no mês<b style="color:var(--pos)">${okm.length}</b></div></div>
    <h3>Tarefas em aberto</h3>${!ab.length ? '<div class="empty">Nada pendente. 👏</div>' : comCat
          ? grupos.map(([c, l]) => `<details class="cat" open><summary>${esc(c || 'Outras')} <small>${l.length}</small></summary><div class="list">${l.map(t => card(t, HJ)).join('')}</div></details>`).join('')
          : `<div class="list">${ab.map(t => card(t, HJ)).join('')}</div>`}
    ${ok.length ? `<details${ok.length <= 3 ? ' open' : ''}><summary>Concluídas (${ok.length})</summary><div class="list">${ok.slice(0, 30).map(t => card(t, HJ)).join('')}</div></details>` : ''}`;
    }
    const aplica = x => { ST.P = x.perfil; ST.T = x.tarefas || []; ST.R = x.rotinas || []; render(); };
    // alerta: leva até o cartão da meta e abre o formulário de marcar
    app.addEventListener('click', e => { const b = e.target.closest('[data-alr]'); if (!b) return; const c = document.getElementById('rt-' + b.dataset.alr); if (!c) return;
      const k = c.querySelector('.rk[data-novo]') || c.querySelector('[data-rf]'); c.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (k) k.click(); });
    liga(app, chamar, aplica);
    app.addEventListener('click', async e => {
      const b = e.target.closest('[data-id]'); if (!b) return; b.disabled = true; b.textContent = 'salvando…';
      try { aplica(await chamar({ acao: 'marcar_tarefa', id: b.dataset.id, status: b.dataset.s })); }
      catch (err) { b.textContent = 'não salvou, tente de novo'; b.disabled = false; }
    });
    render();
  }
  window.LBROT = { pct, pend, checks, notas, diasMes, porCat, FREQ, MESES, pagina, P100, cor, card: cardRot, css, liga };
})();
