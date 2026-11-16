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
  const BUILD = 'mwiiicdz';
  function versao(base) { // site publicado mais novo que esta página (cache do celular/GitHub)? recarrega uma vez com ?v=nova
    fetch(base + 'versao.json', { cache: 'no-store' }).then(r => r.json()).then(j => {
      if (!j.v || j.v === BUILD || BUILD.startsWith('__')) return;
      const k = 'lb_rv_' + j.v; try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { return; }
      location.replace(location.pathname + '?v=' + j.v + location.hash);
    }).catch(() => { });
  }
  /* chave da senha (PBKDF2, 600 mil rodadas = lento no celular): calcula 1 vez e guarda neste aparelho (o login já fica guardado nele) */
  async function kekDe(u, p, salt, iter) {
    const id = 'lbk_' + hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm(u) + '|' + p + '|' + salt + '|' + iter))).slice(0, 24);
    let raw = store.get(id);
    if (!raw) {
      const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(norm(u) + '|' + p), 'PBKDF2', false, ['deriveBits']);
      raw = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64(salt), iterations: iter, hash: 'SHA-256' }, km, 256))));
      try { const ks = Object.keys(localStorage).filter(x => x.startsWith('lbk_')); if (ks.length > 20) ks.slice(0, ks.length - 20).forEach(x => localStorage.removeItem(x)); } catch (e) { }
      store.set(id, raw);
    }
    return { kek: await crypto.subtle.importKey('raw', b64(raw), 'AES-GCM', false, ['decrypt']), id };
  }
  const RP = '\u0001R:';
  /* abre a página. rec = entrar pela chave reserva (p é a chave); extra = cofre criado pelo Admin depois da última publicação */
  async function abrir(base, pagina, u, p, rec, extra) {
    const j = await (await fetch(base + pagina + '.enc.json', { cache: 'no-store' })).json();
    const k = extra || j.chaves[await slotId(pagina, rec ? u + ' #rec' : u)];
    if (!k) throw new Error('acesso');
    try {
      const { kek, id } = await kekDe(u, p, k.salt, j.iter);
      let raw; try { raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(k.iv) }, kek, b64(k.chave)); } catch (e) { store.del(id); throw e; }
      if (k.rc && !rec) try { store.set('lb_rec', JSON.stringify({ u: norm(u), r: new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(k.ri) }, kek, b64(k.rc))) })); } catch (e) { }
      const dk = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(j.iv) }, dk, b64(j.ct));
      const dados = JSON.parse(new TextDecoder().decode(pt));
      LB.chave = dk; LB.base = base;
      return { dados, paginas: k.paginas || [pagina], nome: k.nome || u };
    } catch (e) { throw new Error('senha'); }
  }
  async function anexo(nomeArq, iv, pasta) {
    const r = await fetch(LB.base + (pasta || 'arquivos') + '/' + nomeArq, { cache: 'no-store' });
    const ct = new Uint8Array(await r.arrayBuffer());
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(iv) }, LB.chave, ct);
  }
  let MENU = null; // última montagem do menu: o "Meu perfil" da API corrige as páginas liberadas sem esperar publicar
  function links(paginas, atual, base) {
    // menu só com as páginas do login; quem tem uma página só (ex.: artista) não vê menu, só o Sair
    MENU = { paginas: paginas.slice(), atual, base };
    const ps = ORDEM.filter(p => paginas.includes(p));
    return (ps.length > 1 ? ps.concat('agenda') : []).map(p =>
      `<a href="${base}${ROTAS[p]}" class="${p === atual ? 'on' : ''}">${NOMES[p]}</a>`).join('') +
      `<a href="#" class="lbav" onclick="LB.perfil();return false" title="Meu perfil" aria-label="Meu perfil"></a>` + (setTimeout(carregar, 0), '');
  }
  /* página pública (Agenda): se a pessoa já entrou neste aparelho, mostra o menu das páginas dela */
  async function menuLogado(el, atual, base) {
    let c = null; try { c = JSON.parse(store.get('lb_cred') || 'null'); } catch (e) { }
    if (!el || !c || !c.u || !c.p) return;
    LB.base = base; LB.login = c.u; LB.senha = c.p;
    let r = null; try { r = await api({ acao: 'meu_perfil' }); } catch (e) { return; }
    if (!r || !r.ok || !Array.isArray(r.paginas)) return;
    LB.usuario = r.nome || r.usuario || c.u;
    const ps = r.paginas.filter(x => ROTAS[x] != null && x !== 'contador' && x !== 'agenda');
    if (!ps.length) return;
    el.innerHTML = ps.length > 1 ? links(ps, atual, base) : ps.concat('agenda').map(p => `<a href="${base}${ROTAS[p]}" class="${p === atual ? 'on' : ''}">${NOMES[p]}</a>`).join('') +
      `<a href="#" class="lbav" onclick="LB.perfil();return false" title="Meu perfil" aria-label="Meu perfil"></a>` + (MENU = { paginas: ps.slice(), atual, base }, setTimeout(carregar, 0), '');
  }
  /* Monta a tela de login e chama ok({dados, paginas, nome}) quando abrir. */
  function entrar(opc) {
    const { pagina, base, titulo, ok } = opc;
    versao(base);
    if (!document.getElementById('lbcss')) {
      const st = document.createElement('style'); st.id = 'lbcss';
      st.textContent = `#lock{position:fixed;inset:0;z-index:50;background:#141218;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif}
#lock form{width:100%;max-width:340px;text-align:center}#lock img{width:180px;margin:0 auto 10px;display:block}
#lock p{color:#B8B3C3;font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;margin:0 0 22px}
#lock input{display:block;width:100%;box-sizing:border-box;background:#1E1C24;border:1px solid #2E2B36;border-radius:12px;padding:14px 16px;color:#F3F1F6;font:inherit;font-size:16px;text-align:center;margin-top:8px}
#lock button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:12px;background:#CF1D51;color:#fff;font:inherit;font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px;cursor:pointer}
#lock .pw{position:relative}#lock .pw input{padding-right:50px;padding-left:50px}#lock .olho{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:auto;margin:4px 0 0;padding:8px 10px;background:transparent;border:0;color:#B8B3C3;font-size:19px;letter-spacing:0;line-height:1}
#lock .err{color:#FF8FA8;font-size:13px;min-height:20px;margin-top:10px}`;
      document.head.appendChild(st);
    }
    const lock = document.createElement('div');
    lock.id = 'lock';
    lock.innerHTML = `<form autocomplete="on"><img src="${base}logo.png" alt="Lucas Barros"><p>${titulo}</p>
      <input name="u" placeholder="Usuário" autocomplete="username" autocapitalize="words" aria-label="Usuário">
      <div class="pw"><input name="p" type="password" placeholder="Senha" autocomplete="current-password" aria-label="Senha"><button type="button" class="olho" aria-label="Mostrar senha" title="Mostrar senha">👁</button></div>
      <button type="submit">Entrar</button><div class="err"></div></form>`;
    document.body.appendChild(lock);
    const f = lock.querySelector('form'), err = lock.querySelector('.err'), olho = lock.querySelector('.olho');
    olho.onclick = () => { const v = f.p.type === 'password'; f.p.type = v ? 'text' : 'password'; olho.textContent = v ? '🙈' : '👁'; olho.setAttribute('aria-label', v ? 'Esconder senha' : 'Mostrar senha'); f.p.focus(); };
    const lu = new URLSearchParams(location.hash.slice(1)).get('u'); if (lu) { f.u.value = lu; setTimeout(() => f.p.focus(), 50); } // link de login: já vem com o usuário
    const tentar = async (u, p, auto) => {
      if (!auto) err.textContent = 'Abrindo…';
      try {
        const r = await abrir2(base, pagina, u, p);
        store.set('lb_cred', JSON.stringify({ u, p }));
        LB.usuario = r.nome; LB.senha = p; LB.login = u;
        lock.remove();
        ok(r);
      } catch (e) {
        if (e.message === 'acesso') { // link único: manda para a primeira página que esse login abre
          for (const pg of ORDEM.filter(x => x !== pagina)) {
            try { await abrir2(base, pg, u, p); store.set('lb_cred', JSON.stringify({ u, p })); location.replace(base + ROTAS[pg]); return; } catch (e2) { if (e2.message === 'senha') break; }
          }
        }
        if (auto) { err.textContent = e.message === 'acesso' ? 'Seu usuário não tem acesso a esta página.' : ''; return; }
        err.textContent = e.message === 'acesso' ? 'Usuário sem acesso a esta página (ou nome digitado diferente).' :
          e.message === 'senha' ? 'Senha incorreta.' : 'Não consegui abrir agora. Tente de novo.';
      }
    };
    f.addEventListener('submit', e => { e.preventDefault(); tentar(f.u.value, f.p.value.trim()); });
    let c = null; try { c = JSON.parse(store.get('lb_cred') || 'null'); } catch (e) { }
    if (c && c.u && (!lu || norm(c.u) === norm(lu))) { f.u.value = c.u; tentar(c.u, c.p, true); }
  }
  function sair() { store.del('lb_cred'); store.del('lb_pf'); try { Object.keys(localStorage).filter(x => x.startsWith('lbk_')).forEach(x => localStorage.removeItem(x)); } catch (e) { } location.reload(); }
  /* ---------- Meu perfil: foto, WhatsApp, e-mail e troca de senha ---------- */
  let CFG = null;
  const cfg = async () => CFG || (CFG = await (await fetch((LB.base || '') + 'config.json', { cache: 'no-store' })).json());
  const api = async o => (await fetch((await cfg()).api_url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ usuario: LB.login, senha: LB.senha, nome: LB.usuario }, o)) })).json();
  const enc64 = b => btoa(String.fromCharCode(...new Uint8Array(b)));
  async function kSenha(u, p, salt, uso) {
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(norm(u) + '|' + p), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, [uso]);
  }
  /* abre o arquivo do site já com o que o Admin mudou (sem esperar publicar):
     senha trocada → "ponte" na API (senha antiga ou chave reserva, cifrada com a senha nova);
     página liberada depois da última publicação → cofre extra na API, aberto com a chave reserva da pessoa */
  async function ponteDe(u, p) {
    const j = await (await fetch((await cfg()).api_url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ acao: 'ponte', usuario: u, senha: p }) })).json();
    if (!j.ok) throw new Error('senha');
    let velha = ''; const x = JSON.parse(j.ponte || 'null');
    if (x) try { velha = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(x.i) }, await kSenha(u, p, b64(x.s), 'decrypt'), b64(x.c))); } catch (e) { }
    return { velha, chaves: j.chaves || {} };
  }
  async function abrir2(base, pagina, u, p) {
    LB.base = base;
    try { const r = await abrir(base, pagina, u, p); LB.senhaCofre = p; return r; }
    catch (e) {
      if (e.message !== 'senha' && e.message !== 'acesso') throw e;
      let pt; try { pt = await ponteDe(u, p); } catch (e2) { throw e; }
      const { velha, chaves } = pt;
      if (e.message === 'senha') {
        if (!velha) throw e;
        const r = velha.startsWith(RP) ? await abrir(base, pagina, u, velha.slice(RP.length), true) : await abrir(base, pagina, u, velha); LB.senhaCofre = velha; return r;
      }
      const x = chaves[pagina]; if (!x) throw e; // sem acesso mesmo
      let rec = velha.startsWith(RP) ? velha.slice(RP.length) : '';
      if (!rec) { try { const c = JSON.parse(store.get('lb_rec') || 'null'); if (c && c.u === norm(u)) rec = c.r; } catch (e3) { } }
      if (!rec) for (const pg of ORDEM.filter(y => y !== pagina)) { // a chave reserva vem guardada no cofre de outra página da pessoa
        for (const sp of [p, velha].filter(Boolean)) { try { await abrir(base, pg, u, sp); const c = JSON.parse(store.get('lb_rec') || 'null'); if (c && c.u === norm(u)) { rec = c.r; break; } } catch (e4) { } }
        if (rec) break;
      }
      if (!rec) throw e;
      const r = await abrir(base, pagina, u, rec, true, x); LB.senhaCofre = velha || p; return r;
    }
  }
  /* Admin: cria o cofre de uma página para alguém que acabou de ganhar acesso (vale na hora; some na próxima publicação) */
  async function cofreExtra(pagina, u, rec) {
    const j = await (await fetch((LB.base || '') + pagina + '.enc.json', { cache: 'no-store' })).json();
    if (j.chaves[await slotId(pagina, u)]) return null; // já tem
    const mc = String(LB.senhaCofre || LB.senha || ''), viaRec = mc.startsWith(RP), k = j.chaves[await slotId(pagina, viaRec ? LB.login + ' #rec' : LB.login)];
    if (!k) return null;
    const { kek } = await kekDe(LB.login, viaRec ? mc.slice(RP.length) : mc, k.salt, j.iter);
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(k.iv) }, kek, b64(k.chave));
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(norm(u) + '|' + rec), 'PBKDF2', false, ['deriveKey']);
    const kk = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: j.iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    return { salt: enc64(salt), iv: enc64(iv), chave: enc64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kk, raw)), nome: u, paginas: [pagina] };
  }
  const ini = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const escH = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PCSS = `a.lbav{flex:none;margin-left:2px;text-decoration:none;font-weight:700;width:32px;height:32px;padding:0!important;border-radius:99px!important;display:flex;align-items:center;justify-content:center;background:#26232D center/cover no-repeat;color:#F3F1F6!important;font-size:11px!important;letter-spacing:0!important;border:1px solid #3a3644!important}
#lbpf{position:fixed;inset:0;z-index:60;background:rgba(10,9,12,.72);display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow:auto;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif}
#lbpf .pc{width:100%;max-width:420px;background:#1E1C24;border:1px solid #2E2B36;border-radius:18px;padding:20px;color:#F3F1F6;position:relative}
#lbpf .px{position:absolute;top:10px;right:12px;background:none;border:0;color:#B8B3C3;font-size:26px;cursor:pointer;line-height:1}
#lbpf .ph{display:flex;gap:14px;align-items:center;margin-bottom:14px}#lbpf .av{width:78px;height:78px;border-radius:99px;background:#26232D center/cover no-repeat;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:700;flex:none;border:2px solid #CF1D51}
#lbpf .ph b{display:block;font-size:18px}#lbpf .ph small{color:#8B8697;font-size:12.5px}
#lbpf .fb{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}#lbpf .fb label,#lbpf .fb a{font-size:13px;color:#F0507E;cursor:pointer;text-decoration:none;border:1px solid #2E2B36;border-radius:99px;padding:6px 12px}
#lbpf h4{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#F0507E;margin:18px 0 8px}
#lbpf .lf{display:block;font-size:12px;color:#B8B3C3;margin-top:8px}#lbpf .lf input{display:block;width:100%;box-sizing:border-box;margin-top:4px;background:#141218;border:1px solid #2E2B36;border-radius:10px;padding:11px 12px;color:#F3F1F6;font:inherit;font-size:15px}
#lbpf .bt{width:100%;margin-top:12px;padding:12px;border:0;border-radius:12px;background:#CF1D51;color:#fff;font:inherit;font-weight:700;font-size:14px;cursor:pointer}#lbpf .bt:disabled{opacity:.5}
#lbpf .bs{background:#26232D;color:#B8B3C3}#lbpf .ms{font-size:13px;min-height:18px;margin-top:8px}#lbpf .ok{color:#7FDDA9}#lbpf .er{color:#FF8FA8}#lbpf .nt{font-size:11.5px;color:#8B8697;margin-top:6px;line-height:1.45}`;
  function css() { if (!document.getElementById('lbpcss')) { const s = document.createElement('style'); s.id = 'lbpcss'; s.textContent = PCSS; document.head.appendChild(s); } }
  let PF = null;
  function pintar() {
    let c = null; try { c = JSON.parse(store.get('lb_pf') || 'null'); } catch (e) { }
    if (c && norm(c.u) === norm(LB.login)) PF = PF || c.pf;
    document.querySelectorAll('.lbav,#lbpf .av').forEach(a => { a.style.backgroundImage = PF && PF.foto ? `url("${PF.foto}")` : ''; a.textContent = PF && PF.foto ? '' : ini(LB.usuario); });
  }
  let buscou = false;
  async function carregar() {
    css(); document.querySelectorAll('.links > a.lbav').forEach(a => { const l = a.parentElement; l.style.marginLeft = 'auto'; l.parentElement.querySelectorAll(':scope > a.lbav').forEach(x => x.remove()); l.after(a); }); // fora da rolagem: sempre visível à direita
    pintar(); if (buscou || !LB.login) return; buscou = true;
    try { const r = await api({ acao: 'meu_perfil' }); if (r.ok) { PF = r; store.set('lb_pf', JSON.stringify({ u: LB.login, pf: { foto: r.foto } })); pintar();
      if (MENU && Array.isArray(r.paginas)) { const nv = r.paginas.filter(x => ROTAS[x] != null && (x !== 'contador' || MENU.paginas.includes('contador'))); // contador só se publicado
        if (nv.join() !== ORDEM.filter(x => MENU.paginas.includes(x)).join() && ORDEM.filter(x => nv.includes(x)).join() !== ORDEM.filter(x => MENU.paginas.includes(x)).join()) {
          const el = document.querySelector('.links'); if (el) { el.innerHTML = links(nv, MENU.atual, MENU.base); setTimeout(() => { css(); document.querySelectorAll('.links > a.lbav').forEach(a => { const l = a.parentElement; l.parentElement.querySelectorAll(':scope > a.lbav').forEach(x => x.remove()); l.after(a); }); pintar(); }, 0); } } } } } catch (e) { }
  }
  function foto(file) { // recorta no centro e reduz para 240×240 (JPEG leve, cabe na planilha)
    return new Promise((ok, no) => {
      const im = new Image(); im.onload = () => {
        const c = document.createElement('canvas'), S = 240, m = Math.min(im.width, im.height); c.width = c.height = S;
        c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, S, S); URL.revokeObjectURL(im.src);
        let q = .85, d = c.toDataURL('image/jpeg', q); while (d.length > 40000 && q > .3) { q -= .1; d = c.toDataURL('image/jpeg', q); } ok(d);
      }; im.onerror = () => no(new Error('img')); im.src = URL.createObjectURL(file);
    });
  }
  async function perfil() {
    css(); document.getElementById('lbpf')?.remove();
    const w = document.createElement('div'); w.id = 'lbpf';
    w.innerHTML = `<div class="pc" role="dialog" aria-label="Meu perfil"><button class="px" aria-label="Fechar">×</button>
      <div class="ph"><div class="av"></div><div><b>${escH(LB.usuario)}</b><small>login: ${escH(LB.login)}<span class="pp"></span></small></div></div>
      <div class="fb"><label>📷 Trocar foto<input type="file" accept="image/*" hidden></label><a href="#" class="rf" style="display:none">Tirar foto</a></div>
      <h4>Contato</h4><label class="lf">WhatsApp<input name="tel" inputmode="tel" placeholder="(00) 00000-0000" maxlength="30"></label>
      <label class="lf">E-mail<input name="em" type="email" placeholder="voce@email.com" maxlength="80"></label>
      <button class="bt bc">Salvar contato</button><div class="ms m1"></div>
      <h4>Trocar senha</h4><form autocomplete="on"><input name="u" autocomplete="username" value="${escH(LB.login)}" hidden>
      <label class="lf">Senha atual<input name="a" type="password" autocomplete="current-password"></label>
      <label class="lf">Senha nova (mínimo 6)<input name="n" type="password" autocomplete="new-password" minlength="6"></label>
      <label class="lf">Repita a senha nova<input name="r" type="password" autocomplete="new-password"></label>
      <button class="bt">Trocar senha</button><div class="ms m2"></div>
      <div class="nt">Depois de trocar, use a senha nova em todos os aparelhos.</div></form>
      <button class="bt bs sa">Sair deste aparelho</button></div>`;
    document.body.appendChild(w); pintar();
    const $ = s => w.querySelector(s), m1 = $('.m1'), m2 = $('.m2'), msg = (el, t, ok) => { el.className = 'ms ' + (ok ? 'ok' : 'er') + (el === m1 ? ' m1' : ' m2'); el.textContent = t; };
    const fechar = () => w.remove();
    $('.px').onclick = fechar; w.onclick = e => { if (e.target === w) fechar(); }; $('.sa').onclick = sair;
    const mostra = r => { $('[name=tel]').value = r.telefone || ''; $('[name=em]').value = r.email || ''; $('.rf').style.display = r.foto ? '' : 'none';
      if (r.papeis) $('.pp').textContent = ' · ' + r.papeis.join(', '); };
    if (PF) mostra(PF);
    try { const r = await api({ acao: 'meu_perfil' }); if (r.ok) { PF = r; mostra(r); pintar(); } else if (r.erro === 'senha') msg(m1, 'Sua senha mudou em outro aparelho: saia e entre de novo.'); } catch (e) { msg(m1, 'Sem conexão agora.'); }
    const salvar = async (o, txt) => {
      msg(m1, 'Salvando…', true);
      try { const r = await api({ acao: 'salvar_meu_perfil', perfil: o }); if (!r.ok) return msg(m1, r.erro === 'senha' ? 'Sua senha mudou: saia e entre de novo.' : (r.erro || 'Não salvou.'));
        PF = r; mostra(r); store.set('lb_pf', JSON.stringify({ u: LB.login, pf: { foto: r.foto } })); pintar(); msg(m1, txt, true); } catch (e) { msg(m1, 'Sem conexão. Tente de novo.'); }
    };
    $('input[type=file]').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      try { await salvar({ foto: await foto(f) }, 'Foto salva ✓'); } catch (er) { msg(m1, 'Não consegui ler essa imagem.'); } };
    $('.rf').onclick = e => { e.preventDefault(); salvar({ foto: '' }, 'Foto removida.'); };
    $('.bc').onclick = () => salvar({ telefone: $('[name=tel]').value, email: $('[name=em]').value }, 'Contato salvo ✓');
    $('form').onsubmit = async e => {
      e.preventDefault(); const f = e.target, a = f.a.value, n = f.n.value.trim(), b = f.querySelector('.bt');
      if (!a) return msg(m2, 'Digite a senha atual.'); if (n.length < 6) return msg(m2, 'A senha nova precisa de pelo menos 6 caracteres.');
      if (n !== f.r.value.trim()) return msg(m2, 'As duas senhas novas estão diferentes.'); if (n === a) return msg(m2, 'A senha nova é igual à atual.');
      b.disabled = true; msg(m2, 'Trocando…', true);
      try {
        const c = await cfg(), pub = await crypto.subtle.importKey('spki', b64(c.chave_pub), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
        const nova_rsa = enc64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pub, new TextEncoder().encode(n)));
        const s = crypto.getRandomValues(new Uint8Array(16)), i = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: i }, await kSenha(LB.login, n, s, 'encrypt'), new TextEncoder().encode(LB.senhaCofre || a));
        const r = await api({ acao: 'trocar_senha', senha: a, nova: n, nova_rsa, ponte: JSON.stringify({ s: enc64(s), i: enc64(i), c: enc64(ct) }) });
        if (!r.ok) { msg(m2, r.erro === 'senha' ? 'Senha atual incorreta.' : (r.erro || 'Não consegui trocar.')); return; }
        LB.senha = n; store.set('lb_cred', JSON.stringify({ u: LB.login, p: n })); f.reset(); msg(m2, 'Senha trocada ✓ Use a nova daqui pra frente.', true);
      } catch (er) { msg(m2, 'Não consegui trocar agora. Tente de novo.'); } finally { b.disabled = false; }
    };
  }
  /* pagamento picado: cada parte do borderô (cachê, diária, gasolina, ajuda, estacionamento) é paga separada.
     e.pagos = {parte: 'AAAA-MM-DD'}; e.status = Pago | Parcial | Pendente (calculado). */
  const PARTES = [['valor', 'cachê'], ['diaria', 'diária'], ['gasolina', 'gasolina'], ['ajuda', 'ajuda de custo'], ['estacionamento', 'estacionamento']];
  const nb = v => { const n = parseFloat(String(v ?? '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return typeof v === 'number' ? v : (isNaN(n) ? 0 : n); };
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
      const pc = pgx.parc(g), sm = r => (pc[r] || []).reduce((a, x) => a + (+x.valor || 0), 0), V = +g.valor || 0;
      const oc = (ref, data) => { const p = Math.round(sm(ref) * 100) / 100; return { ref, data, pago: pago[ref] || '', pg: p, falta: pago[ref] ? 0 : Math.round((V - p) * 100) / 100 }; };
      if (g.tipo !== 'fixo') return g.data && g.data <= ate ? [oc('unico', g.data)] : [];
      if (!/^\d{4}-\d{2}$/.test(g.inicio || '')) return [];
      const out = []; let [y, m] = g.inicio.split('-').map(Number); const lim = g.fim || '9999-99';
      for (let n = 0; n < 240; n++) {
        const k = y + '-' + String(m).padStart(2, '0'); if (k > lim) break;
        const d = k + '-' + String(Math.min(+g.dia || 1, new Date(y, m, 0).getDate())).padStart(2, '0'); if (d > ate) break;
        out.push(oc(k, d)); if (++m > 12) { m = 1; y++; }
      }
      return out;
    },
    parc(g) { try { return JSON.parse(g.parciais || '{}') || {}; } catch (e) { return {}; } },
    /* tudo o que já saiu/entrou de um pagamento: cada parte, ou o valor cheio quando foi pago de uma vez. id = pg-<id>-<ref>[-p<i>] */
    movs(g) {
      let pago = {}; try { pago = JSON.parse(g.pagos || '{}') || {}; } catch (e) { }
      let mi = {}; try { mi = JSON.parse(g.meios || '{}') || {}; } catch (e) { } // conta | dinheiro, escolhido ao marcar pago
      const pc = pgx.parc(g), out = [];
      Object.entries(pc).forEach(([ref, l]) => l.forEach((x, i) => out.push({ id: 'pg-' + g.id + '-' + ref + '-p' + i, ref, i, data: x.data, valor: +x.valor || 0, obs: x.obs || '', parte: true, meio: x.meio || '' })));
      Object.entries(pago).forEach(([ref, q]) => { if (q && !(pc[ref] || []).length) out.push({ id: 'pg-' + g.id + '-' + ref, ref, data: q, valor: +g.valor || 0, meio: mi[ref] || '' }); });
      return out;
    },
    prox(g, hoje) { // próxima data depois de hoje
      if (g.ativo === 'não') return null;
      if (g.tipo !== 'fixo') return g.data > hoje ? { ref: 'unico', data: g.data } : null;
      const t = pgx.ocorr(g, (+hoje.slice(0, 4) + 1) + hoje.slice(4)).find(o => o.data > hoje); return t || null;
    }
  };
  /* Admin trocou a senha de alguém: guarda a chave reserva dessa pessoa cifrada com a senha nova (vale na hora) */
  async function ponteRec(u, nova, rec) { const s = crypto.getRandomValues(new Uint8Array(16)), i = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: i }, await kSenha(u, nova, s, 'encrypt'), new TextEncoder().encode(RP + rec));
    return JSON.stringify({ s: enc64(s), i: enc64(i), c: enc64(ct) }); }
  window.LB = { ponteRec, cofreExtra, entrar, links, menuLogado, anexo, sair, perfil, norm, store, NOMES, pg, pgx };

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
