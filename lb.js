/* Login comum das páginas LB (usuário + senha) e descriptografia dos dados no navegador.
   Cada página tem um arquivo <pagina>.enc.json com os dados cifrados por uma chave aleatória; essa chave é guardada uma vez
   para cada usuário liberado (cifrada com PBKDF2-SHA256(usuário|senha) → AES-GCM). O endereço do "cofre" de cada usuário
   é um hash do nome, então o arquivo público não mostra quem tem acesso. */
(function () {
  const NOMES = { painel: 'Painel', vendas: 'Vendas', agenda: 'Agenda', socio: 'Sócio', contador: 'Prestação de contas', bordero: 'Borderôs', admin: 'Admin', metas: 'Metas' };
  const ROTAS = { painel: '', vendas: 'vendas/', agenda: 'agenda/', socio: 'socio/', contador: 'contador/', bordero: 'borderos/', admin: 'admin/', metas: 'metas/' };
  const ORDEM = ['painel', 'admin', 'bordero', 'vendas', 'metas', 'socio', 'contador'];
  const norm = u => String(u || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };
  async function slotId(pagina, u) {
    return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('lb|' + pagina + '|' + norm(u)))).slice(0, 20);
  }
  async function abrir(base, pagina, u, p) {
    const j = await (await fetch(base + pagina + '.enc.json', { cache: 'no-store' })).json();
    const k = j.chaves[await slotId(pagina, u)];
    if (!k) throw new Error('acesso');
    try {
      const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(norm(u) + '|' + p), 'PBKDF2', false, ['deriveKey']);
      const kek = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(k.salt), iterations: j.iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(k.iv) }, kek, b64(k.chave));
      const dk = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(j.iv) }, dk, b64(j.ct));
      const dados = JSON.parse(new TextDecoder().decode(pt));
      LB.chave = dk; LB.base = base;
      return { dados, paginas: k.paginas || [pagina], nome: k.nome || u };
    } catch (e) { throw new Error('senha'); }
  }
  /* Arquivo anexo cifrado com a mesma chave da página (prestação de contas). */
  async function anexo(nomeArq, iv, pasta) {
    const r = await fetch(LB.base + (pasta || 'arquivos') + '/' + nomeArq, { cache: 'no-store' });
    const ct = new Uint8Array(await r.arrayBuffer());
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(iv) }, LB.chave, ct);
  }
  function links(paginas, atual, base) {
    // menu só com as páginas do login; quem tem uma página só (ex.: artista) não vê menu, só o Sair
    const ps = ORDEM.filter(p => paginas.includes(p));
    return (ps.length > 1 ? ps.concat('agenda') : []).map(p =>
      `<a href="${base}${ROTAS[p]}" class="${p === atual ? 'on' : ''}">${NOMES[p]}</a>`).join('') +
      `<a href="#" onclick="LB.sair();return false" title="Sair"${ps.length > 1 ? '' : ' style="opacity:.55;font-size:11px;border:0;background:none"'}>Sair</a>`;
  }
  /* Monta a tela de login e chama ok({dados, paginas, nome}) quando abrir. */
  function entrar(opc) {
    const { pagina, base, titulo, ok } = opc;
    if (!document.getElementById('lbcss')) {
      const st = document.createElement('style'); st.id = 'lbcss';
      st.textContent = `#lock{position:fixed;inset:0;z-index:50;background:#141218;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif}
#lock form{width:100%;max-width:340px;text-align:center}#lock img{width:180px;margin:0 auto 10px;display:block}
#lock p{color:#B8B3C3;font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;margin:0 0 22px}
#lock input{display:block;width:100%;box-sizing:border-box;background:#1E1C24;border:1px solid #2E2B36;border-radius:12px;padding:14px 16px;color:#F3F1F6;font:inherit;font-size:16px;text-align:center;margin-top:8px}
#lock button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:12px;background:#CF1D51;color:#fff;font:inherit;font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px;cursor:pointer}
#lock .err{color:#FF8FA8;font-size:13px;min-height:20px;margin-top:10px}`;
      document.head.appendChild(st);
    }
    const lock = document.createElement('div');
    lock.id = 'lock';
    lock.innerHTML = `<form autocomplete="on"><img src="${base}logo.png" alt="Lucas Barros"><p>${titulo}</p>
      <input name="u" placeholder="Usuário" autocomplete="username" autocapitalize="words" aria-label="Usuário">
      <input name="p" type="password" placeholder="Senha" autocomplete="current-password" aria-label="Senha">
      <button type="submit">Entrar</button><div class="err"></div></form>`;
    document.body.appendChild(lock);
    const f = lock.querySelector('form'), err = lock.querySelector('.err');
    const tentar = async (u, p, auto) => {
      if (!auto) err.textContent = 'Abrindo…';
      try {
        const r = await abrir(base, pagina, u, p);
        store.set('lb_cred', JSON.stringify({ u, p }));
        LB.usuario = r.nome; LB.senha = p; LB.login = u;
        lock.remove();
        ok(r);
      } catch (e) {
        if (e.message === 'acesso') { // link único: manda para a primeira página que esse login abre
          for (const pg of ORDEM.filter(x => x !== pagina)) {
            try { await abrir(base, pg, u, p); store.set('lb_cred', JSON.stringify({ u, p })); location.replace(base + ROTAS[pg]); return; } catch (e2) { if (e2.message === 'senha') break; }
          }
        }
        if (auto) { err.textContent = e.message === 'acesso' ? 'Seu usuário não tem acesso a esta página.' : ''; return; }
        err.textContent = e.message === 'acesso' ? 'Usuário sem acesso a esta página (ou nome digitado diferente).' :
          e.message === 'senha' ? 'Senha incorreta.' : 'Não consegui abrir agora. Tente de novo.';
      }
    };
    f.addEventListener('submit', e => { e.preventDefault(); tentar(f.u.value, f.p.value.trim()); });
    let c = null; try { c = JSON.parse(store.get('lb_cred') || 'null'); } catch (e) { }
    if (c && c.u) { f.u.value = c.u; tentar(c.u, c.p, true); }
  }
  function sair() { store.del('lb_cred'); location.reload(); }
  /* pagamento picado: cada parte do borderô (cachê, diária, gasolina, ajuda, estacionamento) é paga separada.
     e.pagos = {parte: 'AAAA-MM-DD'}; e.status = Pago | Parcial | Pendente (calculado). */
  const PARTES = [['valor', 'cachê'], ['diaria', 'diária'], ['gasolina', 'gasolina'], ['ajuda', 'ajuda de custo'], ['estacionamento', 'estacionamento']];
  const nb = v => { const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.')); return typeof v === 'number' ? v : (isNaN(n) ? 0 : n); };
  const pg = {
    PARTES,
    partes: e => PARTES.filter(([k]) => nb(e[k]) > 0).map(([k, n]) => ({ k, n, v: nb(e[k]), pago: e.status === 'Pago' && !(e.pagos && Object.keys(e.pagos).length) ? true : !!(e.pagos && e.pagos[k]), em: e.pagos && e.pagos[k] })),
    falta: e => e.fora ? 0 : pg.partes(e).filter(p => !p.pago).reduce((a, p) => a + p.v, 0),
    marca(e, ks, data, pago = true) {  // ks: lista de partes ou 'tudo'
      if (e.status === 'Pago' && !(e.pagos && Object.keys(e.pagos).length)) { e.pagos = {}; pg.partes({ ...e, status: '' }).forEach(p => e.pagos[p.k] = e.pago_em || data); }
      e.pagos = e.pagos || {};
      (ks === 'tudo' ? PARTES.map(p => p[0]) : ks).forEach(k => { if (nb(e[k]) > 0) { if (pago) e.pagos[k] = e.pagos[k] || data; else delete e.pagos[k]; } });
      const ps = pg.partes({ ...e, status: '' }), n = ps.filter(p => p.pago).length;
      e.status = !ps.length ? (pago ? 'Pago' : 'Pendente') : n === ps.length ? 'Pago' : n ? 'Parcial' : 'Pendente';
      return e;
    }
  };
  /* pagamentos avulsos e fixos (página Admin): ocorrências até a data "ate"; ref = 'unico' ou 'AAAA-MM' */
  const pgx = {
    ocorr(g, ate) {
      let pago = {}; try { pago = JSON.parse(g.pagos || '{}') || {}; } catch (e) { }
      if (g.tipo !== 'fixo') return g.data && g.data <= ate ? [{ ref: 'unico', data: g.data, pago: pago.unico || '' }] : [];
      if (!/^\d{4}-\d{2}$/.test(g.inicio || '')) return [];
      const out = []; let [y, m] = g.inicio.split('-').map(Number); const lim = g.fim || '9999-99';
      for (let n = 0; n < 240; n++) {
        const k = y + '-' + String(m).padStart(2, '0'); if (k > lim) break;
        const d = k + '-' + String(Math.min(+g.dia || 1, new Date(y, m, 0).getDate())).padStart(2, '0'); if (d > ate) break;
        out.push({ ref: k, data: d, pago: pago[k] || '' }); if (++m > 12) { m = 1; y++; }
      }
      return out;
    },
    prox(g, hoje) { // próxima data depois de hoje
      if (g.ativo === 'não') return null;
      if (g.tipo !== 'fixo') return g.data > hoje ? { ref: 'unico', data: g.data } : null;
      const t = pgx.ocorr(g, (+hoje.slice(0, 4) + 1) + hoje.slice(4)).find(o => o.data > hoje); return t || null;
    }
  };
  window.LB = { entrar, links, anexo, sair, norm, store, NOMES, pg, pgx };

  /* "Ver mais": toda lista longa (.list) e todo grupo de borderô (.gp) mostra só os primeiros itens.
     Limite: data-max no elemento (padrão 5 em listas, 4 em grupos). data-max="0" desliga. */
  const st = document.createElement('style');
  st.textContent = '.vmh{display:none!important}.vmb{display:block;width:100%;margin:8px 0 0;padding:10px;border:1px dashed var(--line,#2E2B36);border-radius:10px;background:transparent;color:var(--pinkl,#F0507E);font:inherit;font-size:13px;font-weight:600;cursor:pointer}';
  document.head.appendChild(st);
  function colapsa(l) {
    const n = l.dataset.max !== undefined ? +l.dataset.max : (l.classList.contains('gp') ? 4 : 5);
    if (!n) return;
    const it = [...l.children].filter(c => !c.classList.contains('vmb') && !/^H[1-6]$/.test(c.tagName) && !c.classList.contains('empty'));
    const ult = l.lastElementChild;
    if (ult && ult.classList.contains('vmb') && ult.dataset.n == it.length) return; // já tratado
    l.querySelectorAll(':scope>.vmb').forEach(b => b.remove());
    if (it.length <= n + 1) { it.forEach(c => c.classList.remove('vmh')); return; }
    const aberto = l.dataset.aberto === '1';
    it.forEach((c, i) => c.classList.toggle('vmh', !aberto && i >= n));
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vmb'; b.dataset.n = it.length;
    b.textContent = aberto ? 'Ver menos' : `Ver mais (${it.length - n})`;
    b.addEventListener('click', e => { e.stopPropagation(); l.dataset.aberto = aberto ? '' : '1'; b.remove(); colapsa(l); });
    l.appendChild(b);
  }
  let vmT = null;
  const vmTudo = () => document.querySelectorAll('.list, .gp').forEach(l => { if (!l.closest('[data-semvm]')) colapsa(l); });
  new MutationObserver(() => { clearTimeout(vmT); vmT = setTimeout(vmTudo, 40); }).observe(document.documentElement, { childList: true, subtree: true });
})();
