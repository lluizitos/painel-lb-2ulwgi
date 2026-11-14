/* Análise de vendas LB — usada na página Vendas e na aba Vendas do painel.
   LBV.analise(el, shows, {hoje, conf, aliases}) monta: números, comparação com o ano passado, crescimento,
   círculo de vendas (por vendedor) e contratantes (quem parou de contratar). */
(function () {
  const brl = v => v == null || isNaN(v) ? '—' : (v < 0 ? '−' : '') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = v => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? null : n; };
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const nmes = k => MES[+k.slice(5, 7) - 1] + '/' + k.slice(2, 4);
  const addM = (k, n) => { let y = +k.slice(0, 4), m = +k.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + String(m + 1).padStart(2, '0'); };
  const pct = (a, b) => b ? Math.round((a - b) / b * 100) : null;
  const norm = u => String(u || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const GENERICOS = ['', 'bilheteria (show próprio)'];
  const PAL = ['#CF1D51', '#F2B66B', '#7FDDA9', '#8FB8FF', '#C59BFF', '#FF8FA8', '#B8B3C3'];

  const CSS = `.lbv .k4{display:grid;gap:10px;grid-template-columns:repeat(4,minmax(0,1fr))}@media(max-width:720px){.lbv .k4{grid-template-columns:repeat(2,minmax(0,1fr))}}
.lbv .kc{background:var(--card);border-radius:14px;padding:14px 16px;position:relative;overflow:hidden}
.lbv .kc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pink)}
.lbv .kc .l{font-size:10.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--sub)}
.lbv .kc .v{font-size:21px;font-weight:800;margin-top:4px;white-space:nowrap}.lbv .kc .s{font-size:12px;color:var(--muted)}
.lbv h3{font-size:11px;font-weight:700;letter-spacing:.26em;text-transform:uppercase;color:var(--pinkl);margin:24px 0 10px}
.lbv h3 small{letter-spacing:.04em;text-transform:none;color:var(--muted);font-weight:400;font-size:12px;margin-left:6px}
.lbv .box{background:var(--card);border-radius:14px;padding:12px 14px}
.lbv table{width:100%;border-collapse:collapse;font-size:13.5px}.lbv th{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);font-weight:700;text-align:right;padding:6px 4px}
.lbv th:first-child,.lbv td:first-child{text-align:left}.lbv td{padding:8px 4px;border-top:1px solid var(--line);text-align:right;white-space:nowrap}
.lbv td small{display:block;color:var(--muted);font-size:11px}
.lbv .up{color:var(--pos)}.lbv .dn{color:var(--neg)}.lbv .mu{color:var(--muted)}
.lbv .ch svg{display:block;width:100%;max-width:620px;height:auto;margin:0 auto}.lbv .lg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--sub);margin:2px 0 6px}
.lbv .lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
.lbv .tp{font-size:12.5px;color:var(--sub);min-height:20px;margin-top:4px}
.lbv .circ{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:center}@media(max-width:480px){.lbv .circ{grid-template-columns:1fr}.lbv .circ svg{max-width:170px;margin:0 auto}}
.lbv .rk{display:flex;flex-direction:column;gap:8px}.lbv .rk .it{display:flex;gap:10px;align-items:center}
.lbv .rk .it i{flex:none;width:12px;height:12px;border-radius:4px}.lbv .rk .it .n{flex:1;min-width:0}.lbv .rk .it .n b{display:block;font-size:14px}
.lbv .rk .it .n span{font-size:12px;color:var(--muted)}.lbv .rk .it .vv{text-align:right;font-weight:700;white-space:nowrap}.lbv .rk .it .vv small{display:block;font-weight:400;font-size:11px;color:var(--muted)}
.lbv .ct{display:flex;flex-direction:column;gap:8px}.lbv .ct .r{background:var(--card);border-radius:12px;padding:10px 14px;display:flex;gap:10px;justify-content:space-between;align-items:center}
.lbv .ct .r b{display:block;font-size:14px;overflow-wrap:anywhere}.lbv .ct .r span{font-size:12px;color:var(--muted)}.lbv .ct .r .vv{text-align:right;white-space:nowrap;font-weight:700}
.lbv .ct .r .vv small{display:block;font-weight:400;font-size:11px;color:var(--muted)}
.lbv .nt{color:var(--muted);font-size:12.5px;margin:8px 0 0}
.lbv .tabs2{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.lbv .tabs2 button{border:1px solid var(--line);background:transparent;border-radius:99px;padding:6px 12px;font-size:12.5px;color:var(--sub)}
.lbv .tabs2 button.on{background:var(--card2);color:var(--ink);border-color:var(--sub)}`;

  function analise(el, shows, opt) {
    opt = opt || {};
    if (!document.getElementById('lbvcss')) { const st = document.createElement('style'); st.id = 'lbvcss'; st.textContent = CSS; document.head.appendChild(st); }
    const HOJE = opt.hoje || new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const MESAT = HOJE.slice(0, 7), ANO = HOJE.slice(0, 4), ANOP = String(+ANO - 1);
    const conf = opt.conf || {};
    const ok = shows.filter(s => s.status !== 'Cancelado');
    const val = s => num(s.valor) || 0;
    const real = ok.filter(s => s.data < HOJE);
    const fut = ok.filter(s => s.data >= HOJE);
    const ini = ok.length ? ok.map(s => s.data.slice(0, 7)).sort()[0] : MESAT;

    // por mês
    const pm = {};
    ok.forEach(s => { const k = s.data.slice(0, 7); const m = pm[k] = pm[k] || { n: 0, r: 0, f: 0, v: 0, vr: 0, cv: 0 }; m.n++; m.v += val(s); if (s.data < HOJE) { m.r++; m.vr += val(s); } else m.f++; if (val(s)) m.cv++; });

    // ---- números
    const ano = ok.filter(s => s.data.slice(0, 4) === ANO);
    const realAno = ano.filter(s => s.data < HOJE);
    const comV = real.filter(s => val(s) > 0);
    const ult12 = comV.filter(s => s.data >= addM(MESAT, -12) + '-01');
    const mediaCache = ult12.length ? ult12.reduce((a, s) => a + val(s), 0) / ult12.length : null;
    const nMesesAno = +MESAT.slice(5, 7);
    const mediaMes = realAno.length / Math.max(1, nMesesAno - (HOJE.slice(8, 10) < '15' ? 1 : 0) || 1);
    const futV = fut.reduce((a, s) => a + val(s), 0), futSemV = fut.filter(s => !val(s)).length;
    const kc = (l, v, s) => `<div class="kc"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
    let h = `<div class="k4">` +
      kc('Shows em ' + ANO, ano.length, `${realAno.length} feitos · ${ano.length - realAno.length} marcados`) +
      kc('Cachê médio', brl(mediaCache), `últimos 12 meses (${ult12.length} shows)`) +
      kc('Shows por mês', mediaMes.toLocaleString('pt-BR', { maximumFractionDigits: 1 }), `média de ${ANO} (feitos)`) +
      kc('Já vendido', brl(futV), `${fut.length} shows daqui pra frente${futSemV ? ' · ' + futSemV + ' sem valor' : ''}`) + `</div>`;

    // ---- comparação com o ano passado (mesmos meses)
    const linhas = [];
    for (let m = 1; m <= 12; m++) {
      const k = ANO + '-' + String(m).padStart(2, '0'), kp = ANOP + '-' + String(m).padStart(2, '0');
      if (kp < ini) continue;
      const a = pm[k] || { n: 0, v: 0, r: 0 }, b = pm[kp] || { n: 0, v: 0 };
      linhas.push({ k, kp, a, b });
    }
    h += `<h3>Comparação com o ano passado <small>mesmo mês</small></h3>`;
    if (linhas.length) {
      const ta = linhas.reduce((x, l) => ({ n: x.n + l.a.n, v: x.v + l.a.v }), { n: 0, v: 0 }), tb = linhas.reduce((x, l) => ({ n: x.n + l.b.n, v: x.v + l.b.v }), { n: 0, v: 0 });
      const vr = (a, b) => { const p = pct(a, b); return p == null ? '<span class="mu">—</span>' : `<span class="${p >= 0 ? 'up' : 'dn'}">${p >= 0 ? '+' : ''}${p}%</span>`; };
      h += `<div class="box"><table><tr><th>Mês</th><th>${ANOP}</th><th>${ANO}</th><th>Variação</th></tr>` +
        linhas.map(l => `<tr><td>${MES[+l.k.slice(5) - 1]}${l.k >= MESAT ? ' <small>' + (l.k === MESAT ? 'em andamento' : 'já marcado') + '</small>' : ''}</td><td>${l.b.n} shows<small>${brl(l.b.v)}</small></td><td>${l.a.n} shows<small>${brl(l.a.v)}</small></td><td>${vr(l.a.n, l.b.n)}<small>${vr(l.a.v, l.b.v)} em R$</small></td></tr>`).join('') +
        (linhas.length > 1 ? `<tr><td><b>Total</b></td><td><b>${tb.n}</b><small>${brl(tb.v)}</small></td><td><b>${ta.n}</b><small>${brl(ta.v)}</small></td><td>${vr(ta.n, tb.n)}<small>${vr(ta.v, tb.v)} em R$</small></td></tr>` : '') +
        `</table></div><p class="nt">O histórico de shows começa em ${nmes(ini)}, então por enquanto só dá para comparar ${linhas.map(l => MES[+l.k.slice(5) - 1]).join(' e ')}. A cada mês novo a comparação cresce sozinha.</p>`;
    } else h += `<div class="box mu">Ainda não há shows do ano passado no histórico para comparar.</div>`;

    // ---- crescimento (gráfico de barras por mês)
    const fim = (() => { let f = addM(MESAT, 3); Object.keys(pm).forEach(k => { if (k > f && k <= addM(MESAT, 8)) f = k; }); return f; })();
    const ks = []; for (let k = ini; k <= fim; k = addM(k, 1)) ks.push(k);
    h += `<h3>Crescimento <small>shows por mês</small></h3><div class="box ch"><div class="lg"><span><i style="background:var(--pink)"></i>Feitos</span><span><i style="background:transparent;border:1.5px solid var(--pinkl)"></i>Marcados</span><span><i style="background:var(--amber);border-radius:99px;height:3px;vertical-align:3px"></i>Média de 3 meses</span></div>${barras(ks, pm, 'n')}<div class="tp" data-tp></div></div>`;
    h += `<h3>Faturamento <small>soma dos cachês por mês</small></h3><div class="box ch">${barras(ks, pm, 'v')}<div class="tp" data-tp></div></div>`;

    // ---- círculo de vendas (vendedores)
    const al = opt.aliases || {};
    const quem = s => { const n = (s.vendedor || '').trim(); if (!n) return 'Sem vendedor'; return al[norm(n)] || n; };
    const desde = ANO + '-01-01';
    const pv = {};
    ok.filter(s => s.data >= desde).forEach(s => { const q = quem(s); const x = pv[q] = pv[q] || { n: 0, v: 0, com: 0, semPct: 0, fut: 0 }; x.n++; x.v += val(s); if (s.data >= HOJE) x.fut++; const p = num(s.comissao_pct) ?? conf.comissao; if (p == null) x.semPct++; else x.com += val(s) * p / 100; });
    const rk = Object.entries(pv).sort((a, b) => b[1].v - a[1].v);
    const totV = rk.reduce((a, r) => a + r[1].v, 0) || 1;
    h += `<h3>Círculo de vendas <small>desde jan/${ANO.slice(2)}</small></h3><div class="box circ">${donut(rk.map(r => r[1].v), totV)}<div class="rk">` +
      rk.map((r, i) => `<div class="it"><i style="background:${r[0] === 'Sem vendedor' ? '#4A4654' : PAL[i % PAL.length]}"></i><div class="n"><b>${esc(r[0])}</b><span>${r[1].n} show${r[1].n > 1 ? 's' : ''} · ticket médio ${brl(r[1].v / r[1].n)}${r[1].fut ? ' · ' + r[1].fut + ' marcados' : ''}</span></div><div class="vv">${brl(r[1].v)}<small>${Math.round(r[1].v / totV * 100)}% · comissão ${r[1].semPct ? (r[1].com ? brl(r[1].com) + ' +' : '% a definir') : brl(r[1].com)}</small></div></div>`).join('') +
      `</div></div>` + (pv['Sem vendedor'] ? `<p class="nt">${pv['Sem vendedor'].n} shows ainda sem vendedor na ficha — é só editar o show e escolher quem vendeu para entrar no ranking e na comissão.</p>` : '');

    // ---- contratantes
    const pc = {};
    ok.forEach(s => { const c = (s.contratante || '').trim(); if (GENERICOS.includes(norm(c))) return; const x = pc[c] = pc[c] || { n: 0, v: 0, ult: null, prox: null, cid: s.cidade }; x.n++; x.v += val(s); if (s.data < HOJE) { if (!x.ult || s.data > x.ult) x.ult = s.data; } else if (!x.prox || s.data < x.prox) x.prox = s.data; });
    const dias = d => Math.round((new Date(HOJE) - new Date(d)) / 864e5);
    const cts = Object.entries(pc);
    const parou = cts.filter(([, x]) => !x.prox && x.ult && dias(x.ult) > 120).sort((a, b) => b[1].v - a[1].v);
    const voltam = cts.filter(([, x]) => x.n > 1).sort((a, b) => b[1].n - a[1].n || b[1].v - a[1].v);
    const marc = cts.filter(([, x]) => x.prox).sort((a, b) => a[1].prox.localeCompare(b[1].prox));
    const semC = ok.filter(s => GENERICOS.includes(norm(s.contratante)) && !/próprio/i.test(s.tipo || '') && norm(s.contratante) !== 'bilheteria (show próprio)').length;
    const fd = d => d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(2, 4) : '';
    const rc = ([n, x], extra) => `<div class="r"><div><b>${esc(n)}</b><span>${esc(x.cid || '')} · ${x.n} show${x.n > 1 ? 's' : ''}${extra(x)}</span></div><div class="vv">${brl(x.v)}<small>no total</small></div></div>`;
    const grupos = {
      parou: [parou, x => ' · último em ' + fd(x.ult) + ' (' + Math.round(dias(x.ult) / 30) + ' meses)', 'Ninguém parado há mais de 4 meses.'],
      voltam: [voltam, x => (x.prox ? ' · próximo ' + fd(x.prox) : ' · último ' + fd(x.ult)), 'Nenhum contratante repetiu ainda.'],
      marc: [marc, x => ' · próximo ' + fd(x.prox), 'Nenhum show marcado com contratante identificado.']
    };
    h += `<h3>Contratantes <small>${cts.length} identificados</small></h3><div class="tabs2" data-ct><button class="on" data-g="parou">Pararam de contratar (${parou.length})</button><button data-g="voltam">Contrataram mais de uma vez (${voltam.length})</button><button data-g="marc">Com show marcado (${marc.length})</button></div><div class="ct" data-ctl></div>` +
      `<p class="nt">"Parou" = último show há mais de 4 meses e nada marcado. O contratante vem de quem pagou o cachê no extrato; ${semC} shows ainda estão sem contratante na ficha.</p>`;

    el.innerHTML = `<div class="lbv">${h}</div>`;
    const ctl = el.querySelector('[data-ctl]');
    const mostra = g => { const [l, ex, vazio] = grupos[g]; ctl.innerHTML = l.length ? l.slice(0, 30).map(e => rc(e, ex)).join('') : `<div class="r mu">${vazio}</div>`; };
    mostra('parou');
    el.querySelector('[data-ct]').onclick = e => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('[data-ct] button').forEach(x => x.classList.toggle('on', x === b)); mostra(b.dataset.g); };
    el.querySelectorAll('.ch').forEach(box => {
      const tp = box.querySelector('[data-tp]'); if (!tp) return;
      box.querySelectorAll('[data-k]').forEach(r => r.addEventListener('click', () => {
        const k = r.dataset.k, m = pm[k] || { n: 0, r: 0, f: 0, v: 0 };
        box.querySelectorAll('[data-k]').forEach(x => x.style.opacity = x === r ? '.18' : '0');
        tp.innerHTML = `<b>${nmes(k)}</b> · ${m.n} show${m.n === 1 ? '' : 's'} (${m.r} feitos, ${m.f} marcados) · cachês ${brl(m.v)}`;
      }));
    });
    function barras(ks, pm, campo) {
      const W = 360, H = 170, pl = 8, pr = 8, pt = 14, pb = 26, cw = (W - pl - pr) / ks.length, bw = Math.max(4, cw * .62);
      const vals = ks.map(k => (pm[k] || {})[campo] || 0), mx = Math.max(1, ...vals);
      const y = v => pt + (H - pt - pb) * (1 - v / mx);
      let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
      ks.forEach((k, i) => {
        const m = pm[k] || { n: 0, r: 0, v: 0, vr: 0 }, x = pl + i * cw + (cw - bw) / 2;
        const feito = campo === 'n' ? m.r : m.vr, tot = m[campo] || 0;
        if (tot) {
          s += `<rect x="${x}" y="${y(tot)}" width="${bw}" height="${y(0) - y(tot)}" rx="3" fill="none" stroke="#F0507E" stroke-width="1.3"/>`;
          if (feito) s += `<rect x="${x}" y="${y(feito)}" width="${bw}" height="${y(0) - y(feito)}" rx="3" fill="#CF1D51"/>`;
          if (campo === 'n') s += `<text x="${x + bw / 2}" y="${y(tot) - 4}" text-anchor="middle" font-size="9.5" fill="#B8B3C3">${tot}</text>`;
        }
        if (k === MESAT) s += `<rect x="${pl + i * cw}" y="${pt - 10}" width="${cw}" height="${H - pt - pb + 10}" fill="#F3F1F6" opacity=".05"/>`;
        if (ks.length <= 14 || i % 2 === 0 || k === MESAT) s += `<text x="${x + bw / 2}" y="${H - 12}" text-anchor="middle" font-size="9" fill="${k === MESAT ? '#F0507E' : '#8B8697'}">${MES[+k.slice(5) - 1]}</text>`;
        if (k.slice(5) === '01' || i === 0) s += `<text x="${x + bw / 2}" y="${H - 2}" text-anchor="middle" font-size="8" fill="#8B8697">${k.slice(0, 4)}</text>`;
        s += `<rect data-k="${k}" x="${pl + i * cw}" y="0" width="${cw}" height="${H}" fill="#F3F1F6" opacity="0" style="cursor:pointer"/>`;
      });
      if (campo === 'n') { // média de 3 meses (só meses já passados ou o atual)
        const pts = []; ks.forEach((k, i) => { if (k > MESAT) return; const j = [k, addM(k, -1), addM(k, -2)].filter(q => q >= ini); const md = j.reduce((a, q) => a + ((pm[q] || {}).n || 0), 0) / j.length; pts.push(`${pl + i * cw + cw / 2},${y(md)}`); });
        if (pts.length > 1) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#F2B66B" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      s += `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" stroke="#2E2B36"/></svg>`;
      return s;
    }
    function donut(vs, tot) {
      const R = 60, r = 38, c = 75; let a0 = -Math.PI / 2, s = `<svg viewBox="0 0 150 150">`;
      if (vs.length === 1) return s + `<circle cx="${c}" cy="${c}" r="${(R + r) / 2}" fill="none" stroke="${rk[0][0] === 'Sem vendedor' ? '#4A4654' : PAL[0]}" stroke-width="${R - r}"/><text x="75" y="80" text-anchor="middle" font-size="15" font-weight="800" fill="#F3F1F6">${rk[0][1].n}</text></svg>`;
      vs.forEach((v, i) => {
        const a1 = a0 + 2 * Math.PI * v / tot, g = a1 - a0 > Math.PI ? 1 : 0;
        const p = (rad, ang) => `${c + rad * Math.cos(ang)},${c + rad * Math.sin(ang)}`;
        s += `<path d="M${p(R, a0)} A${R},${R} 0 ${g} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${g} 0 ${p(r, a0)} Z" fill="${rk[i][0] === 'Sem vendedor' ? '#4A4654' : PAL[i % PAL.length]}" stroke="#1E1C24" stroke-width="1.5"/>`;
        a0 = a1;
      });
      return s + `<text x="75" y="74" text-anchor="middle" font-size="16" font-weight="800" fill="#F3F1F6">${ok.filter(s => s.data >= desde).length}</text><text x="75" y="90" text-anchor="middle" font-size="9" fill="#8B8697">shows</text></svg>`;
    }
  }
  window.LBV = { analise, brl, esc, num };
})();
