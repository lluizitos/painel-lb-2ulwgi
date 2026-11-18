/* Login comum das páginas LB (usuário + senha) e descriptografia dos dados no navegador.
   Cada página tem um arquivo <pagina>.enc.json com os dados cifrados por uma chave aleatória; essa chave é guardada uma vez
   para cada usuário liberado (cifrada com PBKDF2-SHA256(usuário|senha) → AES-GCM). O endereço do "cofre" de cada usuário
   é um hash do nome, então o arquivo público não mostra quem tem acesso. */
(function () {
  const NOMES = { artista: 'Artista', painel: 'Financeiro', vendas: 'Vendas', agenda: 'Agenda', socio: 'Sócio', contador: 'Prestação de contas', bordero: 'Borderôs', admin: 'Admin', metas: 'Metas' };
  const ROTAS = { artista: 'artista/', painel: '', vendas: 'vendas/', agenda: 'agenda/', socio: 'socio/', contador: 'contador/', bordero: 'borderos/', admin: 'admin/', metas: 'metas/' };
  const ORDEM = ['painel', 'artista', 'admin', 'bordero', 'vendas', 'metas', 'socio', 'contador'];
  /* Lucas e sócio: página única e simples, sem menu de páginas (o Financeiro do Lucas é um link separado) */
  const semMenu = ps => !ps.includes('admin') && !ps.includes('artista') && ps.includes('socio'); // só o sócio fica sem menu
  /* Lucas (artista sem admin): menu normal, mas a Agenda só aparece se o Luiz ligar em Admin → Parâmetros; o Financeiro dele abre com #financeiro */
  const ehArt = ps => ps.includes('artista') && !ps.includes('admin');
  const hrefPg = (p, ps, base) => base + ROTAS[p] + (p === 'painel' && ehArt(ps) ? '#financeiro' : '');
  /* a raiz do site é o Financeiro; o Lucas entrando pela raiz vai para a página Artista (o link do Financeiro dele leva #financeiro) */
  const vaiArtista = (pagina, ps) => pagina === 'painel' && ps.includes('artista') && !ps.includes('admin') && !/financeiro/i.test(location.hash + location.search);
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
  const BUILD = 'mwmqnhu3';
  function versao(base) { // site publicado mais novo que esta página (cache do celular/GitHub)? recarrega uma vez com ?v=nova
    fetch(base + 'versao.json', { cache: 'no-store' }).then(r => r.json()).then(j => {
      if (!j.v || j.v === BUILD || BUILD.startsWith('__')) return;
      const k = 'lb_rv_' + j.v; try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch (e) { return; }
      location.replace(location.pathname + '?v=' + j.v + location.hash);
    }).catch(() => { });
  }
  /* 17/11: site deixado aberto no celular. Ao VOLTAR para ele (trocou de app, bloqueou a tela, voltou pelo "voltar"):
     - fora 3 min ou mais: confere se saiu versão nova do site (arquivo pequeno do GitHub, não gasta a API) e recarrega se saiu;
     - fora 30 min ou mais: recarrega a página para trazer os dados novos (umas poucas chamadas à API, só nessa hora).
     Não recarrega se a pessoa estiver digitando ou com uma janela de edição aberta. */
  let saiuEm = 0, BASE0 = null; // BASE0: página com login (guardado ao entrar)
  const ocupado = () => { const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.value) return true;
    return !!document.querySelector('.sheet.on,.sh.on,[aria-hidden="false"].on,#lbpf,dialog[open]'); };
  function aoVoltar(min) {
    if (BASE0 === null) return;
    if (min >= 30 && !ocupado()) { location.reload(); return; }
    if (min >= 3) versao(BASE0);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { saiuEm = Date.now(); return; }
    if (saiuEm) { const m = (Date.now() - saiuEm) / 6e4; saiuEm = 0; aoVoltar(m); }
  });
  addEventListener('pageshow', e => { if (e.persisted) aoVoltar(saiuEm ? (Date.now() - saiuEm) / 6e4 : 3); });
  addEventListener('pagehide', () => { saiuEm = saiuEm || Date.now(); });
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
    const ps = semMenu(paginas) ? [] : ORDEM.filter(p => paginas.includes(p));
    const ag = !ehArt(paginas) || store.get('lb_menu_ag') === '1'; if (ehArt(paginas)) setTimeout(menuAg, 0);
    return (ps.length > 1 ? (ag ? ps.concat('agenda') : ps) : []).map(p =>
      `<a href="${hrefPg(p, paginas, base)}" class="${p === atual ? 'on' : ''}">${NOMES[p]}</a>`).join('') +
      `<a href="#" class="lbav" onclick="LB.perfil();return false" title="Meu perfil" aria-label="Meu perfil"></a>` + (setTimeout(carregar, 0), '');
  }
  /* opção do Admin: Agenda no menu do Lucas (vale a partir da próxima página aberta) */
  async function menuAg() { try { const r = await api({ acao: 'config_site' }); if (r.ok) store.set('lb_menu_ag', r.menu_agenda ? '1' : '0'); } catch (e) { } }
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
    versao(base); BASE0 = base;
    if (!document.getElementById('lbcss')) {
      const st = document.createElement('style'); st.id = 'lbcss';
      st.textContent = `#lock{position:fixed;inset:0;z-index:50;background:#141218;display:flex;align-items:center;justify-content:center;padding:24px;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif}
#lock form{width:100%;max-width:340px;text-align:center}#lock img{width:180px;margin:0 auto 10px;display:block}
#lock p{color:#B8B3C3;font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;margin:0 0 22px}
#lock input{display:block;width:100%;box-sizing:border-box;background:#1E1C24;border:1px solid #2E2B36;border-radius:12px;padding:14px 16px;color:#F3F1F6;font:inherit;font-size:16px;text-align:center;margin-top:8px}
#lock button{width:100%;margin-top:12px;padding:14px;border:0;border-radius:12px;background:#CF1D51;color:#fff;font:inherit;font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:13px;cursor:pointer}
#lock .pw{position:relative}#lock .pw input{padding-right:50px;padding-left:50px}#lock .olho{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:auto;margin:4px 0 0;padding:8px 10px;background:transparent;border:0;color:#B8B3C3;font-size:19px;letter-spacing:0;line-height:1}
#lock .err{color:#FF8FA8;font-size:13px;min-height:20px;margin-top:10px}
#lock.auto form>*:not(img):not(.spl){display:none}#lock .spl{display:none}#lock.auto .spl{display:block;width:26px;height:26px;margin:14px auto 0;border:3px solid #2E2B36;border-top-color:#CF1D51;border-radius:99px;animation:lbsp .8s linear infinite}@keyframes lbsp{to{transform:rotate(360deg)}}
#lock.claro{background:#fff}#lock.claro .spl{border-color:#eee;border-top-color:#E0115F}`;
      document.head.appendChild(st);
    }
    const lock = document.createElement('div');
    lock.id = 'lock';
    lock.innerHTML = `<form autocomplete="on"><img src="${base}logo.png" alt="Lucas Barros"><p>${pagina === 'painel' ? 'Entrar' : titulo}</p>
      <input name="u" placeholder="Usuário" autocomplete="username" autocapitalize="words" aria-label="Usuário">
      <div class="pw"><input name="p" type="password" placeholder="Senha" autocomplete="current-password" aria-label="Senha"><button type="button" class="olho" aria-label="Mostrar senha" title="Mostrar senha"></button></div>
      <button type="submit">Entrar</button><div class="err"></div><div class="spl" aria-label="Abrindo"></div></form>`;
    document.body.appendChild(lock);
    const f = lock.querySelector('form'), err = lock.querySelector('.err'), olho = lock.querySelector('.olho');
    const IC_OLHO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>', IC_RISC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block"><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.5M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>'; olho.innerHTML = IC_OLHO;
    olho.onclick = () => { const v = f.p.type === 'password'; f.p.type = v ? 'text' : 'password'; olho.innerHTML = v ? IC_RISC : IC_OLHO; olho.setAttribute('aria-label', v ? 'Esconder senha' : 'Mostrar senha'); f.p.focus(); };
    const lu = new URLSearchParams(location.hash.slice(1)).get('u'); if (lu) { f.u.value = lu; setTimeout(() => f.p.focus(), 50); } // link de login: já vem com o usuário
    const tentar = async (u, p, auto) => {
      if (!auto) err.textContent = 'Abrindo…';
      try {
        const r = await abrir2(base, pagina, u, p);
        store.set('lb_cred', JSON.stringify({ u, p })); store.set('lb_pgs', JSON.stringify({ u: norm(u), p: r.paginas || [] }));
        if (vaiArtista(pagina, r.paginas || [])) { location.replace(base + ROTAS.artista); return; }
        LB.usuario = r.nome; LB.senha = p; LB.login = u;
        lock.remove();
        ok(r);
      } catch (e) {
        if (e.message === 'acesso') { // link único: manda para a primeira página que esse login abre
          if (!auto) err.textContent = 'Abrindo a sua página…';
          // primeiro as páginas em que o login está no arquivo do site (rápido); depois as outras (liberadas pelo Admin depois da última publicação)
          const tem = []; for (const pg of ORDEM.filter(x => x !== pagina)) { try { const j = await (await fetch(base + pg + '.enc.json', { cache: 'no-store' })).json(); if (j.chaves && j.chaves[await slotId(pg, u)]) tem.push(pg); } catch (e3) { } }
          for (const pg of tem.concat(ORDEM.filter(x => x !== pagina && !tem.includes(x)))) {
            try { await abrir2(base, pg, u, p); store.set('lb_cred', JSON.stringify({ u, p })); location.replace(base + ROTAS[pg]); return; } catch (e2) { if (e2.message === 'senha') break; }
          }
        }
        if (auto) { lock.classList.remove('auto', 'claro'); err.textContent = e.message === 'acesso' ? 'Seu usuário não tem acesso a esta página.' : ''; return; }
        err.textContent = e.message === 'acesso' ? 'Usuário sem acesso a esta página (ou nome digitado diferente).' :
          e.message === 'senha' ? 'Senha incorreta.' : 'Não consegui abrir agora. Tente de novo.';
      }
    };
    f.addEventListener('submit', e => { e.preventDefault(); tentar(f.u.value, f.p.value.trim()); });
    let c = null; try { c = JSON.parse(store.get('lb_cred') || 'null'); } catch (e) { }
    if (c && c.u && (!lu || norm(c.u) === norm(lu))) {
      /* já entrou neste aparelho: nada de tela de login, só o logo girando enquanto abre (e a raiz manda o Lucas direto para Artista) */
      let pg = null; try { pg = JSON.parse(store.get('lb_pgs') || 'null'); } catch (e) { }
      if (pg && pg.u === norm(c.u) && vaiArtista(pagina, pg.p || [])) { location.replace(base + ROTAS.artista); return; }
      lock.classList.add('auto'); if (opc.claro) lock.classList.add('claro'); f.u.value = c.u; tentar(c.u, c.p, true); }
  }
  function sair() { store.del('lb_cred'); store.del('lb_pf'); store.del('lb_pgs'); try { Object.keys(localStorage).filter(x => x.startsWith('lbk_')).forEach(x => localStorage.removeItem(x)); } catch (e) { } location.reload(); }
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
      try { const r = await abrir(base, pagina, u, p, false, x); LB.senhaCofre = p; return r; } catch (e6) { } // 16/11: login novo — o Admin fez o cofre com a senha dela (vale na hora)
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
    /* quando pagar (borderô → "Quando pagar"): b.pag = {show, diaria, gasolina} (datas; vazio = junto com o cachê / no dia do show);
       e.pag_em = pagamento antecipado (ou em outra data) só daquela pessoa, vale para todas as partes dela */
    venc: (b, e, k) => (e && e.pag_em) || ((b.pag || {})[k === 'diaria' || k === 'gasolina' ? k : 'show']) || (b.pag || {}).show || b.data,
    agendado: (b, e) => !!((e && e.pag_em) || (b.pag && (b.pag.show || b.pag.diaria || b.pag.gasolina))),
    // partes ainda não pagas, agrupadas pela data em que vencem (até "ate", se vier): [{d, ps, f}]
    pend(b, e, ate) { if (e.fora) return []; const G = {}; pg.partes(e).filter(p => !p.pago).forEach(p => { const d = pg.venc(b, e, p.k); if (ate && d > ate) return; (G[d] = G[d] || []).push(p); });
      return Object.keys(G).sort().map(d => ({ d, ps: G[d], f: G[d].reduce((a, p) => a + p.v, 0) })); },
    // pagamentos da equipe do borderô por data de vencimento (calendário): [{d, tot, falta}]
    porData(b) { const G = {}; (b.equipe || []).forEach(e => { if (e.fora || e.grupo === 'Comissão') return; pg.partes(e).forEach(p => { const d = pg.venc(b, e, p.k), x = G[d] = G[d] || { d, tot: 0, falta: 0 }; x.tot += p.v; if (!p.pago) x.falta += p.v; }); });
      return Object.values(G).sort((x, y) => x.d < y.d ? -1 : 1); },
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

  /* ---------- gráfico padrão (formato do Vendas): barras arredondadas, número em cima, mês atual destacado, ano embaixo, linhas por cima ----------
     series=[{nome,cor,vals,tipo}] tipo: 'barra' (padrão) · 'contorno' (só a borda: marcados/previstos) · 'linha' (ex.: saldo; hoje: texto na legenda)
     o: modo 'lado' · ks (AAAA-MM, põe o ano) · hi (coluna destacada) · media (média de 3 meses) · est (a partir dessa coluna = estimativa) · fmt · tfmt · nomes · semLeg · h · rot:false */
  function grafico(labels, series, o = {}) {
    if (!document.getElementById('lbg-css')) { const st = document.createElement('style'); st.id = 'lbg-css';
      st.textContent = '.lbg{background:var(--card,#1E1C24);border-radius:14px;padding:14px 12px 8px}.lbg svg{display:block;width:100%;max-width:540px;height:auto;margin:0 auto}.lbg-leg{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:12.5px;color:var(--sub,#B8B3C3);padding:0 4px 8px}.lbg-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}.lbg-leg b{color:var(--ink,#F3F1F6)}.lbg-tip{font-size:13px;color:var(--sub,#B8B3C3);min-height:20px;padding:4px 4px 0}.lbg.plano{background:none;padding:4px 0 0;border-radius:0}.lbg.plano svg{max-width:400px;margin:0}.lbg.plano .lbg-tip{font-size:12px;min-height:16px}';
      document.head.appendChild(st);
      document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-lbt]'); if (t) { const x = t.closest('.lbg').querySelector('.lbg-tip'); if (x) x.textContent = t.dataset.lbt; } });
      document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-lbt]'); if (t) { const x = t.closest('.lbg').querySelector('.lbg-tip'); if (x) x.textContent = t.dataset.lbt; } }); }
    const es = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const n = labels.length, W = 360, H = o.h || (o.plano ? (o.ks ? 128 : 112) : (o.ks ? 178 : 160)), pl = 8, pr = 8, pt = 18, pb = o.ks ? 30 : 20, cw = (W - pl - pr) / Math.max(1, n), fmt = o.fmt || (v => v), tf = o.tfmt || fmt, lado = o.modo === 'lado';
    const B = series.filter(s => s.tipo !== 'linha'), L = series.filter(s => s.tipo === 'linha'), V = (s, i) => Math.max(0, +s.vals[i] || 0);
    const tot = labels.map((_, i) => B.reduce((a, s) => a + V(s, i), 0));
    const lv = L.flatMap(s => s.vals.filter(v => v != null && isFinite(v)).map(Number));
    const mx = Math.max(1, ...(lado ? labels.flatMap((_, i) => B.map(s => V(s, i))) : tot), ...lv), mn = Math.min(0, ...lv), ph = H - pt - pb, y = v => pt + ph * (mx - v) / (mx - mn), y0 = y(0);
    let g = '', tx = ''; const pass = n > 14, est = o.est != null && o.est >= 0 ? o.est : n;
    if (est < n) g += `<rect x="${pl + est * cw}" y="${pt - 12}" width="${(n - est) * cw}" height="${ph + 12}" fill="#CF1D51" opacity=".06"/><text x="${pl + est * cw + 4}" y="${pt - 2}" font-size="9" font-weight="700" letter-spacing="1" fill="#F0507E">ESTIMATIVA</text>`;
    labels.forEach((l, i) => { const x0 = pl + i * cw, op = i >= est ? ' opacity=".6"' : '';
      if (i === o.hi) g += `<rect x="${x0}" y="${pt - 12}" width="${cw}" height="${ph + 12}" fill="#F3F1F6" opacity=".06"/>`;
      if (lado) { const k = B.length, gw = Math.min(cw * .8, k * (o.plano ? 12 : 16)), bw = gw / k; B.forEach((s, j) => { const v = V(s, i); if (v) g += `<rect x="${x0 + (cw - gw) / 2 + j * bw + .8}" y="${y(v)}" width="${Math.max(1, bw - 1.6)}" height="${y0 - y(v)}" rx="2.5" fill="${s.cor}"${op}/>`; }); }
      else { const bw = Math.max(4, Math.min(cw * .62, o.plano ? 22 : 30)), bx = x0 + (cw - bw) / 2;
        const ct = B.find(s => s.tipo === 'contorno'); if (ct && tot[i]) g += `<rect x="${bx}" y="${y(tot[i])}" width="${bw}" height="${y0 - y(tot[i])}" rx="3" fill="none" stroke="${ct.cor}" stroke-width="1.3"/>`;
        let a = 0; B.filter(s => s.tipo !== 'contorno').forEach(s => { const v = V(s, i); if (!v) return; g += `<rect x="${bx}" y="${y(a + v)}" width="${bw}" height="${y(a) - y(a + v)}" rx="3" fill="${s.cor}"${op}/>`; a += v; });
        if (o.rot !== false && tot[i]) tx += `<text x="${bx + bw / 2}" y="${y(tot[i]) - 4}" text-anchor="middle" font-size="9.5" fill="#B8B3C3" stroke="#1E1C24" stroke-width="2.5" paint-order="stroke">${fmt(tot[i])}</text>`; }
      if (!pass || i % 2 === 0 || i === o.hi) g += `<text x="${x0 + cw / 2}" y="${H - pb + 15}" text-anchor="middle" font-size="9.5" font-weight="${i === o.hi ? 700 : 400}" fill="${i === o.hi ? '#F0507E' : '#8B8697'}">${es(l)}</text>`;
      if (o.ks && (i === 0 || String(o.ks[i]).slice(5) === '01')) g += `<text x="${x0 + cw / 2}" y="${H - 3}" text-anchor="middle" font-size="8.5" fill="#8B8697">${String(o.ks[i]).slice(0, 4)}</text>`; });
    g += `<line x1="${pl}" x2="${W - pr}" y1="${y0}" y2="${y0}" stroke="#3A3644"/>`;
    if (o.media) { const pts = []; labels.forEach((_, i) => { if (o.hi != null && o.hi >= 0 && i > o.hi) return; const j = [i, i - 1, i - 2].filter(q => q >= 0); pts.push(`${pl + i * cw + cw / 2},${y(j.reduce((a, q) => a + tot[q], 0) / j.length)}`); });
      if (pts.length > 1) g += `<polyline points="${pts.join(' ')}" fill="none" stroke="#F2B66B" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`; }
    L.forEach(s => { const P = labels.map((_, i) => s.vals[i] == null || !isFinite(s.vals[i]) ? null : [pl + i * cw + cw / 2, y(+s.vals[i]), i]).filter(Boolean);
      const pp = P.map(p => p[0] + ',' + p[1]).join(' ');
      if (P.length > 1) g += `<polyline points="${pp}" fill="none" stroke="${s.cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      P.forEach(p => g += `<circle cx="${p[0]}" cy="${p[1]}" r="2" fill="${+s.vals[p[2]] < 0 ? '#FF8FA8' : s.cor}"/>`); });
    g += tx;
    labels.forEach((l, i) => { const ss = series.filter(s => s.vals[i] != null && (s.tipo === 'linha' || +s.vals[i])); const t = (o.nomes ? o.nomes[i] : l) + (i >= est ? ' (estimativa)' : '') + ': ' + (ss.length ? ss.map(s => s.nome + ' ' + tf(+s.vals[i])).join(' · ') : 'nada');
      g += `<rect x="${pl + i * cw}" y="0" width="${cw}" height="${H}" fill="#F3F1F6" opacity="0" data-lbt="${es(t)}" style="cursor:pointer"/>`; });
    const leg = `<div class="lbg-leg">${series.filter(s => s.nome).map(s => `<span><i style="${s.tipo === 'linha' ? `background:${s.cor};border-radius:99px;height:3px;vertical-align:3px;width:14px` : s.tipo === 'contorno' ? `background:transparent;border:1.5px solid ${s.cor}` : `background:${s.cor}`}"></i>${es(s.nome)}${s.hoje ? ` <b>${es(s.hoje)}</b>` : ''}</span>`).join('')}${o.media ? `<span><i style="background:#F2B66B;border-radius:99px;height:3px;vertical-align:3px;width:14px"></i>Média de 3 meses</span>` : ''}</div>`;
    return `<div class="lbg${o.plano ? ' plano' : ''}">${o.semLeg ? '' : leg}<svg viewBox="0 0 ${W} ${H}" role="img">${g}</svg><div class="lbg-tip">${es(o.dica || 'Toque numa barra para ver os valores.')}</div></div>`;
  }
  window.LB = { ponteRec, cofreExtra, entrar, links, menuLogado, anexo, sair, perfil, norm, store, NOMES, pg, pgx, grafico };

  /* "Ver mais": toda lista longa (.list) e todo grupo de borderô (.gp) mostra só os primeiros itens.
     Limite: data-max no elemento (padrão 5 em listas, 4 em grupos). data-max="0" desliga. */
  const st = document.createElement('style'); st.id = 'lbvm';
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

/* ícones monocromáticos (traço na cor do texto) — LB.ic('show') */
(function(){const P={
  show:'<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  pag:'<circle cx="12" cy="12" r="9"/><path d="M14.8 9.3c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.8.8-2.8 2s1.2 1.6 2.8 1.9 2.8.8 2.8 2-1.2 2-2.8 2c-1.3 0-2.4-.5-2.9-1.4M12 6.2v1.7M12 16.1v1.7"/>',
  tar:'<rect x="4" y="4" width="16" height="16" rx="3.5"/><path d="M8.5 12.3l2.4 2.4 4.6-4.9"/>',
  emp:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  sino:'<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  alerta:'<path d="M12 3.5L2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17.2v.1"/>',
  recibo:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  pino:'<path d="M9 3h6l-1 6 3 3H7l3-3z"/><path d="M12 12v9"/>',
  agenda:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  saida:'<rect x="3" y="7" width="18" height="12" rx="2.5"/><path d="M12 3v9M8.5 6.5L12 3l3.5 3.5"/>',
  jornal:'<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h4"/>',
  ok:'<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7 5.3-5.6"/>',
  caixa:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/>'};
  LB.ic=(n,c)=>P[n]?`<svg class="ico${c?' '+c:''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`:'';
  const st=document.createElement('style');st.id='lbico';st.textContent='.ico{width:1em;height:1em;display:inline-block;vertical-align:-.15em;flex:none}';document.head.appendChild(st)})();

/* 16/11: Financeiro embutido (aba Financeiro do Artista e aba Gestão do sócio).
   Lê as telas e o código da página do Financeiro publicada (../index.html) e roda dentro de box, isolado (shadow DOM),
   com os dados r já abertos pela página. o.api(acao) responde às chamadas ao servidor (sem ela, vão ao servidor normalmente);
   o.css = estilo extra. */
(function () {
  const carregaJs = src => new Promise((ok, no) => { const e = document.createElement('script'); e.src = src; e.onload = ok; e.onerror = no; document.head.appendChild(e); });
  LB.financeiro = async function (box, r, o) {
    o = o || {}; box.innerHTML = '<div style="padding:20px;color:#8B8697">Abrindo o financeiro…</div>';
    const sv = (document.querySelector('script[src*="lb.js"]') || { getAttribute: () => '' }).getAttribute('src') || '', v = sv.split('?v=')[1] || '';
    const html = await (await fetch((o.pagina || '../index.html') + (v ? '?v=' + v : ''), { cache: 'no-store' })).text(); // o.pagina: outra página do site (ex.: ../socio/index.html para a aba Vendas do Artista)
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const ajusta = t => t.replace(/href="(vendas|metas|tarefas|agenda|borderos|admin|artista|socio)\//g, 'href="../$1/')
      .replace(/onclick="fecharBord\(\)"/g, 'onclick="window.__finFecha&&window.__finFecha()"')
      .replace(/onclick="const s=document\.getElementById\('bds'\)/g, "onclick=\"const s=this.getRootNode().getElementById('bds')");
    const css = [...doc.querySelectorAll('style')].map(x => x.textContent).join('\n').replace(/:root/g, ':host').replace(/(^|[^\w.#-])html\b/g, '$1:host').replace(/(^|[^\w.#-])body\b/g, '$1.fbody');
    const code = ajusta([...doc.querySelectorAll('script:not([src])')].map(x => x.textContent).join('\n;\n')) + '\n;try{window.__finFecha=fecharBord}catch(e){}';
    doc.querySelectorAll('script').forEach(x => x.remove());
    if (!window.LBV) await carregaJs('../lbvendas.js' + (v ? '?v=' + v : ''));
    if (!window.LBROT) await carregaJs('../lbmetas.js' + (v ? '?v=' + v : ''));
    const host = document.createElement('div'); box.innerHTML = ''; box.appendChild(host);
    const root = host.attachShadow({ mode: 'open' }), fb = document.createElement('div'); fb.className = 'fbody'; fb.innerHTML = ajusta(doc.body.innerHTML);
    const st = document.createElement('style'); st.textContent = css + `
.fbody{min-height:0!important;padding-top:0!important;background:transparent!important}
.fbody header .wrap,.fbody #lbq{display:none!important}.fbody header{position:static!important;top:auto!important;background:transparent!important;border:0!important}
.fbody main.wrap{padding-left:0!important;padding-right:0!important}` + (o.css || '');
    root.append(st, fb);
    /* estilos que o lb.js (e lbmetas/lbvendas) põem no <head> da página — ícones, gráficos, "ver mais"... — também valem aqui dentro
       (o bloco isolado não enxerga o <head>); os que forem criados depois também são copiados */
    const copiados = new Set(), copia = () => document.head.querySelectorAll('style[id^="lb"]').forEach(x => { if (copiados.has(x.id)) return; copiados.add(x.id); const c = document.createElement('style'); c.textContent = x.textContent; root.insertBefore(c, fb); });
    copia(); new MutationObserver(copia).observe(document.head, { childList: true });
    const doDoc = new Set(['keydown', 'keyup', 'visibilitychange']);
    const corpo = new Proxy(fb, { get: (t, k) => k === 'style' ? document.body.style : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
    const fd = { getElementById: id => root.getElementById(id), querySelector: q => root.querySelector(q), querySelectorAll: q => root.querySelectorAll(q),
      createElement: (...a) => document.createElement(...a), execCommand: (...a) => document.execCommand(...a), body: corpo, head: document.head, documentElement: document.documentElement,
      addEventListener: (t, f, x) => (doDoc.has(t) ? document : root).addEventListener(t, f, x), removeEventListener: (t, f, x) => (doDoc.has(t) ? document : root).removeEventListener(t, f, x),
      get activeElement() { return root.activeElement || document.activeElement; }, set title(x) { }, get title() { return document.title; }, get hidden() { return document.hidden; }, get visibilityState() { return document.visibilityState; } };
    const fLB = Object.assign(Object.create(LB), { entrar: x => setTimeout(() => x.ok(r), 0), links: () => '', usuario: LB.usuario || r.nome || 'sócio' });
    const fFetch = async (u, x) => {
      if (o.api && x && x.method === 'POST') { let a = ''; try { a = JSON.parse(x.body).acao; } catch (e) { } return new Response(JSON.stringify(o.api(a) || { ok: false, erro: 'sem acesso' })); }
      return fetch(typeof u === 'string' && !/^(https?:|\/|\.\.\/)/.test(u) ? '../' + u : u, x);
    };
    new Function('document', 'LB', 'fetch', code)(fd, fLB, fFetch);
    return root;
  };
})();

/* 18/11: AVISO PRINCIPAL (Admin → Empresa, "Despesa prevista" com "avisar no painel"): cartão no topo do Artista e do Sócio,
   tela com o orçamento inteiro (detalhes no formato "## seção" / "- item: R$ valor") e link direto: <página>/#orc */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const brl = v => 'R$ ' + (+v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const css = () => { if (document.getElementById('lborc')) return; const st = document.createElement('style'); st.id = 'lborc'; st.textContent = `
.orcc{display:block;width:100%;text-align:left;font:inherit;color:#F3F1F6;cursor:pointer;margin:14px 0 16px;padding:16px 16px 14px;border-radius:16px;border:1px solid rgba(240,80,126,.45);
  background:linear-gradient(135deg,rgba(207,29,81,.22),rgba(207,29,81,.05) 60%),#1E1C24;box-shadow:0 8px 28px rgba(207,29,81,.18)}
.orcc .ol{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#F0507E}
.orcc .ol i{font-style:normal;background:#CF1D51;color:#fff;border-radius:99px;padding:3px 9px;letter-spacing:.08em}
.orcc h3{margin:8px 0 2px!important;font-size:19px!important;font-weight:800;line-height:1.25;color:#F3F1F6!important;letter-spacing:0!important;text-transform:none!important}
.orcc .os{font-size:13px;color:#B8B3C3}.orcc .ov{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:12px;flex-wrap:wrap}
.orcc .ov b{font-size:26px;font-weight:800;color:#F3F1F6;letter-spacing:-.01em}.orcc .ov small{font-size:12.5px;color:#B8B3C3}
.orcc .ob{margin-top:12px;display:inline-flex;align-items:center;gap:6px;background:#CF1D51;color:#fff;border-radius:10px;padding:9px 14px;font-weight:700;font-size:13.5px}
#orcv{position:fixed;inset:0;z-index:70;background:rgba(10,9,12,.78);display:flex;align-items:flex-start;justify-content:center;padding:18px 12px;overflow:auto;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif}
#orcv .op{width:100%;max-width:560px;background:#1E1C24;border:1px solid #2E2B36;border-radius:18px;padding:20px 18px;color:#F3F1F6;position:relative}
#orcv .ox{position:absolute;top:10px;right:12px;background:none;border:0;color:#B8B3C3;font-size:28px;cursor:pointer;line-height:1}
#orcv .ol{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#F0507E}
#orcv h2{margin:6px 30px 4px 0;font-size:21px;font-weight:800;line-height:1.25}#orcv .os{font-size:13px;color:#B8B3C3;margin-bottom:14px}
#orcv .ok{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 14px}#orcv .ok div{background:#26232D;border-radius:12px;padding:10px 12px;border-top:3px solid #CF1D51}
#orcv .ok small{display:block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8B8697;margin-bottom:3px}#orcv .ok b{font-size:18px;font-weight:800}
#orcv .ok .g{border-top-color:#7FDDA9}#orcv .ok .g b{color:#7FDDA9}
#orcv .lbq{margin:0}#orcv .qt{background:none!important;padding:0!important;border-radius:0!important;border:0!important;display:block!important}#orcv .orf{font-size:12px;color:#8B8697;margin-top:14px;border-top:1px solid #2E2B36;padding-top:10px}
#orcv .ocp{margin-top:12px;border:1px solid #2E2B36;background:#26232D;color:#F3F1F6;border-radius:10px;padding:9px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}`;
    document.head.appendChild(st); };
  /* m = {id, titulo, alvo, valor, prazo, situacao, texto|progresso} */
  function card(m) { css(); if (!m) return '';
    return `<button type="button" class="orcc" data-orc="${esc(m.id || '')}"><div class="ol"><span>Aviso principal · orçamento</span><i>${esc(m.situacao || 'Previsto')}</i></div>
      <h3>${esc(m.titulo)}</h3>${m.alvo ? `<div class="os">${esc(m.alvo)}</div>` : ''}
      <div class="ov">${m.valor ? `<b>${brl(m.valor)}</b>` : ''}${m.prazo ? `<small>${esc(m.prazo)}</small>` : ''}</div><span class="ob">Ver orçamento completo →</span></button>`; }
  function fecha() { const v = document.getElementById('orcv'); if (v) v.remove(); document.body.style.overflow = ''; if (/^#orc/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); }
  function abre(m, base) { css(); fecha(); if (!m) return;
    const det = String(m.texto || m.progresso || ''), fm = window.LBCHAT && LBCHAT.formata;
    const tot = (det.match(/Orçamento[^:\n]*:\s*R\$\s?([\d.,]+)/i) || [])[1], fe = (det.match(/Fechado[^:\n]*:\s*R\$\s?([\d.,]+)/i) || [])[1];
    const v = document.createElement('div'); v.id = 'orcv';
    const link = location.origin + location.pathname.replace(/[^/]*$/, '') + '#orc';
    v.innerHTML = `<div class="op"><button class="ox" aria-label="Fechar">×</button><div class="ol">Orçamento</div><h2>${esc(m.titulo)}</h2>${m.alvo ? `<div class="os">${esc(m.alvo)}</div>` : ''}
      ${tot || fe ? `<div class="ok">${tot ? `<div><small>Orçamento</small><b>R$ ${esc(tot)}</b></div>` : ''}${fe ? `<div class="g"><small>Valor fechado</small><b>R$ ${esc(fe)}</b></div>` : ''}</div>` : (m.valor ? `<div class="ok"><div><small>Valor</small><b>${brl(m.valor)}</b></div></div>` : '')}
      <div class="lbq"><div class="qt fm">${fm ? fm(det) : `<p style="white-space:pre-line">${esc(det)}</p>`}</div></div>
      <div class="orf">${esc(m.situacao || 'Previsto')}${m.prazo ? ' · ' + esc(m.prazo) : ''}</div>
      <button class="ocp" type="button">Copiar link deste orçamento</button></div>`;
    document.body.appendChild(v); document.body.style.overflow = 'hidden';
    v.onclick = e => { if (e.target === v || e.target.closest('.ox')) fecha();
      const c = e.target.closest('.ocp'); if (c) { try { navigator.clipboard.writeText(link); c.textContent = 'Link copiado ✓'; } catch (er) { c.textContent = link; } } };
    if (!/^#orc/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search + '#orc'); }
  /* el = onde mostrar o cartão; lista = itens; abre sozinho se o link tiver #orc */
  function mostra(el, lista) { if (!el) return; const m = (lista || [])[0]; el.innerHTML = m ? card(m) : '';
    el.onclick = e => { if (e.target.closest('[data-orc]')) abre(m); };
    if (m && /^#orc/.test(location.hash) && !document.getElementById('orcv')) abre(m); }
  addEventListener('keydown', e => { if (e.key === 'Escape') fecha(); });
  LB.orc = { card, abre, mostra, fecha };
})();
