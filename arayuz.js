// Arayüz: açılış ekranı, oda şeridi, kat planı / menü / ev bilgisi panelleri, ipucu, paylaşım.
// Görüntüleyiciyle (app.js) yalnızca `api` üzerinden konuşur.
const $ = (s) => document.querySelector(s);
const el = (etiket, sinif, metin) => {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metin != null) e.textContent = metin;
  return e;
};
const IKON = {
  ev: '<svg viewBox="0 0 24 24"><path d="M3 10l9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  tel: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/></svg>',
  tam: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  bas: '<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/><circle cx="12" cy="12" r="4"/></svg>',
  paylas: '<svg viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>',
};
const m2yaz = (v) => v.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' m²';
const kucuk = (s) => s.toLocaleLowerCase('tr-TR');

export function arayuzKur(api) {
  const { tur, byId } = api;
  const proje = tur.proje;
  const katlar = tur.katlar;
  const katById = new Map(katlar.map((k) => [k.id, k]));
  const cokKat = katlar.length > 1;
  let aktifKat = katlar[0].id;      // oda şeridinde gösterilen kat
  let planKat = aktifKat;           // plan panelinde açık kat
  let bilgiKat = aktifKat;          // ev bilgisinde açık kat
  const telefon = proje.telefon ? String(proje.telefon) : null;
  const waNo = proje.whatsapp ? String(proje.whatsapp).replace(/\D/g, '') : null;

  // ---------- küçük yardımcılar
  let sonSurukleme = 0;
  const tiklamaYut = () => performance.now() - sonSurukleme < 400;
  let bildirimZ = 0;
  function bildir(s) {
    const b = $('#bildirim'); b.textContent = s; b.classList.add('var');
    clearTimeout(bildirimZ); bildirimZ = setTimeout(() => b.classList.remove('var'), 2400);
  }
  const ipucuAnahtar = 'tur.ipucu.v1';
  const oku = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const yaz = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

  // dışarı taşan (kapalı paneller) öğeler sayfayı kaydırmasın
  for (const e of [document.body, document.documentElement]) e.addEventListener('scroll', () => { e.scrollTop = 0; e.scrollLeft = 0; });

  // ---------- açılış
  const acilis = $('#acilis');
  $('#projeAd').textContent = proje.ad || '';
  $('#projeAlt').textContent = proje.aciklama || '';
  if (proje.logo || proje.muteahhit) {
    $('#logo').hidden = false;
    if (proje.logo) { const li = $('#logoImg'); li.src = proje.logo; li.hidden = false; li.alt = proje.muteahhit || ''; }
    else $('#logoAd').textContent = proje.muteahhit;
  }
  $('#kapak').addEventListener('error', () => { $('#kapak').style.display = 'none'; });
  let turdayiz = false;
  function turaGec() {
    if (turdayiz) return;
    turdayiz = true;
    acilis.classList.add('git');
    setTimeout(() => { acilis.hidden = true; }, 500);
    if (!oku(ipucuAnahtar)) { $('#ipucu').hidden = false; }
  }
  $('#basla').addEventListener('click', turaGec);

  // ---------- ipucu: ilk dokunuşta kaybolur, sonraki açılışlarda görünmez
  function ilkDokunus() {
    const ip = $('#ipucu');
    if (ip.hidden || !turdayiz) return;
    ip.classList.add('git');
    yaz(ipucuAnahtar, '1');
    setTimeout(() => { ip.hidden = true; }, 380);
  }

  // ---------- WhatsApp / telefon
  const wa = $('#wa');
  function waGuncelle(n) {
    if (!waNo) return;
    const metin = `${proje.ad} turundan yazıyorum, ${n.ad} hakkında bilgi almak istiyorum.`;
    wa.href = `https://wa.me/${waNo}?text=${encodeURIComponent(metin)}`;
  }
  if (waNo) wa.hidden = false;

  // ---------- oda şeridi + kat seçici
  const cipler = $('#cipler');
  const katDugme = $('#katDugme');
  const katMenu = $('#katMenu');
  function seritKur() {
    cipler.textContent = '';
    for (const id of katById.get(aktifKat).noktalar) {
      const n = byId.get(id);
      const b = el('button', null, n.kisa || n.ad);
      b.type = 'button'; b.dataset.id = id;
      b.addEventListener('click', () => api.git(id));
      cipler.appendChild(b);
    }
    katDugme.textContent = katById.get(aktifKat).ad + ' ▾';
    const c = api.cur(); if (c) seritAktif(c.id, false);
  }
  function seritAktif(id, kaydir = true) {
    for (const b of cipler.children) {
      const a = b.dataset.id === id;
      b.classList.toggle('aktif', a);
      if (a && kaydir) cipler.scrollTo({ left: b.offsetLeft - (cipler.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
    }
  }
  if (cokKat) {
    katDugme.hidden = false;
    katDugme.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!katMenu.hidden) { katMenu.hidden = true; return; }
      katMenu.textContent = '';
      for (const k of katlar) {
        const b = el('button', k.id === aktifKat ? 'aktif' : '', k.ad); b.type = 'button';
        b.addEventListener('click', () => {
          katMenu.hidden = true;
          if (k.id === aktifKat) return;
          aktifKat = k.id; seritKur();
          const c = api.cur();
          if (!c || c.kat !== k.id) api.git(k.noktalar[0]);
        });
        katMenu.appendChild(b);
      }
      katMenu.hidden = false;
    });
    document.addEventListener('pointerdown', (e) => { if (!katMenu.hidden && !katMenu.contains(e.target) && e.target !== katDugme) katMenu.hidden = true; });
  }

  // ---------- paneller (geri hareketi paneli kapatır)
  const paneller = { plan: $('#p-plan'), menu: $('#p-menu'), bilgi: $('#p-bilgi') };
  const karartma = $('#karartma');
  let acik = null;
  function gorselKapat() {
    if (!acik) return;
    const p = paneller[acik];
    p.style.transform = ''; p.classList.remove('acik'); p.setAttribute('aria-hidden', 'true');
    karartma.classList.remove('acik');
    acik = null;
    const c = api.cur();
    try { history.replaceState(history.state, '', '#' + encodeURIComponent(c ? c.id : '')); } catch (_) {}
  }
  function panelAc(ad) {
    if (acik === ad) return;
    if (acik) { paneller[acik].classList.remove('acik'); paneller[acik].setAttribute('aria-hidden', 'true'); }
    else { try { history.pushState({ tur: 'panel' }, ''); } catch (_) {} }
    acik = ad;
    hazirla[ad]();
    paneller[ad].classList.add('acik'); paneller[ad].setAttribute('aria-hidden', 'false');
    karartma.classList.add('acik');
    katMenu.hidden = true;
  }
  function panelKapat() {
    if (!acik) return;
    if (history.state && history.state.tur === 'panel') history.back(); // popstate görseli kapatır
    else gorselKapat();
  }
  window.addEventListener('popstate', () => { if (acik) gorselKapat(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') panelKapat(); });
  karartma.addEventListener('click', () => { if (!tiklamaYut()) panelKapat(); });

  // aşağı çekince kapat (tutamaç bölgesinden)
  for (const [ad, p] of Object.entries(paneller)) {
    const tutac = p.querySelector('.tutac');
    let b = null;
    tutac.addEventListener('pointerdown', (e) => {
      b = { y: e.clientY, t: performance.now(), dy: 0 };
      tutac.setPointerCapture(e.pointerId); p.style.transition = 'none';
    });
    tutac.addEventListener('pointermove', (e) => {
      if (!b) return;
      b.dy = Math.max(0, e.clientY - b.y);
      p.style.transform = `translateY(${b.dy}px)`;
    });
    const bitir = (iptal) => {
      if (!b) return;
      const hiz = b.dy / Math.max(1, performance.now() - b.t);
      const kapat = !iptal && (b.dy > 90 || (hiz > 0.6 && b.dy > 30));
      if (b.dy > 10) sonSurukleme = performance.now();
      p.style.transition = '';
      if (kapat) panelKapat(); else p.style.transform = '';
      b = null;
    };
    tutac.addEventListener('pointerup', () => bitir(false));
    tutac.addEventListener('pointercancel', () => bitir(true));
    tutac.addEventListener('click', () => { if (!sonSurukleme || performance.now() - sonSurukleme > 400) panelKapat(); });
  }

  // ---------- kat planı paneli
  let koniEl = null, koniAci = -1;
  function koniStil(acik) {
    koniEl.style.background = `conic-gradient(from ${-acik / 2}deg, rgba(224,176,122,.8) 0deg ${acik}deg, transparent ${acik}deg)`;
  }
  function planHazirla() {
    const kap = paneller.plan.querySelector('.icerik');
    kap.textContent = '';
    const c = api.cur();
    if (cokKat) {
      const sk = el('div', 'sekme');
      for (const k of katlar) {
        const b = el('button', k.id === planKat ? 'aktif' : '', k.ad); b.type = 'button';
        b.addEventListener('click', () => { planKat = k.id; planHazirla(); });
        sk.appendChild(b);
      }
      kap.appendChild(sk);
    }
    const kat = katById.get(planKat);
    const kutu = el('div', 'plan');
    kutu.style.setProperty('--oran', kat.plan.genislik / kat.plan.yukseklik);
    kutu.style.background = kat.plan.zemin_renk || '#222';
    const im = el('img'); im.src = kat.plan.img; im.alt = kat.ad + ' planı'; im.draggable = false;
    kutu.appendChild(im);
    koniEl = null; koniAci = -1;
    const burada = c && c.kat === planKat ? c : null;
    if (burada && burada.plan) {
      koniEl = el('div', 'koni');
      koniEl.style.left = burada.plan.x * 100 + '%'; koniEl.style.top = burada.plan.y * 100 + '%';
      kutu.appendChild(koniEl);
    }
    for (const id of kat.noktalar) {
      const n = byId.get(id);
      if (!n.plan) continue;
      const ben = burada && n.id === burada.id;
      const b = el('button', 'nok' + (ben ? ' ben' : '') + (n.plan.dis ? ' dis' : '')); b.type = 'button';
      b.style.left = n.plan.x * 100 + '%'; b.style.top = n.plan.y * 100 + '%';
      b.setAttribute('aria-label', n.ad);
      b.append(el('i'), el('span', null, ben ? 'Buradasınız' : (n.kisa || n.ad)));
      b.addEventListener('click', () => {
        if (tiklamaYut()) return;
        if (!ben) { api.git(n.id); aktifKat = n.kat; if (cokKat) seritKur(); }
        panelKapat();
      });
      kutu.appendChild(b);
    }
    kap.appendChild(kutu);
    kap.appendChild(el('div', 'panelalt', 'Bir noktaya dokun, oraya geç. Panel aşağı çekilince kapanır.'));
    kare();
  }
  function kare() { // her karede: yelpaze bakış yönüyle döner
    if (acik !== 'plan' || !koniEl) return;
    const { yaw, yatayFov } = api.bakisBilgi();
    const acikAci = Math.round(Math.min(120, Math.max(30, yatayFov)));
    if (acikAci !== koniAci) { koniAci = acikAci; koniStil(acikAci); }
    koniEl.style.transform = `rotate(${yaw.toFixed(1)}deg)`;
  }

  // ---------- menü
  function satir(ikon, metin, kucukYazi, etiket = 'button') {
    const s = el(etiket, 'satir');
    if (etiket === 'button') s.type = 'button';
    s.innerHTML = ikon;
    s.appendChild(document.createTextNode(metin));
    if (kucukYazi) s.appendChild(el('small', null, kucukYazi));
    return s;
  }
  async function paylas() {
    const c = api.cur();
    const taban = (proje.yayin_adresi && String(proje.yayin_adresi)) || (location.origin + location.pathname);
    const url = taban + (c ? '#' + encodeURIComponent(c.id) : '');
    const veri = { title: proje.ad, text: `${proje.ad} sanal turu`, url };
    if (navigator.share) {
      try { await navigator.share(veri); } catch (_) { /* vazgeçildi */ }
      return;
    }
    try { await navigator.clipboard.writeText(url); bildir('Link kopyalandı'); }
    catch (_) {
      const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); bildir('Link kopyalandı'); } catch (__) { bildir(url); }
      t.remove();
    }
  }
  function menuHazirla() {
    const kap = paneller.menu.querySelector('.icerik');
    kap.textContent = '';
    const bilgi = satir(IKON.ev, 'Ev bilgisi', 'm², odalar');
    bilgi.addEventListener('click', () => { const c = api.cur(); if (c) bilgiKat = c.kat; panelAc('bilgi'); });
    kap.appendChild(bilgi);
    if (telefon) {
      const a = satir(IKON.tel, 'Satış ofisini ara', null, 'a');
      a.href = 'tel:' + telefon.replace(/[^\d+]/g, ''); kap.appendChild(a);
    }
    if (waNo) {
      const a = satir(IKON.wa, "WhatsApp'tan yaz", null, 'a');
      a.target = '_blank'; a.rel = 'noopener';
      const c = api.cur();
      a.href = `https://wa.me/${waNo}?text=${encodeURIComponent(`${proje.ad} turundan yazıyorum.` + (c ? ` ${c.ad} hakkında bilgi almak istiyorum.` : ''))}`;
      kap.appendChild(a);
    }
    if (document.fullscreenEnabled) {
      const t = satir(IKON.tam, document.fullscreenElement ? 'Tam ekrandan çık' : 'Tam ekran');
      t.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
        panelKapat();
      });
      kap.appendChild(t);
    }
    const bas = satir(IKON.bas, 'Odayı baştan göster');
    bas.addEventListener('click', () => { api.bakisSifirla(); panelKapat(); });
    kap.appendChild(bas);
    const pay = satir(IKON.paylas, 'Turu paylaş');
    pay.addEventListener('click', () => { paylas(); panelKapat(); }); // paylaşma izni dokunuşla birlikte istenmeli: önce çağrılır
    kap.appendChild(pay);
    kap.appendChild(el('div', 'surum', `Görseller temsilidir; son hâli projeye göre değişebilir. · Sürüm ${tur.surum || 1}`));
  }
  document.addEventListener('fullscreenchange', () => setTimeout(api.boyutla, 100));

  // ---------- ev bilgisi
  function bilgiHazirla() {
    const kap = paneller.bilgi.querySelector('.icerik');
    kap.textContent = '';
    const toplam = katlar.reduce((t, k) => t + (k.m2 || 0), 0);
    kap.appendChild(el('div', 'rakam', Math.round(toplam) + ' m²'));
    kap.appendChild(el('div', 'tek', proje.ozet || ''));
    const kutular = el('div', 'kutular');
    for (const k of katlar) {
      const b = el('button', k.id === bilgiKat ? 'aktif' : ''); b.type = 'button';
      b.append(el('b', null, String(Math.round(k.m2 || 0))), el('span', null, k.ad));
      b.addEventListener('click', () => { bilgiKat = k.id; bilgiHazirla(); });
      kutular.appendChild(b);
    }
    kap.appendChild(kutular);
    const odalar = el('div', 'odalar');
    for (const o of tur.odalar.filter((o) => o.kat === bilgiKat)) {
      const d = el('div'); d.append(el('span', null, o.ad), el('span', null, m2yaz(o.m2)));
      odalar.appendChild(d);
    }
    kap.appendChild(odalar);
  }

  const hazirla = { plan: planHazirla, menu: menuHazirla, bilgi: bilgiHazirla };
  $('#planDugme').addEventListener('click', () => { const c = api.cur(); if (c) planKat = c.kat; panelAc('plan'); });
  $('#menuDugme').addEventListener('click', () => panelAc('menu'));

  seritKur();

  return {
    ilkDokunus,
    kare,
    hedefSecildi(id) { seritAktif(id); },
    odaDegisti(n) {
      $('#odaAd').textContent = n.ad;
      $('#katAd').textContent = katById.get(n.kat).ad;
      if (aktifKat !== n.kat) { aktifKat = n.kat; seritKur(); }
      seritAktif(n.id);
      waGuncelle(n);
    },
  };
}
