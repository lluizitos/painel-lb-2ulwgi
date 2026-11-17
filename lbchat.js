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
.lbq .qr{position:relative;background:var(--card);border-radius:14px;padding:14px 16px;margin-top:8px;border-left:3px solid var(--pink)}.lbq .qp{font-size:12px;color:var(--muted);margin-bottom:6px;padding-right:96px;min-height:22px}.lbq .qxb{position:absolute;top:10px;right:10px;background:var(--card2)!important;border:1px solid var(--line)!important;color:var(--ink)!important;border-radius:99px!important;padding:6px 12px!important;font-size:13px!important;font-weight:700!important;line-height:1.1;cursor:pointer}.lbq .qxb:hover{border-color:var(--sub)!important}
.lbq .qt{font-size:15px;line-height:1.5;color:var(--ink);white-space:pre-line}.lbq .qn{font-size:11.5px;color:var(--muted);margin-top:10px;display:flex;justify-content:space-between;gap:8px}
.lbq .qn a{color:var(--muted)}.lbq .qe{color:var(--pinkl)}.lbq .qg{margin-top:12px}.lbq .qg b{display:block;font-size:12px;color:var(--sub);margin-bottom:8px;letter-spacing:.04em;text-transform:uppercase}
.lbq .qb{display:grid;grid-template-columns:minmax(70px,34%) 1fr auto;gap:5px 8px;align-items:center;font-size:12.5px}.lbq .qb span{color:var(--sub);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lbq .qb i{display:block;height:10px;border-radius:99px;min-width:2px}.lbq .qb em{font-style:normal;color:var(--ink);font-weight:700;white-space:nowrap}
.lbq .qz{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.lbq .qz ul{list-style:none;margin:0;padding:0;font-size:12.5px;flex:1;min-width:150px}.lbq .qz li{display:flex;gap:6px;align-items:center;padding:2px 0;color:var(--sub)}
.lbq .qz li i{width:9px;height:9px;border-radius:3px;flex:none}.lbq .qz li em{margin-left:auto;font-style:normal;color:var(--ink);font-weight:700}
.lbq .ql{display:inline-block;width:14px;height:14px;border:2px solid var(--line);border-top-color:var(--pink);border-radius:99px;animation:lbqs .8s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes lbqs{to{transform:rotate(360deg)}}
.lbq .qd{margin-top:12px;display:flex;flex-wrap:wrap;gap:8px}.lbq .qd button{border:1px solid var(--pinkl);background:transparent;color:var(--pinkl);border-radius:10px;padding:9px 12px;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer}
.lbq .qv{font-size:13px;color:#F5C451;margin-top:10px;background:rgba(245,196,81,.08);border-radius:10px;padding:8px 10px}
.lbq .du{display:grid;gap:8px;margin-bottom:10px}.lbq .dui{background:var(--card);border-radius:14px;padding:12px 14px;border-left:3px solid #F5C451;font-size:13.5px}.lbq .dui.r{border-left-color:var(--pos);background:linear-gradient(135deg,rgba(127,221,169,.10),rgba(127,221,169,.02))}
.lbq .dui b{display:block;font-size:12px;letter-spacing:.04em;color:var(--sub);margin-bottom:4px}.lbq .dui q{display:block;color:var(--muted);font-size:12.5px;margin-bottom:6px}.lbq .dui .dr{color:var(--ink);font-size:15px;line-height:1.5;white-space:pre-line}
.lbq .qa{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.lbq .qa button,.lbq .qs button{border:1px solid var(--line);background:var(--card2);color:var(--ink);border-radius:99px;padding:8px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-align:left}
.lbq .qa button b{color:var(--pinkl);margin-right:4px}.lbq .qa button small{color:var(--muted);font-weight:500}.lbq .qs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}.lbq .qs span{font-size:11.5px;color:var(--muted);margin-right:2px}
.lbq .qs button{padding:6px 11px;font-size:12.5px}.lbq .qc{font-size:11.5px;color:var(--muted);margin-top:8px}.lbq .qc a{color:var(--pinkl)}
@keyframes lbqf{0%,100%{box-shadow:0 0 0 0 transparent}25%,70%{box-shadow:0 0 0 3px var(--pink,#CF1D51)}}.lbqflash{animation:lbqf 1.4s ease 2;border-radius:10px;scroll-margin-top:90px}
.lbq [hidden]{display:none!important}.lbq .qan{background:transparent!important;color:var(--ink)!important;font-size:19px!important;padding:6px 8px!important;line-height:1}.lbq{position:relative}.lbq .qm{display:none;position:absolute;z-index:30;left:0;margin-top:6px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px;box-shadow:0 10px 30px rgba(0,0,0,.4);min-width:210px}
.lbq .qm.on{display:grid}.lbq .qm button{background:transparent;color:var(--ink);text-align:left;padding:11px 12px;font-weight:600}.lbq .qm button:hover{background:var(--card2)}
.lbq .qf{display:flex;align-items:center;gap:8px;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:8px 10px;margin-bottom:6px;font-size:13px}.lbq .qf img{width:38px;height:38px;object-fit:cover;border-radius:8px}.lbq .qf span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.lbq .qf a{color:var(--muted);text-decoration:none;font-size:16px;padding:0 4px}
.lbq .ev{background:var(--card);border-radius:14px;padding:10px 14px;margin-bottom:10px;font-size:13px}.lbq .ev b{display:block;font-size:12px;letter-spacing:.04em;color:var(--sub);margin-bottom:4px}.lbq .ev div{display:flex;gap:8px;align-items:baseline;padding:4px 0;border-top:1px solid var(--line)}.lbq .ev div:first-of-type{border-top:0}
.lbq .ev span{flex:1;min-width:0;color:var(--ink)}.lbq .ev small{color:var(--muted);white-space:nowrap}.lbq .ev em{font-style:normal;font-size:11.5px;white-space:nowrap;border-radius:99px;padding:2px 8px;background:rgba(245,196,81,.12);color:#F5C451}.lbq .ev em.ok{background:rgba(127,221,169,.12);color:var(--pos)}.lbq .ev em.x{background:var(--card2);color:var(--muted)}
.lbq .qtb{display:flex;gap:6px;overflow-x:auto;margin-top:8px;scrollbar-width:none;padding-bottom:2px}.lbq .qtb::-webkit-scrollbar{display:none}.lbq .qtb:empty{display:none}
.lbq .qtb button{flex:none;max-width:230px;display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--card);color:var(--sub);border-radius:99px;padding:6px 6px 6px 12px;font-size:12.5px;font-weight:600;white-space:nowrap}.lbq .qtb button span{overflow:hidden;text-overflow:ellipsis}.lbq .qtb button.on{border-color:var(--pink);color:var(--ink);background:var(--card2)}
.lbq .qtb i{font-style:normal;color:var(--muted);padding:2px 6px;border-radius:99px;font-size:12px}.lbq .qtb i:hover{color:var(--ink);background:var(--line)}.lbq .qtb .qnew{color:var(--pinkl);padding:6px 12px}.lbq .qtb .ql{width:10px;height:10px;margin:0}
.lbq .qcv{position:relative;background:var(--card);border-radius:14px;padding:12px 14px 10px;margin-top:8px;border-left:3px solid var(--pink)}.lbq .qtt{font-size:11.5px;color:var(--muted);padding-right:220px;min-height:28px}.lbq .qbts{position:absolute;top:10px;right:10px;display:flex;gap:6px}.lbq .qbts .qxb{position:static}
.lbq .qbts .qmn{background:var(--card2)!important;border:1px solid var(--line)!important;color:var(--sub)!important;border-radius:99px!important;padding:6px 12px!important;font-size:13px!important;font-weight:700!important;line-height:1.1}.lbq .qbts .qmn:hover{color:var(--ink)!important}
@media(max-width:480px){.lbq .qtt{padding-right:0;padding-top:34px}}
.lbq .qcv .qr{background:transparent;border-left:0;padding:0;margin:4px 0 14px;border-radius:0}.lbq .qme{display:flex;justify-content:flex-end;margin:8px 0 6px}.lbq .qme span{background:var(--pink);color:#fff;border-radius:14px 14px 4px 14px;padding:8px 12px;font-size:14px;line-height:1.4;max-width:85%;white-space:pre-line}
.lbq .dui small{display:block;color:var(--muted);font-size:11.5px;margin-top:6px}.lbq .dui button{margin-top:10px;border:0;background:var(--pos);color:#141218;border-radius:10px;padding:9px 14px;font:inherit;font-weight:700;font-size:13.5px;cursor:pointer}
.lbq .qr,.lbq .qcv{font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif}
.lbq .qt.fm{white-space:normal;font-size:14px;line-height:1.55;color:var(--sub)}
.lbq .fm p{margin:0 0 8px;color:var(--ink)}.lbq .fm b{color:var(--ink);font-weight:700}
.lbq .fm h4{margin:2px 0 10px;font-size:17px;font-weight:800;color:var(--ink);line-height:1.3}
.lbq .fm h5{margin:14px 0 8px;padding-top:12px;border-top:1px solid var(--line);font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--pinkl)}
.lbq .fm h4+h5,.lbq .fm>h5:first-child{border-top:0;padding-top:0;margin-top:4px}
.lbq .fm ul{list-style:none;margin:0 0 8px;padding:0}.lbq .fm li{position:relative;padding:3px 0 3px 16px;color:var(--ink)}
.lbq .fm li:before{content:'';position:absolute;left:2px;top:.72em;width:6px;height:6px;border-radius:50%;background:var(--pink)}
.lbq .fm li.kv{display:flex;gap:10px;align-items:baseline;padding:6px 0 6px 16px;border-bottom:1px dashed var(--line)}.lbq .fm li.kv:last-child{border-bottom:0}
.lbq .fm li.kv span{flex:1;min-width:0;color:var(--sub)}.lbq .fm li.kv em{font-style:normal;font-weight:700;color:var(--ink);white-space:nowrap;text-align:right}
.lbq .fm li.tot{border-top:1px solid var(--line);border-bottom:0;margin-top:2px}.lbq .fm li.tot span{color:var(--ink);font-weight:700}.lbq .fm li.tot:before{background:var(--ink)}
.lbq .fm .vp{color:var(--pos)}.lbq .fm .vn{color:var(--neg,#FF6B6B)}
.lbq .fm .av{margin:10px 0;padding:9px 12px;border-radius:10px;background:rgba(245,196,81,.08);border-left:3px solid #F5C451;color:var(--ink);font-size:13.5px}
.lbq .fm .av.ok{background:rgba(127,221,169,.08);border-left-color:var(--pos)}.lbq .fm .av.ru{background:rgba(255,107,107,.08);border-left-color:var(--neg,#FF6B6B)}
.lbq .fm .av i{font-style:normal;font-size:10.5px;font-weight:800;letter-spacing:.1em;display:block;margin-bottom:2px;color:#F5C451}.lbq .fm .av.ok i{color:var(--pos)}.lbq .fm .av.ru i{color:var(--neg,#FF6B6B)}
.lbq .fm hr{border:0;border-top:1px solid var(--line);margin:12px 0}
.lbq .qk{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,92px),1fr));gap:8px;margin:2px 0 12px;min-width:0}
.lbq .qk div{background:var(--card2);border-radius:12px;padding:10px 12px;border-top:3px solid var(--line)}.lbq .qk small{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.lbq .qk b{font-size:16px;font-weight:800;color:var(--ink);white-space:nowrap}.lbq .qk div{min-width:0;padding:9px 10px}.lbq .qk small{line-height:1.25}.lbq .qk .pos{border-top-color:var(--pos)}.lbq .qk .pos b{color:var(--pos)}.lbq .qk .neg{border-top-color:var(--neg,#FF6B6B)}.lbq .qk .neg b{color:var(--neg,#FF6B6B)}.lbq .qk .ale{border-top-color:#F5C451}.lbq .qk .neu{border-top-color:var(--pink)}`;
  const fmt = (v, it) => it.some(x => Math.abs(x.valor) >= 100) ? brl(v) : String(Math.round(v * 10) / 10).replace('.', ',');
  /* 16/11: resposta da IA formatada — "# título", "## seção", "- item" (ou "- rótulo: valor" = linha com o valor à direita;
     "- Total ...: valor" = linha de total), "> aviso" (amarelo), "+> boa notícia" (verde), "!> risco" (vermelho), "---" separa, **negrito**.
     Valores com sinal ficam coloridos (−R$ vermelho, +R$ verde). Texto antigo (sem marcas) continua aparecendo como parágrafos. */
  function inl(t) {
    return esc(t).replace(/R\$\s/g, 'R$ ').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])([−-]\s?R\$[\s ]?[\d.,]+)/g, '$1<b class="vn">$2</b>').replace(/(^|[\s(])(\+\s?R\$[\s ]?[\d.,]+)/g, '$1<b class="vp">$2</b>');
  }
  function formata(t) {
    const L = String(t || '').replace(/\r/g, '').split('\n'); let h = '', ul = false;
    const fecha = () => { if (ul) { h += '</ul>'; ul = false; } };
    L.forEach(l0 => { const l = l0.trim();
      if (!l) { fecha(); return; }
      let m;
      if (/^-{3,}$/.test(l)) { fecha(); h += '<hr>'; }
      else if ((m = l.match(/^#{2,}\s*(.+)/))) { fecha(); h += '<h5>' + inl(m[1]) + '</h5>'; }
      else if ((m = l.match(/^#\s*(.+)/))) { fecha(); h += '<h4>' + inl(m[1]) + '</h4>'; }
      else if ((m = l.match(/^([+!]?)>\s*(.+)/))) { fecha(); const c = m[1] === '+' ? ' ok' : m[1] === '!' ? ' ru' : ''; h += `<div class="av${c}"><i>${m[1] === '+' ? 'BOA NOTÍCIA' : m[1] === '!' ? 'RISCO' : 'ATENÇÃO'}</i>${inl(m[2])}</div>`; }
      else if ((m = l.match(/^[-•*]\s+(.+)/))) {
        if (!ul) { h += '<ul>'; ul = true; }
        const kv = m[1].match(/^(.{2,70}?):\s+([−+-]?\s?R\$\s?[\d.,]+(?:\s.{0,30})?|[−+-]?[\d.,]+\s?%|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/);
        if (kv) h += `<li class="kv${/^total/i.test(kv[1].replace(/\*/g, '')) ? ' tot' : ''}"><span>${inl(kv[1])}</span><em>${inl(kv[2])}</em></li>`;
        else h += '<li>' + inl(m[1]) + '</li>';
      }
      else { fecha(); h += '<p>' + inl(l) + '</p>'; }
    });
    fecha(); return h;
  }
  function destaques(d) {
    const it = (Array.isArray(d) ? d : []).filter(x => x && x.rotulo && x.valor).slice(0, 4); if (!it.length) return '';
    const tc = { positivo: 'pos', negativo: 'neg', alerta: 'ale', neutro: 'neu' };
    return '<div class="qk">' + it.map(x => `<div class="${tc[x.tom] || 'neu'}"><small>${esc(x.rotulo)}</small><b>${esc(x.valor)}</b></div>`).join('') + '</div>';
  }
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
    if (!el) return; if (op.anexo === undefined) op = Object.assign({}, op, { anexo: true }); // 📎 em todos os chats
    if (!document.getElementById('lbqcss')) { const s = document.createElement('style'); s.id = 'lbqcss'; s.textContent = CSS; document.head.appendChild(s); }
    el.className = 'lbq';
    el.innerHTML = `<div class="du"></div>${op.anexo ? '<div class="ev" hidden></div><div class="qf" hidden></div>' : ''}<form>${op.anexo ? '<button type="button" class="qan" title="Mandar comprovante ou documento (foto ou PDF)" aria-label="Anexar arquivo">📎</button>' : ''}<input maxlength="300" placeholder="💬 Pergunte sua dúvida${op.exemplo ? ' · ex.: ' + esc(op.exemplo) : ''}" aria-label="Pergunte sua dúvida" enterkeyhint="send"><button>Perguntar</button></form>${op.anexo ? '<div class="qm"><button type="button" data-qm="cam">📷 Tirar foto</button><button type="button" data-qm="arq">🖼️ Foto ou PDF do celular</button></div><input type="file" accept="image/*" capture="environment" hidden data-qin="cam"><input type="file" accept="image/*,application/pdf" hidden data-qin="arq">' : ''}<div class="qs"></div><div class="qtb"></div><div class="qoa"></div><div class="qo"></div>`;
    const f = el.querySelector('form'), inp = f.querySelector('input'), bt = f.querySelector('button:not(.qan)'), out = el.querySelector('.qo'), du = el.querySelector('.du'), tb = el.querySelector('.qtb'), oa = el.querySelector('.qoa');
    let api = '', DOC = null;
    const AT = op.atalhos || [], PG = 'lbq_' + (op.pagina || location.pathname.split('/').filter(Boolean).slice(-1)[0] || 'painel');
    const ler = k => { try { return JSON.parse(localStorage.getItem(PG + k) || 'null'); } catch (e) { return null; } }, gravar = (k, v) => { try { localStorage.setItem(PG + k, JSON.stringify(v)); } catch (e) { } };
    const PAR = new Set('a o as os de da do das dos e em no na nos nas um uma uns umas que qual quais quanto quantos quanta quantas como onde por pra para com eu meu minha me tem tenho ta esta estao ja ai isso esse essa ver mostra mostrar quero saber me diga'.split(' '));
    const tok = q => [...new Set(nrm(q).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !PAR.has(w)).map(w => w.slice(0, 6)))];
    const parecido = (a, b) => { const A = new Set(a), B = new Set(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach(x => { if (B.has(x)) i++; }); return i / (A.size + B.size - i); };
    /* atalhos que combinam com a pergunta (sem IA): palavras-chave de cada lugar */
    const sugere = q => { const t = tok(q); return AT.map(a => { const k = tok(a.rot + ' ' + (a.chaves || '')); return [a, t.filter(w => k.some(x => x.startsWith(w.slice(0, 5)) || w.startsWith(x.slice(0, 5)))).length]; })
      .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => ({ id: x[0].id, item: '' })); };
    const usar = id => { const u = ler('_uso') || {}; u[id] = (u[id] || 0) + 1; gravar('_uso', u); fixos(); };
    const qs = el.querySelector('.qs');
    const fixos = () => { const u = ler('_uso') || {}, l = AT.filter(a => (u[a.id] || 0) >= 2).sort((a, b) => u[b.id] - u[a.id]).slice(0, 4);
      qs.innerHTML = l.length ? '<span>⚡ Seus atalhos</span>' + l.map(a => `<button type="button" data-qi="${esc(a.id)}">${esc(a.rot)}</button>`).join('') : ''; };
    fixos();
    const linkH = L => { const v = (L || []).map(l => [AT.find(a => a.id === l.id), l.item]).filter(x => x[0]); return v.length ? `<div class="qa">${v.map(([a, it]) => `<button type="button" data-qi="${esc(a.id)}" data-qt="${esc(it || '')}"><b>→</b>${esc(a.rot)}${it ? ` <small>· ${esc(it)}</small>` : ''}</button>`).join('')}</div>` : ''; };
    /* leva até o lugar (troca a aba se precisar) e, se tiver item, acha a linha dele, abre o que estiver fechado e destaca */
    function vai(id, item) {
      const a = AT.find(x => x.id === id); if (!a) return; let alvo = null; try { alvo = a.ir(); } catch (e) { }
      if (!alvo) return; usar(id);
      setTimeout(() => {
        let x = alvo;
        if (item) { const n = nrm(item), ws = n.split(/\s+/).filter(w => w.length > 2), C = [...alvo.querySelectorAll('.it,.row,.tk,.tf,.card,.sh,.pg,.cd,li,tr,details,.dui,.mv,div')];
          const ok = e => { const t = nrm(e.textContent); return t.includes(n) || (ws.length && ws.every(w => t.includes(w))); };
          const c = C.filter(ok).sort((p, q) => p.textContent.length - q.textContent.length)[0]; if (c) x = c; }
        let p = x; while (p && p !== document.body) { if (p.tagName === 'DETAILS') p.open = true; if (p.classList && p.classList.contains('vmh')) { const l = p.parentElement, b = l && l.querySelector(':scope>.vmb'); if (b) b.click(); } p = p.parentElement; }
        const h = (document.querySelector('header') || {}).offsetHeight || 0;
        const yy = Math.max(0, x.getBoundingClientRect().top + scrollY - h - 12); scrollTo({ top: yy, behavior: 'smooth' }); setTimeout(() => { if (Math.abs(scrollY - yy) > 40) scrollTo(0, yy); }, 700);
        x.classList.remove('lbqflash'); void x.offsetWidth; x.classList.add('lbqflash'); setTimeout(() => x.classList.remove('lbqflash'), 3000);
      }, 60);
    }
    qs.addEventListener('click', e => { const b = e.target.closest('[data-qi]'); if (b) vai(b.dataset.qi, ''); });
    const URL_ = async () => api || (api = (await (await fetch((op.base || '') + 'config.json', { cache: 'no-store' })).json()).api_url);
    const cred = () => op.auth ? op.auth() : { usuario: LB.login, senha: LB.senha, nome: LB.usuario };
    /* dúvidas que a IA passou para a equipe: aguardando / respondida (fica até a pessoa tocar em "Vi") */
    const dRender = l => { du.innerHTML = (l || []).map(d => d.status === 'respondida'
      ? `<div class="dui r"><b>📨 A EQUIPE RESPONDEU SUA DÚVIDA</b><q>“${esc(d.pergunta)}” · ${esc(String(d.criado_em).slice(8, 10) + '/' + String(d.criado_em).slice(5, 7))}</q><div class="dr">${esc(d.resposta)}</div><small>${esc(d.respondido_por || 'Equipe')} · ${esc(String(d.respondido_em).slice(8, 10) + '/' + String(d.respondido_em).slice(5, 7) + ' ' + String(d.respondido_em).slice(11, 16))}</small><button data-dv="${esc(d.id)}">Vi a resposta ✓</button></div>`
      : `<div class="dui"><b>⏳ A EQUIPE FOI AVISADA</b><q>“${esc(d.pergunta)}”</q>Ainda não tenho essa informação; já pedi para a equipe e em breve a resposta aparece aqui.</div>`).join(''); };
    const dCarrega = async () => { if (op.auth) return; if (!window.LB || !LB.senha) return false;
      try { const r = await (await fetch(await URL_(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ acao: 'minhas_duvidas' }, cred())) })).json(); if (r.ok) dRender(r.duvidas); } catch (e) { } return true; };
    { let n = 0; const t = setInterval(async () => { if (await dCarrega() !== false || ++n > 90) clearInterval(t); }, 2000); setInterval(dCarrega, 300000); }
    du.addEventListener('click', async e => { const b = e.target.closest('[data-dv]'); if (!b) return; b.disabled = true; b.textContent = 'salvando…';
      try { const r = await (await fetch(await URL_(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ acao: 'vi_duvida', id: b.dataset.dv }, cred())) })).json(); if (r.ok) dRender(r.duvidas); else b.textContent = 'tente de novo'; }
      catch (er) { b.disabled = false; b.textContent = 'tente de novo'; } });
    /* comprovante (foto da câmera, galeria ou PDF): vai para o Luiz conferir e lançar no Admin */
    let ARQ = null; const PH = inp.placeholder, ev = el.querySelector('.ev'), qf = el.querySelector('.qf'), qm = el.querySelector('.qm');
    const prepArq = async a => {
      if (/^image\//.test(a.type)) { const img = await createImageBitmap(a), k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return { tipo: 'image/jpeg', dados: c.toDataURL('image/jpeg', .82).split(',')[1] }; }
      if (a.type === 'application/pdf') { if (a.size > 5e6) throw new Error('PDF maior que 5 MB'); const u = await new Promise((ok, er) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.onerror = er; fr.readAsDataURL(a); }); return { tipo: 'application/pdf', dados: u.split(',')[1] }; }
      throw new Error('use foto ou PDF'); };
    const tiraArq = () => { ARQ = null; if (qf) { qf.hidden = true; qf.innerHTML = ''; } phSet(); bt.textContent = 'Perguntar'; };
    const STV = { pendente: ['⏳ o Luiz vai conferir', ''], 'lançado': ['✅ lançado', 'ok'], conferido: ['✓ conferido', 'ok'], descartado: ['descartado', 'x'] };
    const evRender = l => { if (!ev) return; const v = (l || []).filter(x => x.status === 'pendente' || Date.now() - new Date(String(x.atualizado_em).replace(' ', 'T')).getTime() < 3 * 864e5).slice(0, 5);
      ev.hidden = !v.length; ev.innerHTML = v.length ? '<b>📎 SEUS ENVIOS</b>' + v.map(x => { const s = STV[x.status] || STV.pendente; return `<div><small>${esc(String(x.criado_em).slice(8, 10) + '/' + String(x.criado_em).slice(5, 7))}</small><span>${esc((x.ia && x.ia.e_comprovante !== false && x.ia.resumo) || x.nota || 'Comprovante')}</span><em class="${s[1]}">${s[0]}</em></div>`; }).join('') : ''; };
    const evCarrega = async () => { if (!ev || (!op.auth && (!window.LB || !LB.senha))) return;
      try { const r = await (await fetch(await URL_(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ acao: 'meus_envios' }, cred())) })).json(); if (r.ok) evRender(r.envios); } catch (e) { } };
    if (op.anexo) {
      { let n = 0; const t = setInterval(() => { if (op.auth || (window.LB && LB.senha) || ++n > 90) { clearInterval(t); evCarrega(); } }, 2000); setInterval(evCarrega, 300000); }
      f.querySelector('.qan').onclick = e => { e.stopPropagation(); qm.classList.toggle('on'); };
      document.addEventListener('click', e => { if (!e.target.closest('.qm')) qm.classList.remove('on'); });
      qm.onclick = e => { const b = e.target.closest('[data-qm]'); if (!b) return; qm.classList.remove('on'); const i = el.querySelector(`[data-qin="${b.dataset.qm}"]`); i.value = ''; i.click(); };
      el.querySelectorAll('[data-qin]').forEach(i => i.onchange = () => { const a = i.files && i.files[0]; if (!a) return;
        if (!/^image\//.test(a.type) && a.type !== 'application/pdf') { oa.innerHTML = '<div class="qr"><div class="qt qe">Mande foto ou PDF.</div><div class="qn"><span></span><span><a href="#" class="qx">fechar</a></span></div></div>'; return; }
        ARQ = a; const im = /^image\//.test(a.type) ? URL.createObjectURL(a) : '';
        qf.innerHTML = `${im ? `<img src="${im}" alt="">` : '📄'}<span>${esc(a.name || 'comprovante')}</span><a href="#" class="qfx" aria-label="Tirar anexo">✕</a>`; qf.hidden = false;
        inp.placeholder = 'O que é? (opcional) · ex.: comprovante do som de Patos'; bt.textContent = 'Enviar'; inp.focus(); });
      qf.onclick = e => { if (e.target.closest('.qfx')) { e.preventDefault(); tiraArq(); } };
    }
    async function enviaArq() {
      const nota = inp.value.trim(), a = ARQ; bt.disabled = true;
      oa.innerHTML = `<div class="qr"><div class="qp">📎 ${esc(a.name || 'comprovante')}${nota ? ' · ' + esc(nota) : ''}</div><div class="qt"><span class="ql"></span>Enviando e lendo o comprovante…</div></div>`;
      try {
        const x = await prepArq(a); await URL_();
        const r = await (await fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ acao: 'enviar_comprovante', dados: x.dados, tipo: x.tipo, nota: nota, pagina: String(op.pagina || document.title || '').slice(0, 30) }, cred())) })).json();
        if (!r.ok) { oa.innerHTML = `<div class="qr"><div class="qt qe">${r.erro === 'grande' ? 'Arquivo grande demais (máx. 5 MB).' : r.erro === 'limite' ? 'Muitos envios hoje. Amanhã libera de novo.' : r.erro === 'acesso' ? 'Sem acesso para mandar comprovante.' : 'Não consegui enviar. Tente de novo.'}</div></div>`; return; }
        const L = r.leitura, ok = L && L.e_comprovante !== false;
        const det = ok ? [L.tipo === 'entrada' ? 'Entrada' : L.tipo === 'saida' ? 'Saída' : '', L.valor ? brl(L.valor) : '', L.quem, L.data ? L.data.slice(8, 10) + '/' + L.data.slice(5, 7) : ''].filter(Boolean).join(' · ') : '';
        oa.innerHTML = `<div class="qr"><div class="qp">📎 ${esc(a.name || 'comprovante')}${nota ? ' · ' + esc(nota) : ''}</div><div class="qt">${r.lancado ? '✅ Comprovante lançado: já entrou no saldo.' : r.motivo === 'repetido' ? '⚠️ Esse comprovante parece repetido, então não lancei de novo. O Luiz vai conferir.' : '✅ Enviado para o Luiz conferir.'}${ok && L.resumo ? '\n\nLi aqui: ' + esc(L.resumo) : ''}</div>${det ? `<div class="qc">${esc(det)}</div>` : ''}${L && L.e_comprovante === false ? `<div class="qv">Não parece um comprovante: ${esc(L.resumo || '')}. Se estiver certo, tudo bem: o Luiz vê do mesmo jeito.</div>` : ''}<div class="qn"><span>Fica guardado numa pasta privada do Drive.</span><span><a href="#" class="qx">fechar</a></span></div></div>`;
        inp.value = ''; tiraArq(); evCarrega();
      } catch (er) { oa.innerHTML = `<div class="qr"><div class="qt qe">${esc(er && er.message && /PDF|foto/.test(er.message) ? er.message : 'Sem conexão. Tente de novo.')}</div></div>`; }
      finally { setTimeout(() => { bt.disabled = false; }, 1500); }
    }
    /* ---------- CONVERSAS: cada pergunta nova abre uma conversa; as que não foram fechadas viram abas (ficam até fechar, mesmo recarregando) ---------- */
    gravar('_aberta', null); // formato antigo (uma resposta só)
    const novaId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    let CV = (ler('_conv') || []).filter(c => c && c.id && Array.isArray(c.msgs) && Date.now() - c.t < 14 * 864e5);
    CV.forEach(c => c.msgs.forEach(m => { if (m.pend) { m.pend = false; m.erro = 'A resposta não chegou (a página foi fechada). Pergunte de novo.'; } }));
    let ATV = ler('_atv'); if (!CV.some(c => c.id === ATV)) ATV = CV.length ? CV[0].id : null;
    const salva = () => { gravar('_conv', CV.slice(0, 8)); gravar('_atv', ATV); };
    const curto = s => { s = String(s || ''); return s.length > 30 ? s.slice(0, 28) + '…' : s; };
    const ddh = t => { const d = new Date(t); return d.toLocaleDateString('pt-BR').slice(0, 5) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
    function msgH(m, i) {
      const r = m.r || {}, eu = `<div class="qme"><span>${esc(m.q)}</span></div>`;
      if (m.pend) return eu + `<div class="qr"><div class="qt"><span class="ql"></span>Pensando…</div>${m.sg && m.sg.length ? linkH(m.sg) : ''}</div>`;
      if (m.erro) return eu + `<div class="qr"><div class="qt qe">${esc(m.erro)}</div></div>`;
      return eu + `<div class="qr">${destaques(r.destaques)}<div class="qt fm">${formata(r.resposta)}</div>${linkH(r.links)}${r.grafico ? grafico(r.grafico) : ''}${r.doc ? `<div class="qd"><button class="qdb" data-di="${i}">📄 Abrir documento: ${esc(r.doc.titulo || 'relatório')}</button></div>` : ''}${r.duvida ? '<div class="qv">📨 Já avisei a equipe. Quando a resposta chegar, ela aparece aqui em cima.</div>' : ''}${m.cache ? `<div class="qc">Você já perguntou isso em ${ddh(m.cache)}. Os atalhos levam aos números de agora. <a href="#" class="qnv" data-ni="${i}">Perguntar de novo</a></div>` : ''}</div>`;
    }
    function phSet() { if (!ARQ) inp.placeholder = CV.some(c => c.id === ATV) ? '💬 Continue a conversa… (ou toque em + Nova)' : PH; }
    function render(rolar) {
      tb.innerHTML = CV.length ? CV.map(c => `<button type="button" class="qtab${c.id === ATV ? ' on' : ''}" data-cv="${esc(c.id)}" title="${esc(c.titulo)}"><span>${esc(curto(c.titulo))}</span>${c.msgs.some(m => m.pend) ? '<span class="ql"></span>' : ''}<i data-cx="${esc(c.id)}" role="button" aria-label="Fechar conversa">✕</i></button>`).join('') + `<button type="button" class="qtab qnew${ATV ? '' : ' on'}" data-cv="">+ Nova</button>` : '';
      const c = CV.find(x => x.id === ATV);
      out.innerHTML = c ? `<div class="qcv"><div class="qbts"><button type="button" class="qmn" data-min="1" aria-label="Minimizar conversa">— Minimizar</button><button type="button" class="qx qxb" data-cx="${esc(c.id)}" aria-label="Fechar conversa">✕ Fechar</button></div><div class="qtt">Conversa · ${esc(ddh(c.ini || c.t))}${c.msgs.length > 1 ? ' · ' + c.msgs.length + ' perguntas' : ''}</div>${c.msgs.map(msgH).join('')}<div class="qn"><span>Resposta automática com os dados do app · confira os valores antes de decidir</span><span>${c.uso != null ? 'uso de hoje: ' + c.uso + '%' : ''}</span></div></div>` : '';
      phSet();
      if (rolar && c) { const ul = out.querySelectorAll('.qme'), x = ul[ul.length - 1]; if (x) { const r = x.getBoundingClientRect(); if (r.top < 60 || r.top > innerHeight - 120) x.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    }
    render();
    f.onsubmit = async e => {
      e.preventDefault(); if (ARQ) { if (!bt.disabled) enviaArq(); return; } const q = inp.value.trim(); if (q.length < 3 || bt.disabled) return;
      let c = CV.find(x => x.id === ATV);
      /* pergunta repetida numa conversa nova: mostra na hora a resposta guardada (sem gastar a IA); "perguntar de novo" atualiza */
      const tq = tok(q), H = ler('_hist') || [];
      if (!c && !e.lbqNova) { const vh = H.filter(h => Date.now() - h.t < 7 * 864e5).map(h => [h, parecido(tq, h.tk)]).sort((a, b) => b[1] - a[1])[0];
        if (vh && vh[1] >= 0.75) { const h = vh[0]; c = { id: novaId(), titulo: q, msgs: [{ q, r: { resposta: h.resposta, links: h.links, doc: h.doc || null, grafico: h.grafico || null, destaques: h.destaques || null }, cache: h.t }], t: Date.now(), ini: Date.now() };
          CV.unshift(c); ATV = c.id; salva(); render(true); inp.value = ''; return; } }
      if (!c) { c = { id: novaId(), titulo: q, msgs: [], t: Date.now(), ini: Date.now() }; CV.unshift(c); ATV = c.id; }
      /* o assistente recebe a conversa desta aba (perguntas e respostas) e um resumo das outras abas abertas */
      const hist = c.msgs.filter(m => m.r && !m.erro && !m.pend).slice(-6).map(m => ({ q: String(m.q).slice(0, 300), r: String(m.r.resposta || '').slice(0, 1500) }));
      const outras = CV.filter(x => x !== c).slice(0, 5).map(x => { const u = x.msgs.filter(m => m.r).slice(-1)[0]; return '• ' + String(x.titulo).slice(0, 120) + (u ? ' → ' + String(u.r.resposta || '').slice(0, 300) : ''); }).join('\n');
      const SG = sugere(q), m = { q, pend: true, sg: SG }; c.msgs.push(m); c.msgs = c.msgs.slice(-20); c.t = Date.now(); CV = [c].concat(CV.filter(x => x !== c));
      salva(); render(true); inp.value = ''; bt.disabled = true;
      try {
        await URL_();
        let ctx = ''; try { ctx = op.contexto(); } catch (er) { }
        const r = await (await fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ acao: 'perguntar', pergunta: q, contexto: limpa(ctx).slice(0, 16000), base: op.base_dados ? String(op.base_dados() || '').slice(0, 400000) : '', atalhos: AT.map(a => a.id + ': ' + a.rot + (a.desc ? ' (' + a.desc + ')' : '')).join('\n'), historico: hist, outras: limpa(outras).slice(0, 3000) }, op.auth ? op.auth() : { usuario: LB.login, senha: LB.senha, nome: LB.usuario })) })).json();
        m.pend = false; delete m.sg;
        if (!r.ok) { m.erro = r.erro === 'espera' ? `Espere ${r.s} s para a próxima pergunta.` : ERR[r.erro] || 'Não consegui responder agora. Tente de novo.'; if (!inp.value) inp.value = q; }
        else { const LK = (r.links && r.links.length ? r.links : SG).slice(0, 4);
          m.r = { resposta: r.resposta, links: LK, destaques: r.destaques || null, grafico: r.grafico || null, doc: r.doc || null, duvida: !!r.duvida }; if (r.uso != null) c.uso = r.uso;
          if (!r.duvida && !hist.length) { H.unshift({ tk: tq, t: Date.now(), resposta: r.resposta, links: LK, doc: r.doc || null, grafico: r.grafico || null, destaques: r.destaques || null }); gravar('_hist', H.slice(0, 30)); }
          if (r.duvida) dCarrega(); }
      } catch (er) { m.pend = false; delete m.sg; m.erro = 'Sem conexão. Tente de novo.'; if (!inp.value) inp.value = q; }
      finally { c.t = Date.now(); salva(); if (CV.includes(c)) render(c.id === ATV); else render(); setTimeout(() => { bt.disabled = false; }, 3000); }
    };
    tb.addEventListener('click', e => { const x = e.target.closest('[data-cx]'); if (x) { e.preventDefault(); e.stopPropagation(); fecha(x.dataset.cx); return; }
      const b = e.target.closest('[data-cv]'); if (!b) return; ATV = b.dataset.cv && b.dataset.cv !== ATV ? b.dataset.cv : null; /* tocar na aba aberta minimiza */ salva(); render(); if (!ATV) inp.focus(); });
    function fecha(id) { const i = CV.findIndex(c => c.id === id); if (i < 0) return; CV.splice(i, 1); if (ATV === id) ATV = CV.length ? CV[Math.min(i, CV.length - 1)].id : null; salva(); render(); }
    oa.addEventListener('click', e => { if (e.target.closest('.qx')) { e.preventDefault(); oa.innerHTML = ''; } });
    out.addEventListener('click', e => { const x = e.target.closest('[data-cx]'); if (x) { e.preventDefault(); fecha(x.dataset.cx); return; }
      if (e.target.closest('[data-min]')) { e.preventDefault(); ATV = null; salva(); render(); return; }
      const qi = e.target.closest('[data-qi]'); if (qi) { e.preventDefault(); vai(qi.dataset.qi, qi.dataset.qt || ''); return; }
      const c = CV.find(y => y.id === ATV); if (!c) return;
      const nv = e.target.closest('.qnv'); if (nv) { e.preventDefault(); const m = c.msgs[+nv.dataset.ni]; if (!m) return; c.msgs.splice(+nv.dataset.ni, 1); if (!c.msgs.length) { CV = CV.filter(y => y !== c); ATV = null; } salva(); render();
        inp.value = m.q; const ev = new Event('submit', { cancelable: true }); ev.lbqNova = true; f.dispatchEvent(ev); return; }
      const db = e.target.closest('.qdb'); if (db) { e.preventDefault(); const m = c.msgs[+db.dataset.di]; if (!m || !m.r || !m.r.doc) return; let b = ''; try { b = op.base_dados ? op.base_dados() : ''; } catch (er) { } documento(m.r.doc, b); } });
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
  /* ---------- DOCUMENTOS PRONTOS: lê a base (texto com EXTRATO, SHOWS, CONTAS, BORDERÔS) e monta uma página para imprimir / salvar em PDF ---------- */
  function secao(base, ini) { const i = base.indexOf('\n' + ini); if (i < 0) return []; const r = base.slice(base.indexOf('\n', i + 1) + 1), f = r.search(/\n\s*\n/); return (f < 0 ? r : r.slice(0, f)).split('\n').filter(Boolean); }
  const nrm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const b2 = v => (v < 0 ? '−' : '') + 'R$ ' + Math.abs(+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dd = d => /^\d{4}-\d{2}-\d{2}/.test(d || '') ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : (d || '');
  const MS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function documento(doc, base) {
    const de = /^\d{4}-\d{2}-\d{2}$/.test(doc.de || '') ? doc.de : '', ate = /^\d{4}-\d{2}-\d{2}$/.test(doc.ate || '') ? doc.ate : '', no = d => d && (!de || d >= de) && (!ate || d <= ate), fl = nrm(doc.filtro || '').trim();
    const tab = (cab, linhas, tot) => `<table><thead><tr>${cab.map((c, i) => `<th${i >= cab.length - (tot ? tot.n : 0) ? ' class="n"' : ''}>${c}</th>`).join('')}</tr></thead><tbody>${linhas.join('') || `<tr><td colspan="${cab.length}" class="v">Nada no período.</td></tr>`}</tbody>${tot ? `<tfoot><tr>${tot.c.join('')}</tr></tfoot>` : ''}</table>`;
    const td = (v, n) => `<td${n ? ' class="n' + (typeof v === 'number' && v < 0 ? ' neg' : '') + '"' : ''}>${typeof v === 'number' ? b2(v) : esc(v)}</td>`;
    const MV = secao(base, 'EXTRATO COMPLETO').map(l => { const c = l.split('|'); return { data: c[0], quem: c[1], valor: +c[2] || 0, cat: c[3], show: c[4], meio: c[5], obs: c[6] }; }).filter(m => /^\d{4}-/.test(m.data));
    let corpo = '', res = '';
    if (doc.tipo === 'extrato' || doc.tipo === 'categorias' || doc.tipo === 'mensal') {
      const L = MV.filter(m => no(m.data) && (!fl || nrm([m.quem, m.cat, m.show, m.obs].join(' ')).includes(fl))), E = L.filter(m => m.valor > 0).reduce((a, m) => a + m.valor, 0), S = L.filter(m => m.valor < 0).reduce((a, m) => a + m.valor, 0);
      res = `<div class="k"><div>Entradas<b class="pos">${b2(E)}</b></div><div>Saídas<b class="neg">${b2(S)}</b></div><div>Resultado<b>${b2(E + S)}</b></div><div>Movimentações<b>${L.length}</b></div></div>`;
      if (doc.tipo === 'extrato') corpo = tab(['Data', 'Quem', 'Categoria', 'Show / obs.', 'Valor'], L.map(m => `<tr>${td(dd(m.data))}${td(m.quem)}${td(m.cat)}${td([m.show, m.meio === 'dinheiro' ? 'dinheiro' : '', m.obs].filter(Boolean).join(' · '))}${td(m.valor, 1)}</tr>`), { n: 1, c: [`<td colspan="4">Total</td>`, td(E + S, 1)] });
      if (doc.tipo === 'categorias') { const g = (sn) => { const o = {}; L.filter(m => sn > 0 ? m.valor > 0 : m.valor < 0).forEach(m => { const k = m.cat || 'Sem categoria'; o[k] = o[k] || { v: 0, n: 0 }; o[k].v += m.valor; o[k].n++; }); return Object.entries(o).sort((a, b) => Math.abs(b[1].v) - Math.abs(a[1].v)); };
        const ge = g(1), gs = g(-1);
        corpo = `<h3>Entradas</h3>` + tab(['Categoria', 'Qtd.', 'Valor', '%'], ge.map(([k, x]) => `<tr>${td(k)}<td class="n">${x.n}</td>${td(x.v, 1)}<td class="n">${E ? Math.round(x.v / E * 100) : 0}%</td></tr>`), { n: 3, c: ['<td>Total</td><td></td>', td(E, 1), '<td></td>'] })
          + `<h3>Saídas</h3>` + tab(['Categoria', 'Qtd.', 'Valor', '%'], gs.map(([k, x]) => `<tr>${td(k)}<td class="n">${x.n}</td>${td(x.v, 1)}<td class="n">${S ? Math.round(x.v / S * 100) : 0}%</td></tr>`), { n: 3, c: ['<td>Total</td><td></td>', td(S, 1), '<td></td>'] }); }
      if (doc.tipo === 'mensal') { const o = {}; L.forEach(m => { const k = m.data.slice(0, 7); o[k] = o[k] || { e: 0, s: 0 }; if (m.valor > 0) o[k].e += m.valor; else o[k].s += m.valor; });
        corpo = tab(['Mês', 'Entradas', 'Saídas', 'Resultado'], Object.keys(o).sort().map(k => `<tr>${td(MS[+k.slice(5, 7) - 1] + '/' + k.slice(0, 4))}${td(o[k].e, 1)}${td(o[k].s, 1)}${td(o[k].e + o[k].s, 1)}</tr>`), { n: 3, c: ['<td>Total</td>', td(E, 1), td(S, 1), td(E + S, 1)] }); }
    } else if (doc.tipo === 'shows') {
      const L = secao(base, 'SHOWS').map(l => { const c = l.split('|'); return { data: c[0], cidade: c[1], evento: c[2], contratante: c[3], valor: +c[5] || 0, rec: +c[6] || 0, status: c[7] }; })
        .filter(x => /^\d{4}-/.test(x.data) && no(x.data) && x.status !== 'Cancelado' && (!fl || nrm([x.cidade, x.evento, x.contratante, x.status].join(' ')).includes(fl))).sort((a, b) => a.data.localeCompare(b.data));
      const V = L.reduce((a, x) => a + x.valor, 0), R = L.reduce((a, x) => a + x.rec, 0);
      res = `<div class="k"><div>Shows<b>${L.length}</b></div><div>Cachês<b>${b2(V)}</b></div><div>Recebido<b class="pos">${b2(R)}</b></div><div>Falta receber<b class="neg">${b2(V - R)}</b></div></div>`;
      corpo = tab(['Data', 'Show', 'Contratante', 'Status', 'Cachê', 'Recebido', 'Falta'], L.map(x => `<tr>${td(dd(x.data))}${td([x.evento, x.cidade].filter(Boolean).join(' · '))}${td(x.contratante)}${td(x.status)}${td(x.valor, 1)}${td(x.rec, 1)}${td(x.valor - x.rec, 1)}</tr>`), { n: 3, c: ['<td colspan="4">Total</td>', td(V, 1), td(R, 1), td(V - R, 1)] });
    } else if (doc.tipo === 'contas') {
      const L = secao(base, 'CONTAS A PAGAR').map(l => { const c = l.split('|'); return { venc: c[0], desc: c[1], para: c[2], valor: +c[3] || 0, pago: c[4] }; }).filter(x => /^\d{4}-/.test(x.venc) && no(x.venc) && (!fl || nrm(x.desc + ' ' + x.para).includes(fl)));
      const T = L.reduce((a, x) => a + x.valor, 0), P = L.filter(x => x.pago).reduce((a, x) => a + x.valor, 0);
      res = `<div class="k"><div>Contas<b>${L.length}</b></div><div>Total<b>${b2(T)}</b></div><div>Pago<b class="pos">${b2(P)}</b></div><div>Em aberto<b class="neg">${b2(T - P)}</b></div></div>`;
      corpo = tab(['Vencimento', 'Descrição', 'Para', 'Pago em', 'Valor'], L.map(x => `<tr>${td(dd(x.venc))}${td(x.desc)}${td(x.para)}${td(x.pago ? dd(x.pago) : 'em aberto')}${td(x.valor, 1)}</tr>`), { n: 1, c: ['<td colspan="4">Total</td>', td(T, 1)] });
    } else if (doc.tipo === 'borderos') {
      const L = secao(base, 'BORDERÔS').filter(l => /^\d{4}-\d{2}-\d{2}/.test(l) && no(l.slice(0, 10)) && (!fl || nrm(l).includes(fl)));
      corpo = tab(['Data', 'Show e gastos'], L.map(l => `<tr>${td(dd(l.slice(0, 10)))}<td>${esc(l.slice(11)).replace(/ · /g, '<br>')}</td></tr>`));
      res = `<div class="k"><div>Borderôs<b>${L.length}</b></div></div>`;
    }
    const per = de || ate ? `${de ? dd(de) : 'início'} a ${ate ? dd(ate) : 'hoje'}` : 'todo o período', ag = new Date();
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(doc.titulo || 'Relatório')} · Lucas Barros</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1d1b22;background:#fff;margin:0;padding:24px 16px;font-size:13px}main{max-width:900px;margin:0 auto}
header{border-bottom:3px solid #CF1D51;padding-bottom:10px;margin-bottom:14px}header small{color:#CF1D51;font-weight:800;letter-spacing:.2em;font-size:11px}h1{margin:4px 0 2px;font-size:22px}header p{margin:0;color:#6b6676}
h3{margin:18px 0 6px;font-size:14px}.k{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:12px 0}.k div{background:#f5f3f7;border-radius:10px;padding:8px 10px;font-size:11.5px;color:#6b6676}.k b{display:block;font-size:17px;color:#1d1b22;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{text-align:left;padding:6px 6px;border-bottom:1px solid #e6e2ea;vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b6676}.n{text-align:right;white-space:nowrap}tfoot td{font-weight:800;border-top:2px solid #1d1b22}.v{color:#6b6676;text-align:center;padding:16px}
.pos{color:#13804a!important}.neg{color:#c0263f!important}.bt{position:fixed;right:16px;bottom:16px;background:#CF1D51;color:#fff;border:0;border-radius:12px;padding:12px 18px;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.2)}footer{margin-top:18px;color:#8b8697;font-size:11px}
@media(max-width:600px){td,th{padding:5px 3px;font-size:12px}}@media print{.bt{display:none}body{padding:0}}</style></head><body><main>
<header><small>LUCAS BARROS</small><h1>${esc(doc.titulo || 'Relatório')}</h1><p>Período: ${per}${fl ? ' · filtro: “' + esc(doc.filtro) + '”' : ''}</p></header>${res}${corpo}
<footer>Gerado em ${ag.toLocaleDateString('pt-BR')} às ${ag.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} com os dados do app (extrato conferido até a data do último extrato importado).</footer></main>
<button class="bt" onclick="print()">Imprimir / salvar PDF</button></body></html>`;
    const w = window.open('', '_blank'); if (!w) { alert('Libere as janelas (pop-up) para abrir o documento.'); return; } w.document.open(); w.document.write(html); w.document.close();
  }
  window.LBCHAT = { montar, grafico, formata, destaques, texto, auto, limpa, documento, nrm };
})();
