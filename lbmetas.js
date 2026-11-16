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
  /* andamento de uma tarefa: [{d, tp, tx, q, ag, por}] */
  const ANDT = { executando: ['▶', 'Executando', 'ex', 'ex.: comecei a ligar para as oficinas'], aguardando: ['⏳', 'Aguardando', 'ag', 'ex.: falei com ele, vai ver a agenda e me retorna'],
    agendado: ['📅', 'Agendado', 'gd', 'ex.: levar o ônibus na oficina às 8h'], travado: ['🧱', 'Travou', 'tv', 'ex.: a oficina não tem a peça; preciso de ajuda'] };
  function andL(t) { try { return JSON.parse((t && t.andamento) || '[]') || []; } catch (e) { return []; } }
  const dm2 = d => String(d || '').slice(8, 10) + '/' + String(d || '').slice(5, 7);
  function andTit(a) { return a.tp === 'aguardando' ? 'Aguardando' + (a.q ? ' ' + a.q : '') : a.tp === 'agendado' ? 'Agendado para ' + dm2(a.ag) : (ANDT[a.tp] || ANDT.executando)[1]; }
  function andTxt(t) { const L = andL(t); if (!L.length) return ''; const a = L[L.length - 1]; return (ANDT[a.tp] || ANDT.executando)[0] + ' ' + andTit(a) + (a.tx ? ': ' + a.tx : ''); }
  const agendaDe = (t, d) => t.status !== 'Concluída' && andL(t).some(a => a.tp === 'agendado' && a.ag === d);
  /* popup de baixo (celular) / centro (computador) */
  function popup(titulo, html) {
    css(); const box = document.createElement('div'); box.className = 'lbpop';
    box.innerHTML = `<div class="lbpc" role="dialog" aria-modal="true" aria-label="${String(titulo).replace(/"/g, '')}"><div class="lbph"><b>${titulo}</b><button data-px aria-label="fechar">✕</button></div>${html}</div>`;
    const fecha = () => { box.remove(); document.removeEventListener('keydown', k); }, k = e => { if (e.key === 'Escape') fecha(); };
    document.addEventListener('keydown', k); box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-px]')) fecha(); });
    document.body.appendChild(box); box.querySelector('[data-px]').focus(); box.fecha = fecha; return box;
  }
  function checks(r) { try { return JSON.parse(r.checks || '[]') || []; } catch (e) { return []; } }
  function notas(r) { try { return JSON.parse(r.notas || '{}') || {}; } catch (e) { return {}; } }
  const ini = r => { const c = checks(r).slice().sort()[0]; return r.inicio && c && c < r.inicio ? c : (r.inicio || ''); };
  const dentro = (r, d) => (!ini(r) || d >= ini(r)) && (!r.fim || d <= r.fim);
  const ehJ = t => String(t || '').startsWith('✗');
  const justs = r => { const nt = notas(r), ck = new Set(checks(r)); return new Set(Object.keys(nt).filter(d => ehJ(nt[d]) && !ck.has(d))); };
  const valeNoDia = (r, d) => dentro(r, d) && (r.freq !== 'util' || dow(d) % 6 !== 0);
  const alvo = r => Math.max(1, +r.alvo || 1);
  const naSemana = (r, w) => checks(r).filter(d => d >= w && d <= soma(w, 6)).length;
  /* resultado do mês m: feitos, total do mês, esperado até hoje, % do mês e % até hoje (ritmo) */
  function pct(r, m, hj) {
    hj = hj || hoje(); const ck = checks(r).filter(d => d.startsWith(m)), J = justs(r);
    if (r.freq === 'mes') {
      const al = Math.max(0, alvo(r) - [...J].filter(d => d.startsWith(m)).length), dm = diasMes(m), passou = m < hj.slice(0, 7) ? 1 : m > hj.slice(0, 7) ? 0 : (+hj.slice(8, 10)) / dm.length;
      const ate = al ? Math.max(1, Math.round(al * passou)) : 0;
      return { feitos: ck.length, total: al, ate, pct: al ? Math.min(1, ck.length / al) : 1, ritmo: ate ? Math.min(1, ck.length / ate) : 1, just: J.size };
    }
    if (r.freq === 'semana') { // semanas que começam (segunda) no mês
      const al = alvo(r), ws = diasMes(m).filter(d => dow(d) === 1 && soma(d, 6) >= ini(r) && (!r.fim || d <= r.fim));
      let f = 0, ate = 0, fa = 0, tot = 0;
      ws.forEach(w => { const n = Math.min(al, naSemana(r, w)), jw = n < al && [...J].some(d => d >= w && d <= soma(w, 6)); f += n; tot += jw ? n : al; if (soma(w, 6) < hj) { ate += jw ? n : al; fa += n; } else if (w <= hj && n) { ate += n; fa += n; } });
      return { feitos: f, total: tot, ate, pct: tot ? f / tot : 1, ritmo: ate ? fa / ate : null, semanas: ws.length, just: [...J].filter(d => d.startsWith(m)).length };
    }
    const ds = diasMes(m).filter(d => valeNoDia(r, d) && !J.has(d)), set = new Set(ck), f = ds.filter(d => set.has(d)).length;
    const ate = ds.filter(d => d < hj || (d === hj && set.has(d))).length;
    return { feitos: f, total: ds.length, ate, pct: ds.length ? f / ds.length : 0, ritmo: ate ? f / ate : (f ? 1 : 0), just: [...J].filter(d => d.startsWith(m)).length };
  }
  /* o que falta marcar agora (hoje / esta semana / ritmo do mês) */
  function pend(r, hj) {
    hj = hj || hoje(); if (r.ativo === 'não' || (!dentro(r, hj) && r.freq !== 'semana')) return null;
    if (r.freq === 'dia' || r.freq === 'util') return valeNoDia(r, hj) && !checks(r).includes(hj) && !justs(r).has(hj) ? 'hoje' : null;
    if (r.freq === 'semana') { const w = seg(hj), n = naSemana(r, w); if (n < alvo(r) && [...justs(r)].some(d => d >= w && d <= soma(w, 6))) return null; if ((r.inicio && soma(w, 6) < r.inicio) || (r.fim && w > r.fim)) return null;
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
.rcal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:10px}.rcal span{font-size:10px;color:var(--muted);text-align:center}
.rcal button{aspect-ratio:1;border:1px solid var(--line);background:transparent;border-radius:8px;font-size:11px;color:var(--sub);padding:0;position:relative;cursor:pointer}
.rcal button.ok{background:var(--pos);border-color:var(--pos);color:#141218;font-weight:700}.rcal button.fx{border-color:rgba(255,143,168,.45);color:var(--neg)}
.rcal button.nt::after{content:'';position:absolute;top:3px;right:3px;width:5px;height:5px;border-radius:9px;background:#141218;opacity:.55}
.rcal button.js{background:rgba(245,196,81,.18);border-color:#F5C451;color:#F5C451;font-weight:700}.jtx{font-style:normal;color:#F5C451;font-weight:700}.tj{margin-top:6px;font-size:13px;color:var(--sub);overflow-wrap:anywhere}.bt.jbt{color:#F5C451;border-color:rgba(245,196,81,.45)}
.rkj{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.rkj button{border:1px solid var(--line);background:transparent;color:var(--sub);border-radius:99px;padding:6px 10px;font-size:12.5px;cursor:pointer}.rkj button.on{border-color:#F5C451;color:#F5C451}.rkf .rkb .jb{color:#F5C451;border-color:rgba(245,196,81,.5)}
.rcal button.hj{outline:2px solid var(--pinkl);outline-offset:1px}.rcal button:disabled{opacity:.3;cursor:default}.rcal button.na{visibility:hidden}
.rlg{margin-top:10px;font-size:12.5px}.rlg div{display:flex;gap:8px;padding:5px 0;border-top:1px solid var(--line)}.rlg div b{flex:none;width:40px;color:var(--sub)}.rlg div span{flex:1;min-width:0;word-break:break-word}
.alr{background:linear-gradient(135deg,rgba(225,29,72,.18),rgba(225,29,72,.06));border:1px solid rgba(240,80,126,.45);border-radius:14px;padding:12px 14px;margin:14px 0}
.alr>b{display:block;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--pinkl);margin-bottom:6px}
.alr button{display:flex;justify-content:space-between;gap:10px;width:100%;margin-top:6px;border:0;background:var(--card);color:inherit;border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;font-weight:600;text-align:left;cursor:pointer}.alr button small{color:var(--pinkl);font-weight:700;white-space:nowrap}
.alrok{font-size:13px;color:var(--pos);background:rgba(127,221,169,.08);border-radius:12px;padding:9px 12px;margin:14px 0}
.cat summary{list-style:none;display:flex;gap:8px;align-items:center;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--sub);margin:16px 2px 8px}
.nv{display:flex;gap:8px;margin:18px 0 4px}.nv button{flex:1;border:1px dashed var(--line);background:transparent;color:var(--sub);border-radius:12px;padding:11px;font:inherit;font-size:14px;font-weight:700;cursor:pointer}.nv button.on{border-style:solid;border-color:var(--pinkl);color:var(--pinkl)}
.nvf{background:var(--card);border-radius:14px;padding:14px;margin-top:8px}.nvf label{display:block;font-size:12px;color:var(--muted);margin:10px 0 4px}.nvf label:first-child{margin-top:0}
.nvf input,.nvf select,.nvf textarea{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;background:var(--bg,#141218);color:inherit;font:inherit;font-size:15px;padding:9px}.nvf textarea{min-height:60px}
.nvf .rkb{display:flex;gap:8px;margin-top:12px}.nvf .rkb button{flex:1;border:1px solid var(--line);background:transparent;color:inherit;border-radius:10px;padding:10px;font-weight:700;cursor:pointer}.nvf .rkb .ok{background:var(--pos);border-color:var(--pos);color:#141218}.nvf .msg{font-size:13px;color:var(--neg);margin-top:8px}
.pso{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--blue);margin-left:6px}.bt.del{color:var(--neg);border-color:rgba(255,143,168,.4)}
.hj0{background:linear-gradient(135deg,rgba(207,29,81,.16),rgba(207,29,81,.04));border:1px solid rgba(240,80,126,.35);border-radius:16px;padding:16px;margin:16px 0}
.hj0 h2{margin:0 0 4px;font-size:19px;line-height:1.3}.hj0 p{margin:12px 0 4px;font-size:15.5px;line-height:1.5}.hj0 ul{margin:0;padding-left:20px}.hj0 li{margin:5px 0;font-size:15px;line-height:1.45}.hj0 li small{color:var(--muted);font-size:13px}
.hjr{display:flex;justify-content:space-around;gap:6px;margin:12px 0 4px}.hja{text-align:center;flex:1;min-width:0}.hja svg{width:66px;height:66px;display:block;margin:0 auto}.hja text{fill:var(--ink);font-size:14px;font-weight:700}.hja b{display:block;font-size:13px;margin-top:2px}.hja small{display:block;font-size:11px;color:var(--muted)}
.hjg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0 8px}.hjn{background:rgba(255,255,255,.05);border-radius:12px;padding:8px 4px;text-align:center}.hjn b{display:block;font-size:22px;line-height:1.1}.hjn small{display:block;font-size:11px;color:var(--sub);line-height:1.2;margin-top:2px}.hjn.z{opacity:.45}
.hjcs{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0}.hjc{font-size:12.5px;border-radius:99px;padding:3px 10px;background:rgba(255,255,255,.07);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hjc.a{background:rgba(255,92,92,.16);color:#ffb3b3}.hjc.h{background:rgba(240,80,126,.18)}
.hjw{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;align-items:end;margin-top:12px;height:78px}.hjw div{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}.hjw i{width:60%;max-width:22px;background:var(--pinkl);border-radius:5px 5px 2px 2px;opacity:.8}.hjw .h i{opacity:1}.hjw b{font-size:11px;min-height:13px}.hjw small{font-size:10.5px;color:var(--muted)}.hjw .h small{color:var(--ink);font-weight:700}
.hj0 .neg,.lbpc .neg{color:var(--neg);font-weight:700}.lbpc .pos{color:var(--pos);font-weight:700}.alr.alrin{background:none;border:0;padding:0;margin:4px 0 0}.pso.rec{color:#F5C451}
.gch{background:var(--card);border-radius:14px;padding:14px;margin-top:10px}.gch>b{font-size:13.5px;color:var(--sub)}.gn{font-size:11.5px;color:var(--muted);margin:6px 0 0}
.gb{display:flex;gap:8px;height:150px;margin-top:10px}.gb>div{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:4px}.gb span{font-size:11.5px;font-weight:700;color:var(--sub);min-height:15px}.gb small{font-size:11px;color:var(--muted)}
.gbw{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}.gbw i{display:flex;flex-direction:column;width:100%;max-width:36px;border-radius:6px 6px 2px 2px;overflow:hidden}.gbw i u{display:block;min-height:0}
.ghl{display:flex;align-items:center;gap:8px;margin-top:9px;font-size:13.5px}.ghl span{flex:0 0 40%;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ghl i{flex:1;height:8px;background:var(--card2);border-radius:99px;overflow:hidden}.ghl i u{display:block;height:100%;border-radius:99px}.ghl b{width:42px;text-align:right;font-size:13px}
.urgs{display:flex;flex-direction:column;gap:8px;margin:14px 0 4px}.urgh{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:15px;color:var(--ink)}.urgh button{background:none;border:1px solid var(--line);border-radius:99px;padding:6px 14px;font:inherit;font-size:13.5px;color:var(--sub);cursor:pointer;flex:none}.urg{display:flex;gap:10px;align-items:center;width:100%;text-align:left;font:inherit;color:var(--ink);background:rgba(255,143,168,.1);border:1px solid rgba(255,143,168,.5);border-radius:14px;padding:12px 14px;cursor:pointer;animation:lbpisca 1.4s ease-in-out infinite}.urg svg{flex:none;width:20px;height:20px;color:var(--neg)}.urg span{font-size:14.5px;font-weight:600}.urg small{display:block;font-size:12.5px;font-weight:400;color:var(--neg);margin-top:2px}@keyframes lbpisca{0%,100%{border-color:rgba(255,143,168,.5)}50%{border-color:var(--neg);background:rgba(255,143,168,.2)}}@media (prefers-reduced-motion:reduce){.urg{animation:none}}
.lbcb{display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap}.lbcb b{flex:1;font-size:15px;min-width:130px}.lbcb .nvb{border:1px solid var(--line);background:var(--card2);color:var(--ink);border-radius:99px;min-width:34px;height:34px;padding:0 10px;font-size:14px;cursor:pointer;font-family:inherit}.lbseg{display:inline-flex;border:1px solid var(--line);border-radius:99px;overflow:hidden}.lbseg button{border:0;background:none;color:var(--muted);font:inherit;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:7px 11px;cursor:pointer}.lbseg button.on{background:var(--card2);color:var(--ink)}.cfl{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}.cfl button{border:1px solid var(--line);background:var(--card2);color:var(--ink);border-radius:99px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}.cfl button.off{opacity:.45;text-decoration:line-through}.cfl em{display:inline-block;width:8px;height:8px;border-radius:3px}
.ldia>.dh{display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:14px 2px 6px;cursor:pointer;background:none;border:0;width:100%;padding:0;font-family:inherit}.ldia>.dh.hj{color:var(--pinkl)}.lev{display:flex;gap:10px;align-items:center;width:100%;text-align:left;font:inherit;color:var(--ink);background:var(--card2);border:0;border-radius:12px;padding:10px 12px;margin-bottom:6px;cursor:pointer}.lev>em{flex:none;width:4px;align-self:stretch;border-radius:4px}.lev .t{flex:1;min-width:0}.lev .t b{display:block;font-size:14px;font-weight:600}.lev .t span{font-size:12px;color:var(--muted)}.lev.fe .t b{text-decoration:line-through;color:var(--muted)}.lvz{color:var(--muted);font-size:13px;text-align:center;padding:16px}.pt-m{background:#F2B66B}
.lbc{background:var(--card);border-radius:14px;padding:10px}.lbch{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.lbch b{font-size:15px;text-transform:capitalize}.lbch button{border:1px solid var(--line);background:var(--card2);color:var(--ink);border-radius:10px;width:40px;height:36px;font-size:18px;cursor:pointer}
.lbc .cw,.lbc .cg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}.lbc .cw span{text-align:center;font-size:10.5px;color:var(--muted);font-weight:700;padding-bottom:4px}
.lbc .cd{min-height:70px;min-width:0;border:0;border-top:1px solid var(--line);border-radius:6px;background:none;color:var(--sub);display:flex;flex-direction:column;align-items:stretch;gap:2px;cursor:pointer;padding:4px 2px 3px;font:inherit;overflow:hidden}.lbc .cd>b{align-self:center;font-size:13px;font-weight:600}.lbc .cd:hover{background:var(--card2)}
.lbc .cd.hj>b{color:#fff;background:var(--pink);border-radius:99px;padding:1px 6px}
.lbc .ce{display:block;font-style:normal;font-size:9.5px;line-height:1.3;font-weight:700;padding:1px 4px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left;color:#141218}.lbc .ce.fe{opacity:.5;text-decoration:line-through}.lbc .cm{font-style:normal;font-size:9.5px;color:var(--muted);text-align:left;padding-left:4px}
.lbc .dts{display:flex;gap:4px;justify-content:center;margin-top:auto}.lbc .dts em{font-style:normal;font-size:10px;font-weight:700}.dk{color:var(--pos)}.dx{color:var(--neg)}
.gq{background:var(--card);border-radius:12px;padding:10px 14px;margin:10px 0;font-size:13px;color:var(--sub)}.gq summary{cursor:pointer;color:var(--pinkl,#F0507E);font-weight:600}.gq p{margin:8px 0;line-height:1.5}.gq .pdl{border-top:1px solid var(--line);padding:8px 0}.gq .pdl b{display:block;color:var(--ink)}.gq .pdl small{display:block;color:var(--muted)}
.pt-g{background:#F5C451}.pt-sh{background:#9B8CFF}.ce.pt-sh{color:#fff}.pt-t{background:#7AB8FF}
.an{margin-top:10px;border-radius:12px;padding:10px 12px;background:rgba(255,255,255,.04);border:1px solid var(--line)}.an-ex{--ac:var(--pinkl)}.an-ag{--ac:#F5C451}.an-gd{--ac:#7AB8FF}.an-tv{--ac:var(--neg)}
.an{border-left:3px solid var(--ac)}.anh{display:flex;gap:10px;align-items:flex-start}.ani{width:30px;height:30px;flex:none;border-radius:99px;display:grid;place-items:center;background:color-mix(in srgb,var(--ac) 18%,transparent);font-size:15px}
.anh b{display:block;font-size:14px;color:var(--ac)}.anh span{display:block;font-size:13.5px;color:var(--ink);margin-top:2px;overflow-wrap:anywhere}.anh small{display:block;font-size:11.5px;color:var(--muted);margin-top:3px}
.ans{display:flex;align-items:center;margin:10px 0 2px;padding-left:2px}.ans i{font-style:normal;width:22px;height:22px;flex:none;border-radius:99px;display:grid;place-items:center;font-size:11px;background:var(--card2);opacity:.55}.ans i.on{opacity:1;box-shadow:0 0 0 2px var(--ac)}.ans u{flex:1;height:2px;background:var(--line);min-width:6px;max-width:34px}
.anl{margin-top:8px}.anl summary{cursor:pointer;font-size:12.5px;color:var(--sub);list-style:none}.anl summary::-webkit-details-marker{display:none}.anl summary:before{content:'▸ '}.anl[open] summary:before{content:'▾ '}
.anl ol{list-style:none;margin:8px 0 0;padding:0 0 0 14px;border-left:2px solid var(--line)}.anl li{position:relative;padding:0 0 10px 10px}.anl li>i{position:absolute;left:-26px;top:0;font-style:normal;width:22px;height:22px;border-radius:99px;display:grid;place-items:center;font-size:11px;background:var(--card2)}
.anl li b{display:block;font-size:13px;color:var(--ac)}.anl li span{display:block;font-size:13px;overflow-wrap:anywhere}.anl li small{font-size:11px;color:var(--muted)}.anl li small a{color:var(--muted)}
.ant{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.ant button{border:1px solid var(--line);background:transparent;color:var(--sub);border-radius:99px;padding:7px 11px;font:inherit;font-size:13px;cursor:pointer}.ant button.on{border-color:var(--pinkl);color:var(--ink);background:rgba(240,80,126,.14);font-weight:700}
.anf input{width:100%;box-sizing:border-box;margin-top:6px;border:1px solid var(--line);border-radius:10px;background:var(--bg,#141218);color:inherit;font:inherit;font-size:14px;padding:9px 10px}.anf label{display:block;font-size:12.5px;color:var(--sub);margin-top:6px}
.bt.anb{color:#7AB8FF;border-color:rgba(122,184,255,.45)}.hjc.g{background:rgba(245,196,81,.16);color:#F5C451}.pt-a{background:var(--neg)}.pt-ok{background:var(--pos)}
.lbc .clg,.gch .clg{display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--muted);margin-top:8px}.clg em{display:inline-block;width:8px;height:8px;border-radius:3px;margin-right:4px}.clt{font-size:12px;color:var(--muted);margin:6px 0 0}
@media(min-width:700px){.lbc .cd{min-height:92px}.lbc .ce{font-size:11px;padding:2px 6px}}
.lbpop{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:60;display:flex;align-items:flex-end;justify-content:center}
.lbpc{background:var(--bg,#141218);color:var(--ink,#F3F1F6);border:1px solid var(--line);border-radius:18px 18px 0 0;width:100%;max-width:520px;max-height:82vh;overflow:auto;padding:16px 16px 26px;box-sizing:border-box}
@media(min-width:600px){.lbpop{align-items:center}.lbpc{border-radius:18px}}
.lbph{display:flex;justify-content:space-between;align-items:center;gap:10px}.lbph b{font-size:17px}.lbph button{border:0;background:var(--card2);color:var(--ink,#fff);border-radius:99px;width:36px;height:36px;font-size:15px;cursor:pointer;flex:none}
.lbpc h4{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--pinkl);margin:16px 0 6px}
.pdl{background:var(--card);border-radius:12px;padding:10px 12px;margin-top:6px}.pdl b{display:block;font-size:15px}.pdl small{display:block;font-size:13px;color:var(--sub);margin-top:2px}.pdl .bt{margin-top:8px}
.tf .pz a{color:var(--pinkl)}.cdf{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}.cdf input{border:1px solid var(--line);border-radius:10px;background:var(--bg,#141218);color:inherit;font:inherit;padding:7px}
.cat summary::-webkit-details-marker{display:none}.cat summary small{color:var(--muted);letter-spacing:0}.cat summary::after{content:'▾';color:var(--muted);margin-left:auto}.cat:not([open]) summary::after{content:'▸'}`;
  function css() { if (!document.getElementById('lbmcss')) { const st = document.createElement('style'); st.id = 'lbmcss'; st.textContent = CSS; document.head.appendChild(st); } }

  /* cartão de uma meta. op.adm = Admin (qualquer dia do passado, sem limite de 40 dias) */
  function cardRot(r, hj, mesVer, op) {
    op = op || {}; const m = mesVer || hj.slice(0, 7), x = pct(r, m, hj), ck = checks(r), nt = notas(r), ehMes = m === hj.slice(0, 7);
    const nHj = ck.filter(d => d === hj).length, min = op.adm ? '2000-01-01' : soma(hj, -40);
    const ds = diasMes(m), pad = dow(ds[0]), sem = r.freq === 'semana';
    const cal = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<span>${d}</span>`).join('') + '<button class="na" disabled></button>'.repeat(pad) +
      ds.map(d => { const vale = sem || r.freq === 'mes' ? dentro(r, d) : valeNoDia(r, d), n = ck.filter(y => y === d).length, fut = d > hj, js = !n && ehJ(nt[d]),
        pode = !fut && d >= min && (vale || n || js || (d < (r.inicio || '') && (r.freq !== 'util' || dow(d) % 6 !== 0)));
        const c = n ? 'ok' : js ? 'js' : (vale && d < hj && (r.freq === 'dia' || r.freq === 'util') ? 'fx' : '');
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
    return `<div class="rt" id="rt-${esc(r.id)}"><div class="rh"><b>${esc(r.titulo)}${r.criado_por === 'próprio' && !op.adm ? '<span class="pso">minha</span>' : ''}</b><span class="rp" style="color:${cor(ehMes ? x.ritmo : x.pct)}">${P100(ehMes ? x.ritmo : x.pct)}</span></div>
      <div class="rs">${sub}${x.just ? ` · ${x.just} justificad${x.just > 1 ? 'os' : 'o'} (não conta contra)` : ''}${ehMes ? ` · ${P100(x.pct)} do mês inteiro` : ''}</div><div class="br"><i style="width:${Math.round(x.pct * 100)}%;background:${cor(ehMes ? x.ritmo : x.pct)}"></i></div>
      ${bt}<div class="rkx"></div>
      <details${ehMes && !op.adm ? '' : ' open'}><summary style="margin:10px 2px 0;font-size:12px">Calendário de ${MESES[+m.slice(5, 7) - 1]} (toque num dia para marcar ou corrigir)</summary><div class="rcal">${cal}</div>
      ${reg.length ? `<div class="rlg">${reg.map(d => `<div><b>${ddmm(d)}</b><span>${ehJ(nt[d]) && !ck.includes(d) ? `<em class="jtx">não feito · justificado</em> ${esc(String(nt[d]).replace(/^✗\s*/, ''))}` : esc(nt[d])}</span></div>`).join('')}</div>` : ''}${r.criado_por === 'próprio' && !op.adm && ehMes ? `<div class="bts"><button class="bt del" data-del="${esc(r.id)}" data-dt="meta">Apagar esta meta</button></div>` : ''}</details></div>`;
  }

  /* formulário rápido dentro do cartão: marcar (com justificativa), editar justificativa, desmarcar.
     box._rot() devolve a lista de metas atual; depois(resposta) redesenha. */
  function liga(box, chamar, depois) {
    box.addEventListener('click', async e => {
      const f = e.target.closest('[data-rf]'), a = e.target.closest('[data-rka]');
      if (f) {
        e.preventDefault(); const card = f.closest('.rt'), R = (box._rot ? box._rot() : []).find(x => x.id === f.dataset.rid); if (!card || !R) return;
        const d = f.dataset.rf, n = checks(R).filter(y => y === d).length, nt = notas(R)[d] || '', js = !n && ehJ(nt), novo = f.dataset.novo === '1' || !n, rid = esc(R.id);
        const motivos = ['Dependia de outra pessoa', 'Imprevisto', 'Viagem / show', 'Doença'];
        card.querySelector('.rkx').innerHTML = `<div class="rkf"><b>${js ? 'Justificado em ' + ddmm(d) : novo ? 'Marcar ' + (d === hoje() ? 'hoje' : ddmm(d)) : '✓ Marcado em ' + ddmm(d)}</b>
          <textarea placeholder="${novo ? 'O que foi feito? (link do post, assunto da reunião…) · ou, se não fez, o motivo' : 'O que foi feito?'}">${js ? esc(nt.replace(/^✗\s*/, '')) : novo && (R.freq === 'mes' || R.freq === 'semana') ? '' : esc(nt)}</textarea>
          ${novo ? `<div class="rkj">${motivos.map(x => `<button data-rkm="${x}">${x}</button>`).join('')}</div>` : ''}
          <div class="rkb"><button class="ok" data-rka="${novo ? 'on' : 'nota'}" data-rd="${d}" data-rid="${rid}">${novo ? '✓ Fiz' : 'Salvar'}</button>${novo ? `<button class="jb" data-rka="just" data-rd="${d}" data-rid="${rid}">✗ Não fiz · ${js ? 'salvar justificativa' : 'justificar'}</button>` : ''}${js ? `<button class="x" data-rka="unj" data-rd="${d}" data-rid="${rid}">Tirar justificativa</button>` : ''}${n ? `<button class="x" data-rka="off" data-rd="${d}" data-rid="${rid}">Desmarcar</button>` : ''}<button data-rka="can">Cancelar</button></div></div>`;
        const ta = card.querySelector('.rkx textarea'); if (novo) setTimeout(() => ta.focus(), 30); card.querySelector('.rkx').scrollIntoView({ block: 'nearest' }); return;
      }
      const mo = e.target.closest('[data-rkm]');
      if (mo) { e.preventDefault(); const ta = mo.closest('.rkf').querySelector('textarea'), t = mo.dataset.rkm; mo.classList.toggle('on');
        ta.value = mo.classList.contains('on') ? (t + (t === 'Dependia de outra pessoa' ? ': ' : '') + (ta.value ? ' · ' + ta.value : '')) : ta.value.replace(t + ': ', '').replace(t + ' · ', '').replace(t, '').trim(); ta.focus(); return; }
      if (!a) return; e.preventDefault(); const card = a.closest('.rt');
      if (a.dataset.rka === 'can') { card.querySelector('.rkx').innerHTML = ''; return; }
      if (a.dataset.rka === 'off' && a.dataset.ok !== '1') { a.dataset.ok = '1'; a.textContent = 'Toque de novo para desmarcar'; return; }
      const nota = ((card.querySelector('.rkx textarea') || {}).value || '').trim(), k = a.dataset.rka;
      if (k === 'just' && !nota) { const ta = card.querySelector('.rkx textarea'); ta.placeholder = 'Escreva o motivo (ou toque num dos botões acima)'; ta.focus(); return; }
      a.disabled = true; a.textContent = 'salvando…';
      try {
        const r = await chamar({ acao: 'marcar_rotina', id: a.dataset.rid, data: a.dataset.rd, on: k !== 'off', so_nota: k === 'nota' || k === 'just' || k === 'unj', nota: k === 'just' ? '✗ ' + nota : k === 'unj' ? '' : nota });
        depois(r);
      } catch (err) { a.disabled = false; a.textContent = 'não salvou, tente de novo'; }
    });
  }

  /* página da pessoa: app = elemento, chamar(corpo) -> resposta da API ({perfil, tarefas, rotinas}) */
  async function pagina(app, chamar, titulo) {
    css();
    const CK = 'lbrot_' + titulo + '_' + ((window.LB && LB.login) || location.hash.slice(0, 30));
    const guarda = x => { try { localStorage.setItem(CK, JSON.stringify({ perfil: x.perfil, tarefas: x.tarefas, rotinas: x.rotinas, shows: x.shows })); } catch (e) { } };
    let r = null; try { const c = JSON.parse(localStorage.getItem(CK) || 'null'); if (c && c.perfil) r = c; } catch (e) { }
    const fresco = chamar({ acao: 'minhas_tarefas' }), doCache = !!r;
    if (!r) { r = await fresco; guarda(r); }
    const ST = { P: r.perfil, T: r.tarefas || [], R: r.rotinas || [], S: r.shows || [] };
    let TMAIS = false; const TMAX = 6; let URGMIN = false; try { URGMIN = localStorage.getItem('lb_urg_min') === '1'; } catch (x) { }
    /* data que vale no rendimento: tarefa cadastrada já concluída depois do prazo (registro de algo antigo) conta como no prazo */
    const ent = t => t.prazo && t.concluido_em > t.prazo && String(t.criado_em || '').slice(0, 10) > t.prazo ? t.prazo : t.concluido_em;
    app._rot = () => ST.R;
    const REC = { semanal: 'toda semana', mensal: 'todo mês' }, DSN = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const dias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
    function andBox(t, HJ) {
      const L = andL(t); if (!L.length || t.status === 'Concluída' && !L.length) return ''; const a = L[L.length - 1], T = ANDT[a.tp] || ANDT.executando, dd0 = dias(String(a.d).slice(0, 10), HJ);
      const qd = a.tp === 'agendado' ? (a.ag === HJ ? ' · é hoje' : a.ag > HJ ? ' · em ' + dias(HJ, a.ag) + ' dia' + (dias(HJ, a.ag) > 1 ? 's' : '') : ' · já passou, atualize') : a.tp === 'aguardando' && dd0 > 0 ? ' · há ' + dd0 + ' dia' + (dd0 > 1 ? 's' : '') : '';
      const seq = L.slice(-5);
      return `<div class="an an-${T[2]}"><div class="anh"><span class="ani">${T[0]}</span><div><b>${esc(andTit(a))}${qd}</b>${a.tx ? `<span>${esc(a.tx)}</span>` : ''}<small>atualizado ${ddmm(String(a.d).slice(0, 10))} ${String(a.d).slice(11, 16)}${a.por ? ' · ' + esc(a.por) : ''}</small></div></div>
        ${L.length > 1 ? `<div class="ans">${seq.map((x, i) => `${i ? '<u></u>' : ''}<i class="an-${(ANDT[x.tp] || ANDT.executando)[2]}${i === seq.length - 1 ? ' on' : ''}" title="${esc(andTit(x))}">${(ANDT[x.tp] || ANDT.executando)[0]}</i>`).join('')}<u></u><i title="concluir">✓</i></div>
        <details class="anl"><summary>Histórico do processo (${L.length})</summary><ol>${L.map((x, i) => [x, i]).reverse().map(([x, i]) => `<li class="an-${(ANDT[x.tp] || ANDT.executando)[2]}"><i>${(ANDT[x.tp] || ANDT.executando)[0]}</i><b>${esc(andTit(x))}</b>${x.tx ? `<span>${esc(x.tx)}</span>` : ''}<small>${ddmm(String(x.d).slice(0, 10))} ${String(x.d).slice(11, 16)}${x.por ? ' · ' + esc(x.por) : ''}${i === L.length - 1 ? ` · <a href="#" data-andel="${esc(t.id)}" data-i="${i}">apagar</a>` : ''}</small></li>`).join('')}</ol></details>`
        : `<small style="display:block;margin-top:6px;font-size:11.5px"><a href="#" data-andel="${esc(t.id)}" data-i="0" style="color:var(--muted)">apagar</a></small>`}</div>`;
    }
    function andForm(t, ini) {
      const sel = ini ? 'executando' : ((andL(t).slice(-1)[0] || {}).tp || 'executando');
      return `<div class="rkf anf" data-anf="${esc(t.id)}" data-tp="${sel}"><b>${ini ? 'Comecei! Como está o processo?' : 'Como está o processo agora?'}</b>
        <div class="ant">${Object.entries(ANDT).map(([k, v]) => `<button data-ant="${k}" class="${k === sel ? 'on' : ''}">${v[0]} ${k === 'aguardando' ? 'Aguardando alguém' : k === 'agendado' ? 'Agendei uma data' : v[1]}</button>`).join('')}</div>
        <input class="anq" maxlength="80" placeholder="Aguardando quem ou o quê? (ex.: agenda do motorista)" style="${sel === 'aguardando' ? '' : 'display:none'}">
        <label class="anag" style="${sel === 'agendado' ? '' : 'display:none'}">Para quando?<input type="date" min="${hoje()}"></label>
        <textarea maxlength="400" placeholder="${esc(ANDT[sel][3])}"></textarea>
        <div class="rkb"><button class="ok" data-ans="${esc(t.id)}">Salvar andamento</button>${ini ? `<button data-id="${esc(t.id)}" data-s="Em andamento">Só marcar que comecei</button>` : ''}<button data-tjc="1">Cancelar</button></div><div class="anm" style="font-size:12.5px;color:var(--neg);margin-top:6px"></div></div>`;
    }
    function card(t, HJ) {
      const atr = t.status !== 'Concluída' && t.prazo && t.prazo < HJ, c = t.status === 'Concluída' ? 'ok' : atr ? 'atr' : t.status === 'Em andamento' ? 'and' : '';
      const meu = t.criado_por === 'próprio', del = meu ? `<button class="bt del" data-del="${esc(t.id)}" data-dt="tarefa">Apagar</button>` : '';
      const dA = t.status === 'Concluída' && t.prazo && t.concluido_em && ent(t) > t.prazo ? dias(t.prazo, ent(t)) : 0;
      const pz = t.status === 'Concluída' ? `Concluída em ${ddmm(t.concluido_em)}${dA ? ` <span class="neg">· ${dA} dia${dA > 1 ? 's' : ''} depois do prazo</span>` : t.prazo ? ' · no prazo' : ''} · <a href="#" data-cd="${esc(t.id)}">corrigir data</a>`
        : t.prazo ? (atr ? '<span class="neg">Atrasada · era até ' + ddmm(t.prazo) + '</span>' : 'Entregar até ' + ddmm(t.prazo)) : 'Sem prazo';
      return `<div class="tf ${c}"><b>${esc(t.titulo)}${meu ? '<span class="pso">minha</span>' : ''}${REC[t.recorrencia] ? `<span class="pso rec">🔁 ${REC[t.recorrencia]}</span>` : ''}</b>${t.descricao ? `<div class="ds">${esc(t.descricao)}</div>` : ''}
    <div class="pz">${pz}</div>
    ${t.status !== 'Concluída' ? andBox(t, HJ) : ''}
    ${t.justificativa ? `<div class="tj"><em class="jtx">Justificativa${t.justificado_em ? ' · ' + ddmm(t.justificado_em) : ''}:</em> ${esc(t.justificativa)}</div>` : ''}
    <div class="tjf" data-tjf="${esc(t.id)}"></div>
    <div class="bts">${t.status === 'Concluída' ? `<button class="bt" data-id="${esc(t.id)}" data-s="A fazer">Reabrir</button>${del}`
        : `${t.status === 'Em andamento' ? `<button class="bt on" data-id="${esc(t.id)}" data-s="A fazer">◐ Em andamento</button>` : `<button class="bt" data-and="${esc(t.id)}" data-ini="1">Comecei</button>`}<button class="bt anb" data-and="${esc(t.id)}">Andamento</button><button class="bt done" data-id="${esc(t.id)}" data-s="Concluída">✓ Concluí</button><button class="bt jbt" data-tj="${esc(t.id)}">${t.justificativa ? 'Editar justificativa' : atr ? 'Justificar atraso' : 'Não vou conseguir'}</button>${del}`}</div></div>`;
    }
    /* "o que temos pra hoje": atrasadas, hoje, metas para marcar, em andamento e próximos 7 dias */
    function hojeBox(HJ) {
      const T = ST.T.filter(t => t.status !== 'Concluída'), nome = String(ST.P.nome || '').split(' ')[0];
      const h = +new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 13), oi = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
      const pz = (a, b) => (a.prazo || '').localeCompare(b.prazo || '');
      const atr = T.filter(t => t.prazo && t.prazo < HJ).sort(pz), hj = T.filter(t => t.prazo === HJ), prox = T.filter(t => t.prazo > HJ && t.prazo <= soma(HJ, 7)).sort(pz),
        and = T.filter(t => t.status === 'Em andamento' && !t.prazo), PD = ST.R.map(x => [x, pend(x, HJ)]).filter(y => y[1]);
      /* visual: anéis (mês), números do dia, barras da semana; texto só nos nomes das tarefas */
      const M = HJ.slice(0, 7), RA = ST.R.filter(r => r.ativo !== 'não'), PS = RA.map(r => pct(r, M, HJ));
      const med = k => PS.length ? PS.reduce((x, y) => x + (y[k] == null ? 1 : y[k]), 0) / PS.length : null;
      const fm = ST.T.filter(t => t.status === 'Concluída' && (t.concluido_em || '').startsWith(M)).length, am = T.filter(t => (t.prazo || '').startsWith(M) || (t.prazo && t.prazo < HJ)).length;
      const corP = p => p >= .8 ? 'var(--pos)' : p >= .5 ? '#F5C451' : 'var(--neg)';
      const anel = (p, rot, sub) => p == null ? '' : `<div class="hja"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="7"/><circle cx="32" cy="32" r="26" fill="none" stroke="${corP(p)}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(163.4 * Math.min(1, p)).toFixed(1)} 163.4" transform="rotate(-90 32 32)"/><text x="32" y="37" text-anchor="middle">${Math.round(p * 100)}%</text></svg><b>${rot}</b><small>${sub}</small></div>`;
      const num = (n, rot, cor) => `<div class="hjn${n ? '' : ' z'}"><b style="${n && cor ? 'color:' + cor : ''}">${n}</b><small>${rot}</small></div>`;
      const agh = T.filter(t => agendaDe(t, HJ)), sem = Array.from({ length: 7 }, (_, i) => soma(HJ, i)), qn = d => T.filter(t => t.prazo === d || agendaDe(t, d)).length + (d === HJ ? atr.length : 0), mx = Math.max(1, ...sem.map(qn));
      const chip = (t, cls) => `<span class="hjc ${cls}">${esc(t.titulo)}</span>`;
      let c = `<div class="hjr">${anel(med('pct'), 'Metas', 'do mês')}${anel(med('ritmo'), 'Ritmo', 'até hoje')}${fm + am ? anel(fm / (fm + am), 'Tarefas', fm + ' de ' + (fm + am)) : ''}</div>`;
      c += `<div class="hjg">${num(atr.length, 'atrasada' + (atr.length === 1 ? '' : 's'), 'var(--neg)')}${num(hj.length + agh.length, 'pra hoje', 'var(--pinkl)')}${num(PD.length, 'meta' + (PD.length === 1 ? '' : 's') + ' p/ marcar', '#F5C451')}${num(prox.length, 'em 7 dias', '')}</div>`;
      if (atr.length || hj.length || agh.length) c += `<div class="hjcs">${atr.map(t => chip(t, 'a')).join('')}${hj.map(t => chip(t, 'h')).join('')}${agh.map(t => `<span class="hjc g">📅 ${esc(t.titulo)}</span>`).join('')}</div>`;
      if (PD.length) c += `<div class="alr alrin">${PD.map(([x, q]) => `<button data-alr="${esc(x.id)}">${esc(x.titulo)}<small>${esc(q)} →</small></button>`).join('')}</div>`;
      c += `<div class="hjw">${sem.map((d, i) => { const n = qn(d); return `<div${i ? '' : ' class="h"'}><i style="height:${n ? 8 + 40 * n / mx : 3}px;${i === 0 && atr.length ? 'background:var(--neg)' : ''}"></i><b>${n || ''}</b><small>${i ? DSN[new Date(d + 'T12:00:00').getDay()] : 'hoje'}</small></div>`; }).join('')}</div>`;
      if (!T.length && !PD.length) c += '<p style="text-align:center;margin:10px 0 0">Tudo em dia!</p>';
      return `<div class="hj0"><h2>${oi}, ${esc(nome)}!</h2>${c}</div>`;
    }
    /* tudo de um dia: tarefas com prazo, tarefas concluídas, metas (feito / justificado / não marcado) */
    function itensDia(d, HJ) {
      const agend = ST.T.filter(t => agendaDe(t, d) && t.prazo !== d), prazo = ST.T.filter(t => t.prazo === d), feitas = ST.T.filter(t => t.status === 'Concluída' && t.concluido_em === d && t.prazo !== d);
      const metas = ST.R.map(r => { const n = checks(r).filter(x => x === d).length, nt = notas(r)[d] || '', js = !n && ehJ(nt), diaria = r.freq === 'dia' || r.freq === 'util';
        return { r, n, nt, js, falta: !n && !js && diaria && valeNoDia(r, d) && d < HJ, marcar: !n && !js && d === HJ && !!pend(r, HJ) }; }).filter(x => x.n || x.js || x.falta || x.marcar);
      const shows = (ST.S || []).filter(s => s.data === d);
      return { prazo, feitas, metas, agend, shows };
    }
    /* agenda igual à do Lucas: Mês / Semana / Dia, ‹ › Hoje, botões para ocultar blocos; tocar no dia abre o pop-up do dia */
    const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } } };
    let CR = '', CV = ls.get('lbm_vis') || 'mes'; const OC = new Set(String(ls.get('lbm_oculto') || '').split(',').filter(Boolean));
    const CATS = { show: ['Shows', 'pt-sh'], tar: ['Prazos', 'pt-t'], ag: ['Agendado', 'pt-g'], feita: ['Feitas', 'pt-ok'], meta: ['Metas', 'pt-m'] };
    const MS3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'], DSL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    function evDia(d, HJ) {
      const it = itensDia(d, HJ), E = [];
      it.shows.forEach(s => E.push({ cat: 'show', cls: 'pt-sh', txt: 'Show · ' + (s.local || s.show || ''), sub: s.funcao ? 'você vai como ' + s.funcao : 'você está no borderô' }));
      it.prazo.forEach(t => { const ok = t.status === 'Concluída', atr = !ok && t.prazo < HJ; E.push({ cat: 'tar', cls: ok ? 'pt-ok' : atr ? 'pt-a' : 'pt-t', txt: t.titulo, sub: ok ? 'feita' : atr ? 'atrasada' : t.status === 'Em andamento' ? 'fazendo' : 'prazo', fe: ok }); });
      it.agend.forEach(t => E.push({ cat: 'ag', cls: 'pt-g', txt: t.titulo, sub: 'agendado para este dia' }));
      it.feitas.forEach(t => E.push({ cat: 'feita', cls: 'pt-ok', txt: t.titulo, sub: 'feita neste dia', fe: true }));
      it.metas.forEach(x => E.push({ cat: 'meta', cls: x.n ? 'pt-ok' : x.falta ? 'pt-a' : 'pt-m', txt: x.r.titulo, sub: x.n ? 'meta feita' : x.js ? 'justificada' : x.falta ? 'meta não feita' : 'marcar hoje', meta: 1, ok: !!x.n, falta: !!x.falta }));
      return E.filter(x => !OC.has(x.cat));
    }
    const addD = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
    const levH = (x, d) => `<button class="lev${x.fe ? ' fe' : ''}" data-dia="${d}"><em class="${x.cls}"></em><div class="t"><b>${esc(x.txt)}</b><span>${esc(x.sub || '')}</span></div></button>`;
    function calendario(HJ) {
      if (!CR) CR = HJ;
      const y = +CR.slice(0, 4), mo = +CR.slice(5, 7) - 1;
      let tit = '', corpo = '';
      if (CV === 'mes') {
        const m0 = CR.slice(0, 7) + '-01', n = new Date(y, mo + 1, 0).getDate(), off = (new Date(y, mo, 1).getDay() + 6) % 7; tit = MESES[mo] + ' ' + y;
        corpo = `<div class="cw">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}</div><div class="cg">` + '<i></i>'.repeat(off);
        for (let d = 1; d <= n; d++) {
          const k = CR.slice(0, 7) + '-' + String(d).padStart(2, '0'), E = evDia(k, HJ), ch = E.filter(x => !x.meta), MX = 3;
          const mk = E.filter(x => x.meta && x.ok).length, mf = E.filter(x => x.meta && x.falta).length;
          corpo += `<button class="cd${k === HJ ? ' hj' : ''}" data-dia="${k}" aria-label="${d} de ${MESES[mo]}"><b>${d}</b>${ch.slice(0, ch.length > MX ? MX - 1 : MX).map(x => `<i class="ce ${x.cls}${x.fe ? ' fe' : ''}">${esc(x.cat === 'show' ? x.txt.replace('Show · ', '') : x.txt)}</i>`).join('')}${ch.length > MX ? `<i class="cm">+${ch.length - MX + 1}</i>` : ''}${mk || mf ? `<span class="dts">${mk ? `<em class="dk">✓${mk}</em>` : ''}${mf ? `<em class="dx">✗${mf}</em>` : ''}</span>` : ''}</button>`;
        }
        corpo += '</div>';
      } else if (CV === 'sem') {
        const ini = addD(CR, -((new Date(CR + 'T12:00:00').getDay() + 6) % 7)), fim = addD(ini, 6);
        tit = +ini.slice(8) + ' ' + MS3[+ini.slice(5, 7) - 1] + ' – ' + (+fim.slice(8)) + ' ' + MS3[+fim.slice(5, 7) - 1];
        for (let i = 0; i < 7; i++) { const d = addD(ini, i), E = evDia(d, HJ);
          corpo += `<div class="ldia"><button class="dh${d === HJ ? ' hj' : ''}" data-dia="${d}"><span>${DSL[new Date(d + 'T12:00:00').getDay()].slice(0, 3)} · ${+d.slice(8)}${d === HJ ? ' · hoje' : ''}</span><span>${E.length || ''}</span></button>${E.map(x => levH(x, d)).join('')}</div>`; }
      } else {
        tit = DSL[new Date(CR + 'T12:00:00').getDay()] + ', ' + (+CR.slice(8)) + ' de ' + MESES[mo];
        const E = evDia(CR, HJ); corpo = E.map(x => levH(x, CR)).join('') || '<div class="lvz">Nada neste dia.</div>';
      }
      tit = tit.charAt(0).toUpperCase() + tit.slice(1);
      return `<div class="lbc"><div class="lbcb"><button class="nvb" data-cn="-1" aria-label="anterior">‹</button><b>${tit}</b><button class="nvb" data-cn="1" aria-label="próximo">›</button><button class="nvb" data-choje>Hoje</button></div>
        <div class="lbcb"><div class="lbseg">${[['mes', 'Mês'], ['sem', 'Semana'], ['dia', 'Dia']].map(([k, n]) => `<button data-cv="${k}" class="${CV === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
        <div class="cfl">${Object.entries(CATS).map(([k, c]) => `<button data-cf="${k}" class="${OC.has(k) ? 'off' : ''}" title="${OC.has(k) ? 'Mostrar' : 'Ocultar'} ${c[0].toLowerCase()}"><em class="${c[1]}"></em>${c[0]}</button>`).join('')}</div>
        ${corpo}<div class="clg"><span><em class="pt-sh"></em>show</span><span><em class="pt-t"></em>prazo</span><span><em class="pt-a"></em>atrasada</span><span><em class="pt-ok"></em>feita</span><span><em class="pt-g"></em>agendado</span><span><b class="dk">✓</b> metas feitas · <b class="dx">✗</b> não feitas</span></div><p class="clt">Toque num dia para ver tudo dele.</p></div>`;
    }
    function navCal(n) { if (CV === 'mes') { const x = new Date(+CR.slice(0, 4), +CR.slice(5, 7) - 1 + n, 1); CR = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-01'; } else CR = addD(CR, CV === 'sem' ? 7 * n : n); }
    const qs_ = v => String(v).replace(/["\\]/g, '\\$&'); // CSS é o nome do texto de estilos aqui
    function popDia(d) {
      const HJ = hoje(), it = itensDia(d, HJ), dt = new Date(d + 'T12:00:00');
      const st = t => t.status === 'Concluída' ? `<span class="pos">✓ concluída${t.concluido_em && t.concluido_em !== d ? ' em ' + ddmm(t.concluido_em) : ''}</span>` : t.prazo < HJ ? '<span class="neg">atrasada</span>' : t.status === 'Em andamento' ? 'em andamento' : 'a fazer';
      let h = '';
      if (it.shows.length) h += `<h4>Show</h4>${it.shows.map(s => `<div class="pdl"><b>🎤 ${esc(s.show || 'Show')}${s.local ? ' · ' + esc(s.local) : ''}</b><small>Você está no borderô${s.funcao ? ' como ' + esc(s.funcao) : ''}</small></div>`).join('')}`;
      if (it.prazo.length) h += `<h4>Para entregar neste dia</h4>${it.prazo.map(t => `<div class="pdl"><b>${esc(t.titulo)}</b><small>${st(t)}${t.categoria ? ' · ' + esc(t.categoria) : ''}${REC[t.recorrencia] ? ' · 🔁 ' + REC[t.recorrencia] : ''}</small>${t.descricao ? `<small>${esc(t.descricao)}</small>` : ''}${andL(t).length && t.status !== 'Concluída' ? `<small>${esc(andTxt(t))}</small>` : ''}${t.justificativa ? `<small class="jtx">Justificativa: ${esc(t.justificativa)}</small>` : ''}</div>`).join('')}`;
      if (it.agend.length) h += `<h4>Agendado neste dia</h4>${it.agend.map(t => { const a = andL(t).filter(x => x.tp === 'agendado' && x.ag === d).pop(); return `<div class="pdl"><b>📅 ${esc(t.titulo)}</b>${a.tx ? `<small>${esc(a.tx)}</small>` : ''}<small>${t.prazo ? 'entregar até ' + ddmm(t.prazo) : 'sem prazo'}</small></div>`; }).join('')}`;
      if (it.feitas.length) h += `<h4>Concluídas neste dia</h4>${it.feitas.map(t => `<div class="pdl"><b>${esc(t.titulo)}</b><small>${t.prazo ? (t.prazo < d ? `<span class="neg">${dias(t.prazo, d)} dia${dias(t.prazo, d) > 1 ? 's' : ''} depois do prazo (${ddmm(t.prazo)})</span>` : 'antes do prazo (' + ddmm(t.prazo) + ')') : 'sem prazo'}</small></div>`).join('')}`;
      if (it.metas.length) h += `<h4>Metas</h4>${it.metas.map(x => { const pode = !!app.querySelector(`[data-rid="${qs_(x.r.id)}"][data-rf="${d}"]`);
        return `<div class="pdl"><b>${esc(x.r.titulo)}</b><small>${x.n ? `<span class="pos">✓ feito${x.n > 1 ? ' ' + x.n + '×' : ''}</span>` : x.js ? '<span class="jtx">não feito · justificado</span>' : x.falta ? '<span class="neg">não marcado</span>' : 'falta marcar hoje'}${x.nt ? ' · ' + esc(String(x.nt).replace(/^✗\s*/, '')) : ''}</small>${pode ? `<button class="bt" data-pmk="${esc(x.r.id)}" data-pd="${d}">${x.n || x.js ? 'Corrigir' : 'Marcar'}</button>` : ''}</div>`; }).join('')}`;
      if (!h) h = '<p class="clt" style="font-size:14px">Nada neste dia.</p>';
      const box = document.createElement('div'); box.className = 'lbpop';
      box.innerHTML = `<div class="lbpc" role="dialog" aria-modal="true" aria-label="Dia ${ddmm(d)}"><div class="lbph"><b>${DSN[dt.getDay()][0].toUpperCase() + DSN[dt.getDay()].slice(1)}, ${+d.slice(8)} de ${MESES[+d.slice(5, 7) - 1]}${d === HJ ? ' · hoje' : ''}</b><button data-px aria-label="fechar">✕</button></div>${h}</div>`;
      const fecha = () => { box.remove(); document.removeEventListener('keydown', esc_); }, esc_ = e => { if (e.key === 'Escape') fecha(); };
      document.addEventListener('keydown', esc_);
      box.addEventListener('click', e => {
        if (e.target === box || e.target.closest('[data-px]')) { fecha(); return; }
        const mk = e.target.closest('[data-pmk]'); if (!mk) return; fecha();
        const b = app.querySelector(`[data-rid="${qs_(mk.dataset.pmk)}"][data-rf="${mk.dataset.pd}"]`); if (!b) return;
        const det = b.closest('details'); if (det) det.open = true; b.closest('.rt').scrollIntoView({ block: 'center', behavior: 'smooth' }); b.click();
      });
      document.body.appendChild(box); box.querySelector('[data-px]').focus();
    }
    /* gráficos de rendimento: metas por mês, tarefas entregues por mês (no prazo × atrasadas), cada meta do mês */
    function graficos(HJ) {
      const T = ST.T, R = ST.R, MA = HJ.slice(0, 7), ms = [];
      for (let i = 5; i >= 0; i--) { const x = new Date(+HJ.slice(0, 4), +HJ.slice(5, 7) - 1 - i, 1); ms.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); }
      const MC = m => MESES[+m.slice(5, 7) - 1].slice(0, 3);
      const med = ms.map(m => { const at = R.filter(r => r.ativo !== 'não' && (!ini(r) || ini(r) <= m + '-31') && (!r.fim || r.fim >= m + '-01'));
        const vs = at.map(r => { const x = pct(r, m, HJ); return m === MA ? x.ritmo : x.pct; }).filter(v => v != null); return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null; });
      const tm = ms.map(m => { const f = T.filter(t => t.status === 'Concluída' && (t.concluido_em || '').startsWith(m)), at = f.filter(t => t.prazo && ent(t) > t.prazo).length; return { np: f.length - at, at }; }),
        mx = Math.max(1, ...tm.map(x => x.np + x.at));
      const d90 = soma(HJ, -90), f90 = T.filter(t => t.status === 'Concluída' && t.prazo && (t.concluido_em || '') >= d90), npz = f90.filter(t => ent(t) <= t.prazo).length,
        LAT = f90.filter(t => ent(t) > t.prazo).sort((a, b) => b.concluido_em.localeCompare(a.concluido_em)), atrs = LAT.map(t => dias(t.prazo, ent(t))), tx = f90.length ? npz / f90.length : null;
      let h = `<div class="res"><div>No prazo<small style="display:block;letter-spacing:0;text-transform:none">últimos 90 dias</small><b style="color:${cor(tx)}">${P100(tx)}</b></div><div>Atraso médio<small style="display:block;letter-spacing:0;text-transform:none">quando atrasa</small><b>${atrs.length ? (x => x + (x === 1 ? ' dia' : ' dias'))(Math.round(atrs.reduce((a, b) => a + b, 0) / atrs.length)) : '—'}</b></div><div>Metas<small style="display:block;letter-spacing:0;text-transform:none">ritmo do mês</small><b style="color:${cor(med[5])}">${P100(med[5])}</b></div></div>`;
      h += `<details class="gq"><summary>${LAT.length ? `Por que ${LAT.length} entrega${LAT.length > 1 ? 's' : ''} atrasada${LAT.length > 1 ? 's' : ''}?` : 'Como esse número é calculado?'}</summary>
        <p>“No prazo” = tarefas com prazo entregues nos últimos 90 dias até o dia do prazo (${npz} de ${f90.length}). “Atraso médio” = quantos dias depois do prazo, só nas que atrasaram. Tarefas em aberto não entram aqui; elas aparecem em “Atrasadas”, lá em cima. Tarefa cadastrada já concluída depois do prazo (registro de algo antigo) conta como no prazo.</p>
        ${LAT.length ? LAT.map(t => `<div class="pdl"><b>${esc(t.titulo)}</b><small>prazo ${ddmm(t.prazo)} · entregue ${ddmm(t.concluido_em)} · <span class="neg">${dias(t.prazo, ent(t))} dia${dias(t.prazo, ent(t)) > 1 ? 's' : ''} depois</span>${t.justificativa ? ' · ' + esc(t.justificativa) : ''}</small><small>Data errada? Corrija em “corrigir data”, na tarefa concluída.</small></div>`).join('') : '<p>Nenhuma entrega atrasada nos últimos 90 dias.</p>'}</details>`;
      const LG = window.LB && LB.grafico; // gráfico padrão (o mesmo do Vendas); o link de tarefas sem lb.js usa as barras simples
      if (LG && med.some(v => v != null)) h += `<div class="gch"><b>Metas cumpridas por mês</b>${LG(ms.map(MC), [{ nome: 'Metas cumpridas', cor: '#7FDDA9', vals: med.map(v => v == null ? 0 : Math.round(v * 100)) }], { semLeg: true, plano: true, ks: ms, hi: ms.length - 1, fmt: v => v + '%', tfmt: v => v + '%', nomes: ms.map((m, i) => MESES[+m.slice(5, 7) - 1] + (m === MA ? ' (ritmo até hoje)' : '')) })}</div>`;
      else if (med.some(v => v != null)) h += `<div class="gch"><b>Metas cumpridas por mês</b><div class="gb">${ms.map((m, i) => `<div><span style="color:${cor(med[i])}">${med[i] == null ? '' : P100(med[i])}</span><div class="gbw"><i style="height:${med[i] == null ? 0 : Math.max(3, Math.round(med[i] * 100))}%;background:${cor(med[i])}"></i></div><small>${MC(m)}</small></div>`).join('')}</div><p class="gn">${MC(MA)}: ritmo até hoje.</p></div>`;
      if (LG) h += `<div class="gch"><b>Tarefas entregues por mês</b>${LG(ms.map(MC), [{ nome: 'No prazo ou sem prazo', cor: '#7FDDA9', vals: tm.map(x => x.np) }, { nome: 'Depois do prazo', cor: '#FF8FA8', vals: tm.map(x => x.at) }], { plano: true, ks: ms, hi: ms.length - 1, nomes: ms.map(m => MESES[+m.slice(5, 7) - 1]) })}</div>`;
      else h += `<div class="gch"><b>Tarefas entregues por mês</b><div class="gb">${tm.map((x, i) => `<div><span>${x.np + x.at || ''}</span><div class="gbw"><i style="height:${Math.round((x.np + x.at) / mx * 100)}%">${x.at ? `<u style="flex:${x.at};background:var(--neg)"></u>` : ''}${x.np ? `<u style="flex:${x.np};background:var(--pos)"></u>` : ''}</i></div><small>${MC(ms[i])}</small></div>`).join('')}</div><div class="clg"><span><em style="background:var(--pos)"></em>no prazo ou sem prazo</span><span><em style="background:var(--neg)"></em>depois do prazo</span></div></div>`;
      if (R.length) h += `<div class="gch"><b>Cada meta em ${MESES[+MA.slice(5, 7) - 1]}</b>${R.map(r => { const x = pct(r, MA, HJ), v = x.ritmo == null ? x.pct : x.ritmo; return `<div class="ghl"><span>${esc(r.titulo)}</span><i><u style="width:${Math.round((v || 0) * 100)}%;background:${cor(v)}"></u></i><b style="color:${cor(v)}">${P100(v)}</b></div>`; }).join('')}<p class="gn">Ritmo até hoje (dias já passados).</p></div>`;
      return h;
    }
    function render() {
      const HJ = hoje(), MES = HJ.slice(0, 7), P = ST.P, T = ST.T, R = ST.R;
      const ab = T.filter(t => t.status !== 'Concluída').sort((a, b) => (a.prazo || '9').localeCompare(b.prazo || '9')),
        ok = T.filter(t => t.status === 'Concluída').sort((a, b) => (b.concluido_em || '').localeCompare(a.concluido_em || '')), okm = ok.filter(t => (t.concluido_em || '').startsWith(MES));
      const ant = new Date(+MES.slice(0, 4), +MES.slice(5, 7) - 2, 1), MA = ant.getFullYear() + '-' + String(ant.getMonth() + 1).padStart(2, '0');
      const rAnt = R.filter(x => (!x.inicio || x.inicio < MES + '-01'));
      const abV = TMAIS ? ab : ab.slice(0, TMAX), grupos = porCat(abV), comCat = porCat(ab).some(g => g[0]);
      const tMais = ab.length > TMAX ? `<button class="vmb" type="button" data-tmais>${TMAIS ? 'Mostrar menos' : 'Mostrar mais (' + (ab.length - TMAX) + ')'}</button>` : '';
      document.title = P.nome + ' · ' + titulo;
      const U = []; ab.forEach(t => { if (!t.prazo) return; const n = dias(HJ, t.prazo); if (n <= 1) U.push({ t: t.titulo, s: n < 0 ? 'atrasada desde ' + ddmm(t.prazo) : n === 0 ? 'é hoje' : 'é amanhã', d: n < 0 ? HJ : t.prazo }); });
      T.filter(t => agendaDe(t, HJ) && !U.some(u => u.t === t.titulo)).forEach(t => U.push({ t: t.titulo, s: 'agendado para hoje', d: HJ }));
      const ALI = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>';
      app.innerHTML = `<h1>${esc(P.nome)}</h1><p class="fn">${esc(P.funcao || '')}</p>
    ${U.length ? `<div class="urgs"><div class="urgh"><span>🔔 <b>${Math.min(U.length, 4)} aviso${U.length > 1 ? 's' : ''}</b></span><button type="button" data-urgmin>${URGMIN ? 'ver ▾' : 'minimizar ▴'}</button></div>${(URGMIN ? [] : U.slice(0, 4)).map(u => `<button class="urg" data-dia="${u.d}">${ALI}<span>${esc(u.t)}<small>${esc(u.s)}</small></span></button>`).join('')}</div>` : ''}
    ${hojeBox(HJ)}
    <h3>Minha agenda</h3><div id="lbcal">${calendario(HJ)}</div>
    ${P.meta ? `<div class="meta"><span>Minha meta</span>${esc(P.meta)}</div>` : ''}
    <div class="nv"><button data-nv="tarefa"${NV === 'tarefa' ? ' class="on"' : ''}>＋ Nova tarefa</button><button data-nv="meta"${NV === 'meta' ? ' class="on"' : ''}>＋ Nova meta</button></div><div id="nvbox">${form()}</div>
    ${R.length ? `<h3>Metas de ${MESES[+MES.slice(5, 7) - 1]}</h3><div class="list" data-max="0">${R.map(x => cardRot(x, HJ)).join('')}</div>` : ''}
    ${rAnt.length ? `<details><summary>Resultado de ${MESES[ant.getMonth()]}</summary><div class="list" data-max="0">${rAnt.map(x => cardRot(x, HJ, MA)).join('')}</div></details>` : ''}
    <div class="res"><div>A fazer<b>${ab.length}</b></div><div>Atrasadas<b style="${ab.some(t => t.prazo && t.prazo < HJ) ? 'color:var(--neg)' : ''}">${ab.filter(t => t.prazo && t.prazo < HJ).length}</b></div><div>Feitas no mês<b style="color:var(--pos)">${okm.length}</b></div></div>
    <h3>Tarefas em aberto</h3>${!ab.length ? '<div class="empty">Nada pendente.</div>' : comCat
          ? `<div data-semvm>${grupos.map(([c, l]) => `<details class="cat" open><summary>${esc(c || 'Outras')} <small>${TMAIS ? l.length : ab.filter(t => (t.categoria || '') === (c || '')).length}</small></summary><div class="list">${l.map(t => card(t, HJ)).join('')}</div></details>`).join('')}${tMais}</div>`
          : `<div data-semvm><div class="list">${abV.map(t => card(t, HJ)).join('')}</div>${tMais}</div>`}
    <h3>Meu rendimento</h3>${graficos(HJ)}
    ${ok.length ? `<details${ok.length <= 3 ? ' open' : ''}><summary>Concluídas (${ok.length})</summary><div class="list">${ok.slice(0, 30).map(t => card(t, HJ)).join('')}</div></details>` : ''}`;
    }
    let NV = '';
    function form() {
      if (NV === 'tarefa') return `<div class="nvf"><label>Tarefa</label><input id="nv_t" maxlength="200" placeholder="ex.: mandar o orçamento do figurino">
        <label>Detalhes (opcional)</label><textarea id="nv_d" maxlength="2000"></textarea>
        <label>Prazo (opcional)</label><input id="nv_p" type="date">
        <label>Repetir</label><select id="nv_r"><option value="">Não repete</option><option value="semanal">Toda semana</option><option value="mensal">Todo mês</option></select>
        <label>Categoria (opcional)</label><input id="nv_c" maxlength="40" placeholder="Pessoal">
        <div class="msg" id="nv_m"></div><div class="rkb"><button class="ok" data-nvs="tarefa">Criar tarefa</button><button data-nv="">Cancelar</button></div></div>`;
      if (NV === 'meta') return `<div class="nvf"><label>Meta</label><input id="nv_t" maxlength="120" placeholder="ex.: estudar inglês">
        <label>Quantas vezes</label><select id="nv_f"><option value="dia">Todo dia</option><option value="util">Todo dia útil (seg a sex)</option><option value="semana">Algumas vezes por semana</option><option value="mes">Algumas vezes no mês</option></select>
        <div id="nv_aw" style="display:none"><label>Quantas vezes</label><input id="nv_a" type="number" min="1" max="99" value="3"></div>
        <label>Até quando (opcional)</label><input id="nv_fim" type="date">
        <div class="msg" id="nv_m"></div><div class="rkb"><button class="ok" data-nvs="meta">Criar meta</button><button data-nv="">Cancelar</button></div></div>`;
      return '';
    }
    app.addEventListener('change', e => { if (e.target.id === 'nv_f') document.getElementById('nv_aw').style.display = /semana|mes/.test(e.target.value) ? '' : 'none'; });
    app.addEventListener('click', async e => {
      const o = e.target.closest('[data-nv]');
      if (o) { e.preventDefault(); NV = NV === o.dataset.nv ? '' : o.dataset.nv; app.querySelectorAll('.nv button').forEach(b => b.classList.toggle('on', b.dataset.nv === NV));
        app.querySelector('#nvbox').innerHTML = form(); const i = app.querySelector('#nv_t'); if (i) i.focus(); return; }
      const s = e.target.closest('[data-nvs]');
      if (s) { e.preventDefault(); const v = id => ((app.querySelector('#' + id) || {}).value || '').trim(), m = app.querySelector('#nv_m');
        if (!v('nv_t')) { m.textContent = 'Escreva o nome.'; app.querySelector('#nv_t').focus(); return; }
        s.disabled = true; s.textContent = 'salvando…';
        try { const r = await chamar(s.dataset.nvs === 'tarefa' ? { acao: 'nova_tarefa', tarefa: { titulo: v('nv_t'), descricao: v('nv_d'), prazo: v('nv_p'), categoria: v('nv_c'), recorrencia: v('nv_r') } }
            : { acao: 'nova_meta', rotina: { titulo: v('nv_t'), freq: v('nv_f'), alvo: v('nv_a'), fim: v('nv_fim') } });
          NV = ''; aplica(r); } catch (err) { s.disabled = false; s.textContent = 'Tentar de novo'; m.textContent = 'Não salvou. Confira a internet e tente de novo.'; } return; }
      const d = e.target.closest('[data-del]');
      if (d) { e.preventDefault(); if (d.dataset.ok !== '1') { d.dataset.ok = '1'; d.textContent = 'Toque de novo para apagar'; return; }
        d.disabled = true; d.textContent = 'apagando…';
        try { aplica(await chamar({ acao: 'excluir_minha', tipo: d.dataset.dt, id: d.dataset.del })); } catch (err) { d.disabled = false; d.textContent = 'não apagou, tente de novo'; } }
    });
    const aplica = x => { guarda(x); ST.P = x.perfil; ST.T = x.tarefas || []; ST.R = x.rotinas || []; if (x.shows) ST.S = x.shows; render(); };
    app.addEventListener('click', e => { if (!e.target.closest('[data-urgmin]')) return; URGMIN = !URGMIN; try { localStorage.setItem('lb_urg_min', URGMIN ? '1' : '0'); } catch (x) { } render(); });
    app.addEventListener('click', e => { if (!e.target.closest('[data-tmais]')) return; TMAIS = !TMAIS; render(); if (!TMAIS) { const h = [...app.querySelectorAll('h3')].find(x => /Tarefas em aberto/.test(x.textContent)); if (h) h.scrollIntoView({ block: 'start' }); } });
    // alerta: leva até o cartão da meta e abre o formulário de marcar
    app.addEventListener('click', e => { const b = e.target.closest('[data-alr]'); if (!b) return; const c = document.getElementById('rt-' + b.dataset.alr); if (!c) return;
      const k = c.querySelector('.rk[data-novo]') || c.querySelector('[data-rf]'); c.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (k) k.click(); });
    liga(app, chamar, aplica);
    app.addEventListener('click', async e => { // justificativa: abre um campo no cartão; salvar vazio apaga
      const j = e.target.closest('[data-tj]');
      if (j) { const t = ST.T.find(x => x.id === j.dataset.tj), box = app.querySelector(`[data-tjf="${j.dataset.tj}"]`); if (!t || !box) return;
        box.innerHTML = `<div class="rkf"><b>Por que não deu para fazer${t.prazo ? ' até ' + ddmm(t.prazo) : ''}?</b><textarea maxlength="400" placeholder="ex.: esperando o material do fornecedor; faço até sexta">${esc(t.justificativa || '')}</textarea><div class="rkb"><button class="ok" data-tjs="${esc(t.id)}">Salvar justificativa</button><button data-tjc="1">Cancelar</button></div></div>`;
        box.querySelector('textarea').focus(); return; }
      if (e.target.closest('[data-tjc]')) { e.target.closest('.tjf').innerHTML = ''; return; }
      const an = e.target.closest('[data-and]');
      if (an) { const t = ST.T.find(x => x.id === an.dataset.and), box = app.querySelector(`[data-tjf="${an.dataset.and}"]`); if (!t || !box) return;
        box.innerHTML = andForm(t, !!an.dataset.ini); box.querySelector('textarea').focus(); return; }
      const at = e.target.closest('[data-ant]');
      if (at) { e.preventDefault(); const f = at.closest('.anf'), k = at.dataset.ant; f.dataset.tp = k; f.querySelectorAll('[data-ant]').forEach(b => b.classList.toggle('on', b === at));
        f.querySelector('.anq').style.display = k === 'aguardando' ? '' : 'none'; f.querySelector('.anag').style.display = k === 'agendado' ? '' : 'none'; f.querySelector('textarea').placeholder = ANDT[k][3]; return; }
      const as = e.target.closest('[data-ans]');
      if (as) { const f = as.closest('.anf'), tp = f.dataset.tp, a = { tp, tx: f.querySelector('textarea').value.trim(), q: f.querySelector('.anq').value.trim(), ag: f.querySelector('.anag input').value }, m = f.querySelector('.anm');
        if (tp === 'agendado' && !a.ag) { m.textContent = 'Escolha a data agendada.'; return; } if (!a.tx && !a.q && !a.ag) { m.textContent = 'Escreva como está.'; return; }
        as.disabled = true; as.textContent = 'salvando…';
        try { aplica(await chamar({ acao: 'marcar_tarefa', id: as.dataset.ans, andamento: a })); } catch (err) { as.disabled = false; as.textContent = 'não salvou, tente de novo'; } return; }
      const ad = e.target.closest('[data-andel]');
      if (ad) { e.preventDefault(); if (ad.dataset.ok !== '1') { ad.dataset.ok = '1'; ad.textContent = 'toque de novo para apagar'; return; } ad.textContent = 'apagando…';
        try { aplica(await chamar({ acao: 'marcar_tarefa', id: ad.dataset.andel, andamento_del: +ad.dataset.i })); } catch (err) { ad.textContent = 'erro'; } return; }
      const s = e.target.closest('[data-tjs]');
      if (s) { const tx = s.closest('.rkf').querySelector('textarea').value.trim(); s.disabled = true; s.textContent = 'salvando…';
        try { aplica(await chamar({ acao: 'marcar_tarefa', id: s.dataset.tjs, justificativa: tx })); } catch (err) { s.disabled = false; s.textContent = 'não salvou, tente de novo'; } return; }
    });
    app.addEventListener('click', async e => {
      const b = e.target.closest('[data-id]'); if (!b) return; b.disabled = true; b.textContent = 'salvando…';
      try { aplica(await chamar({ acao: 'marcar_tarefa', id: b.dataset.id, status: b.dataset.s })); }
      catch (err) { b.textContent = 'não salvou, tente de novo'; b.disabled = false; }
    });
    // calendário (mudar de mês, abrir o dia) e corrigir a data de conclusão
    app.addEventListener('click', async e => {
      const cb = e.target.closest('[data-cn],[data-choje],[data-cv],[data-cf]');
      if (cb && cb.closest('#lbcal')) { e.preventDefault(); const q = cb.dataset;
        if (q.cn) navCal(+q.cn); else if (q.cv) { CV = q.cv; ls.set('lbm_vis', CV); } else if (q.cf) { OC.has(q.cf) ? OC.delete(q.cf) : OC.add(q.cf); ls.set('lbm_oculto', [...OC].join(',')); } else CR = hoje();
        app.querySelector('#lbcal').innerHTML = calendario(hoje()); return; }
      const d = e.target.closest('[data-dia]'); if (d) { e.preventDefault(); popDia(d.dataset.dia); return; }
      const cd = e.target.closest('[data-cd]');
      if (cd) { e.preventDefault(); const t = ST.T.find(x => x.id === cd.dataset.cd), box = app.querySelector(`[data-tjf="${cd.dataset.cd}"]`); if (!t || !box) return;
        box.innerHTML = `<div class="rkf"><b>Em que dia foi entregue?</b><div class="cdf"><input type="date" value="${esc(t.concluido_em || hoje())}" max="${hoje()}"><div class="rkb" style="margin:0;flex:1"><button class="ok" data-cds="${esc(t.id)}">Salvar data</button><button data-tjc="1">Cancelar</button></div></div></div>`; return; }
      const cs = e.target.closest('[data-cds]');
      if (cs) { e.preventDefault(); const v = cs.closest('.rkf').querySelector('input').value; if (!v || v > hoje()) return; cs.disabled = true; cs.textContent = 'salvando…';
        try { aplica(await chamar({ acao: 'marcar_tarefa', id: cs.dataset.cds, concluido_em: v })); } catch (err) { cs.disabled = false; cs.textContent = 'não salvou, tente de novo'; } }
    });
    render();
    if (doCache) fresco.then(aplica).catch(() => { });
  }
  window.LBROT = { pct, pend, checks, notas, diasMes, porCat, FREQ, MESES, pagina, P100, cor, card: cardRot, css, liga, popup, andL, andTxt, andTit, ANDT, agendaDe };
})();
