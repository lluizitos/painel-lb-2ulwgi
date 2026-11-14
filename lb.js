/* Login comum das páginas LB (usuário + senha) e descriptografia dos dados no navegador.
   Cada página tem um arquivo <pagina>.enc.json com os dados cifrados por uma chave aleatória; essa chave é guardada uma vez
   para cada usuário liberado (cifrada com PBKDF2-SHA256(usuário|senha) → AES-GCM). O endereço do "cofre" de cada usuário
   é um hash do nome, então o arquivo público não mostra quem tem acesso. */
(function () {
  const NOMES = { painel: 'Painel', vendas: 'Vendas', agenda: 'Agenda', socio: 'Sócio', contador: 'Prestação de contas' };
  const ROTAS = { painel: '', vendas: 'vendas/', agenda: 'agenda/', socio: 'socio/', contador: 'contador/' };
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
  async function anexo(nomeArq, iv) {
    const r = await fetch(LB.base + 'arquivos/' + nomeArq, { cache: 'no-store' });
    const ct = new Uint8Array(await r.arrayBuffer());
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(iv) }, LB.chave, ct);
  }
  function links(paginas, atual, base) {
    const ordem = ['painel', 'vendas', 'socio', 'contador', 'agenda'];
    return ordem.filter(p => p === 'agenda' || paginas.includes(p)).map(p =>
      `<a href="${base}${ROTAS[p]}" class="${p === atual ? 'on' : ''}">${NOMES[p]}</a>`).join('') +
      `<a href="#" onclick="LB.sair();return false" title="Sair">Sair</a>`;
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
  window.LB = { entrar, links, anexo, sair, norm, store, NOMES };
})();
