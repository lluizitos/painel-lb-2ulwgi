/* Metas com check (aba "Rotinas") e tarefas agrupadas por categoria.
   Usado na página Metas (login), no link individual (tarefas/eu) e no Admin (só LBROT.pct).
   freq: dia = todo dia · util = segunda a sexta · mes = "alvo" vezes no mês. */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hoje = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const ddmm = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const FREQ = { dia: '1 por dia', util: '1 por dia útil (seg a sex)', mes: 'vezes no mês' };
  const dow = d => new Date(d + 'T12:00:00').getDay();
  function diasMes(m) { const n = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); return Array.from({ length: n }, (_, i) => m + '-' + String(i + 1).padStart(2, '0')); }
  function checks(r) { try { return JSON.parse(r.checks || '[]') || []; } catch (e) { return []; } }
  const valeNoDia = (r, d) => (!r.inicio || d >= r.inicio) && (!r.fim || d <= r.fim) && (r.freq !== 'util' || dow(d) % 6 !== 0);
  /* resultado do mês m: feitos, total do mês, esperado até hoje, % do mês e % até hoje (ritmo) */
  function pct(r, m, hj) {
    hj = hj || hoje(); const ck = checks(r).filter(d => d.startsWith(m));
    if (r.freq === 'mes') {
      const al = Math.max(1, +r.alvo || 1), dm = diasMes(m), passou = m < hj.slice(0, 7) ? 1 : m > hj.slice(0, 7) ? 0 : (+hj.slice(8, 10)) / dm.length;
      const ate = Math.max(1, Math.round(al * passou));
      return { feitos: ck.length, total: al, ate, pct: Math.min(1, ck.length / al), ritmo: Math.min(1, ck.length / ate) };
    }
    const ds = diasMes(m).filter(d => valeNoDia(r, d)), set = new Set(ck), f = ds.filter(d => set.has(d)).length;
    const ate = ds.filter(d => d < hj || (d === hj && set.has(d))).length;
    return { feitos: f, total: ds.length, ate, pct: ds.length ? f / ds.length : 0, ritmo: ate ? f / ate : (f ? 1 : 0) };
  }
  const P100 = x => Math.round(x * 100) + '%';
  const cor = x => x >= .8 ? 'var(--pos)' : x >= .5 ? '#F5C451' : 'var(--neg)';
  /* agrupa por categoria (sem categoria por último) */
  function porCat(l) { const G = {}; l.forEach(t => (G[t.categoria || ''] = G[t.categoria || ''] || []).push(t)); return Object.entries(G).sort((a, b) => !a[0] - !b[0] || a[0].localeCompare(b[0])); }

  const CSS = `.rt{background:var(--card);border-radius:14px;padding:14px;border-left:4px solid var(--pink)}
.rt .rh{display:flex;justify-content:space-between;align-items:baseline;gap:10px}.rt .rh b{font-size:16px}.rt .rp{font-size:22px;font-weight:900}
.rt .rs{font-size:12.5px;color:var(--muted);margin-top:2px}
.rt .br{height:6px;background:var(--card2);border-radius:99px;margin-top:8px;overflow:hidden}.rt .br i{display:block;height:100%;border-radius:99px}
.rk{margin-top:10px;width:100%;border:1px solid var(--line);background:var(--card2);border-radius:12px;padding:11px;font-size:15px;font-weight:700}
.rk.on{background:var(--pos);border-color:var(--pos);color:#141218}
.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px}.cal span{font-size:10px;color:var(--muted);text-align:center}
.cal button{aspect-ratio:1;border:1px solid var(--line);background:transparent;border-radius:8px;font-size:11px;color:var(--sub);padding:0}
.cal button.ok{background:var(--pos);border-color:var(--pos);color:#141218;font-weight:700}.cal button.fx{border-color:rgba(255,143,168,.45);color:var(--neg)}
.cal button.hj{outline:2px solid var(--pinkl);outline-offset:1px}.cal button:disabled{opacity:.3;cursor:default}.cal button.na{visibility:hidden}
.cat summary{list-style:none;display:flex;gap:8px;align-items:center;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--sub);margin:16px 2px 8px}
.cat summary::-webkit-details-marker{display:none}.cat summary small{color:var(--muted);letter-spacing:0}.cat summary::after{content:'▾';color:var(--muted);margin-left:auto}.cat:not([open]) summary::after{content:'▸'}`;

  function cardRot(r, hj, mesVer) {
    const m = mesVer || hj.slice(0, 7), x = pct(r, m, hj), ck = checks(r), set = new Set(ck), ehMes = m === hj.slice(0, 7);
    const nHj = ck.filter(d => d === hj).length, min = new Date(Date.now() - 3 * 3600e3 - 40 * 864e5).toISOString().slice(0, 10);
    const ds = diasMes(m), pad = dow(ds[0]);
    const cal = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<span>${d}</span>`).join('') + '<button class="na" disabled></button>'.repeat(pad) +
      ds.map(d => { const vale = valeNoDia(r, d), n = ck.filter(y => y === d).length, fut = d > hj, pode = !fut && d >= min && (vale || n);
        const c = n ? 'ok' : (vale && d < hj ? 'fx' : '');
        return `<button class="${c}${d === hj ? ' hj' : ''}" ${pode ? `data-rd="${d}" data-rid="${esc(r.id)}" data-on="${n ? 0 : 1}"` : 'disabled'} title="${ddmm(d)}">${r.freq === 'mes' && n > 1 ? n : +d.slice(8)}</button>`; }).join('');
    const sub = r.freq === 'mes' ? `meta ${r.alvo}× no mês · ${x.feitos} feitas` : `${FREQ[r.freq] || ''} · ${x.feitos} de ${x.total} dias no mês`;
    const bt = !ehMes ? '' : r.freq === 'mes'
      ? `<button class="rk${nHj ? ' on' : ''}" data-rd="${hj}" data-rid="${esc(r.id)}" data-on="1">＋ Fiz mais uma hoje${nHj ? ' (' + nHj + ' hoje)' : ''}</button>`
      : valeNoDia(r, hj) ? `<button class="rk${nHj ? ' on' : ''}" data-rd="${hj}" data-rid="${esc(r.id)}" data-on="${nHj ? 0 : 1}">${nHj ? '✓ Feito hoje' : 'Marcar hoje'}</button>` : '<div class="rs" style="margin-top:8px">Hoje não conta para esta meta.</div>';
    return `<div class="rt"><div class="rh"><b>${esc(r.titulo)}</b><span class="rp" style="color:${cor(ehMes ? x.ritmo : x.pct)}">${P100(ehMes ? x.ritmo : x.pct)}</span></div>
      <div class="rs">${sub}${ehMes ? ` · ${P100(x.pct)} do mês inteiro` : ''}</div><div class="br"><i style="width:${P100(x.pct)};background:${cor(ehMes ? x.ritmo : x.pct)}"></i></div>
      ${bt}<details${ehMes ? '' : ' open'}><summary style="margin:10px 2px 0;font-size:12px">Calendário de ${MESES[+m.slice(5, 7) - 1]}${ehMes ? ' (toque num dia para corrigir)' : ''}</summary><div class="cal">${cal}</div></details></div>`;
  }

  /* página da pessoa: app = elemento, chamar(corpo) -> resposta da API ({perfil, tarefas, rotinas}) */
  async function pagina(app, chamar, titulo) {
    if (!document.getElementById('lbmcss')) { const st = document.createElement('style'); st.id = 'lbmcss'; st.textContent = CSS; document.head.appendChild(st); }
    let r = await chamar({ acao: 'minhas_tarefas' });
    const ST = { P: r.perfil, T: r.tarefas || [], R: r.rotinas || [] };
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
      document.title = P.nome + ' · ' + titulo;
      app.innerHTML = `<h1>${esc(P.nome)}</h1><p class="fn">${esc(P.funcao || '')}</p>
    ${P.meta ? `<div class="meta"><span>Minha meta</span>${esc(P.meta)}</div>` : ''}
    ${R.length ? `<h3>Metas de ${MESES[+MES.slice(5, 7) - 1]}</h3><div class="list">${R.map(x => cardRot(x, HJ)).join('')}</div>` : ''}
    ${rAnt.length ? `<details><summary>Resultado de ${MESES[ant.getMonth()]}</summary><div class="list">${rAnt.map(x => cardRot(x, HJ, MA)).join('')}</div></details>` : ''}
    <div class="res"><div>A fazer<b>${ab.length}</b></div><div>Atrasadas<b style="${ab.some(t => t.prazo && t.prazo < HJ) ? 'color:var(--neg)' : ''}">${ab.filter(t => t.prazo && t.prazo < HJ).length}</b></div><div>Feitas no mês<b style="color:var(--pos)">${okm.length}</b></div></div>
    <h3>Tarefas em aberto</h3>${!ab.length ? '<div class="empty">Nada pendente. 👏</div>' : comCat
          ? grupos.map(([c, l]) => `<details class="cat" open><summary>${esc(c || 'Outras')} <small>${l.length}</small></summary><div class="list">${l.map(t => card(t, HJ)).join('')}</div></details>`).join('')
          : `<div class="list">${ab.map(t => card(t, HJ)).join('')}</div>`}
    ${ok.length ? `<details${ok.length <= 3 ? ' open' : ''}><summary>Concluídas (${ok.length})</summary><div class="list">${ok.slice(0, 30).map(t => card(t, HJ)).join('')}</div></details>` : ''}`;
    }
    app.addEventListener('click', async e => {
      const b = e.target.closest('[data-id],[data-rid]'); if (!b) return; b.disabled = true; const txt = b.textContent; b.textContent = b.classList.contains('rk') || b.dataset.id ? 'salvando…' : '…';
      try {
        r = b.dataset.rid ? await chamar({ acao: 'marcar_rotina', id: b.dataset.rid, data: b.dataset.rd, on: b.dataset.on === '1' })
          : await chamar({ acao: 'marcar_tarefa', id: b.dataset.id, status: b.dataset.s });
        ST.P = r.perfil; ST.T = r.tarefas || []; ST.R = r.rotinas || []; render();
      } catch (err) { b.textContent = b.dataset.id || b.classList.contains('rk') ? 'não salvou, tente de novo' : txt; b.disabled = false; }
    });
    render();
  }
  window.LBROT = { pct, checks, diasMes, porCat, FREQ, MESES, pagina, P100, cor };
})();
