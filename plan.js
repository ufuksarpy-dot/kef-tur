// Tam ekran kat planı (Matterport "floor plan" gibi): koyu zemin, katın mobilyalı tepeden görüntüsü,
// her odada ad + m², bulunulan nokta + bakış konisi, dokununca git, üstte kat seçimi, X ile kapanır.
// Bahçe: bahçesi olan katlarda "Bahçe" düğmesi planı uzaklaştırıp bahçeyi gösterir (2 mod).
import { m2yaz } from './bicim.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (etiket, sinif, metin) => {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metin != null) e.textContent = metin;
  return e;
};
const KAPAT_IKON = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

export function planKur({ tur, byId, git, kapat, cur, bakisBilgi }) {
  const katlar = tur.katlar;
  let kat = katlar[0].id;
  let bahce = false;
  let kok = null, alan = null, sahne = null, koni = null, boyut = { w: 0, h: 0, w0: 0, h0: 0 };
  const gor = { z: 1, x: 0, y: 0 };          // yakınlaştırma ve kaydırma (piksel)

  const katBul = (id) => katlar.find((k) => k.id === id);

  function sigdir() {
    const k = katBul(kat);
    const g = bahce && k.bahce ? k.bahce : k.plan;
    const oran = g.genislik / g.yukseklik;
    const w0 = alan.clientWidth, h0 = alan.clientHeight;
    let w = w0, h = w / oran;
    if (h > h0) { h = h0; w = h * oran; }
    boyut = { w, h, w0, h0 };
    sahne.style.width = w + 'px'; sahne.style.height = h + 'px';
    sinirla();
    uygula();
  }
  function sinirla() {
    gor.z = Math.max(1, Math.min(6, gor.z));
    const { w, h, w0, h0 } = boyut;
    const minX = Math.min(0, w0 - w * gor.z), maxX = Math.max(0, w0 - w * gor.z);
    const minY = Math.min(0, h0 - h * gor.z), maxY = Math.max(0, h0 - h * gor.z);
    gor.x = w * gor.z <= w0 ? (w0 - w * gor.z) / 2 : Math.max(minX, Math.min(maxX, gor.x));
    gor.y = h * gor.z <= h0 ? (h0 - h * gor.z) / 2 : Math.max(minY, Math.min(maxY, gor.y));
  }
  function uygula() {
    sahne.style.transform = `translate(${gor.x.toFixed(1)}px, ${gor.y.toFixed(1)}px) scale(${gor.z.toFixed(3)})`;
    sahne.style.setProperty('--z', gor.z.toFixed(3));
  }

  function ciz() {
    const c = cur();
    const k = katBul(kat);
    kok.textContent = '';

    // üst çubuk: kat seçimi, kapat
    const ust = el('div', 'pt-ust');
    const sekme = el('div', 'pt-sekme');
    // 20.11 Ufuk: bahçe (ve giriş avlusu) kat sekmelerinin arasında, ait olduğu katın hemen yanında
    for (const x of katlar) {
      const b = el('button', 'pt-cip' + (x.id === kat && !bahce ? ' ak' : ''), x.ad); b.type = 'button';
      b.addEventListener('click', () => { kat = x.id; bahce = false; gor.z = 1; ciz(); });
      sekme.appendChild(b);
      if (x.bahce) {
        const bb = el('button', 'pt-cip' + (x.id === kat && bahce ? ' ak' : ''), x.bahce.ad); bb.type = 'button';
        bb.addEventListener('click', () => { kat = x.id; bahce = true; gor.z = 1; ciz(); });
        sekme.appendChild(bb);
      }
    }
    ust.appendChild(sekme);
    kok.appendChild(ust);
    // telefonda sekmeler yana kayar: seçili sekme görünür olsun, sonraki sekme de kenardan biraz görünsün
    const sec = sekme.querySelector('.ak');
    if (sec) requestAnimationFrame(() => {
      sekme.scrollLeft = Math.max(0, sec.offsetLeft - (sekme.clientWidth - sec.offsetWidth) / 2);
    });
    // ikinci satır: yalnız kapat (sağda)
    const sat = el('div', 'pt-sat');
    const xb = el('button', 'pt-kapat'); xb.type = 'button'; xb.setAttribute('aria-label', 'Planı kapat'); xb.innerHTML = KAPAT_IKON;
    xb.addEventListener('click', kapat);
    sat.appendChild(xb);
    kok.appendChild(sat);

    alan = el('div', 'pt-alan');
    sahne = el('div', 'pt-sahne');
    const g = bahce && k.bahce ? k.bahce : k.plan;
    sahne.style.background = k.plan.zemin_renk || '#222';
    const im = el('img'); im.src = g.img; im.alt = (bahce ? k.bahce.ad : k.ad) + ' planı'; im.draggable = false;
    sahne.appendChild(im);

    const burada = c && c.kat === k.id ? c : null;
    let konuYer = null;   // bakış konisinin yeri (0..1)
    if (!bahce) {
      // oda alanları (dokununca o odaya git) + etiketler
      const oran = g.yukseklik / g.genislik;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'pt-alanlar'); svg.setAttribute('viewBox', '0 0 1000 ' + (1000 * oran).toFixed(1)); svg.setAttribute('preserveAspectRatio', 'none');
      const odalar = tur.odalar.filter((o) => o.kat === k.id);
      for (const o of odalar) {
        const ilk = k.noktalar.map((i) => byId.get(i)).find((n) => n.oda === o.id);
        if (!ilk) continue;
        const p = document.createElementNS(NS, 'polygon');
        p.setAttribute('points', o.poligon.map((q) => `${(q[0] * 1000).toFixed(1)},${(q[1] * 1000 * oran).toFixed(1)}`).join(' '));
        p.dataset.git = ilk.id;
        svg.appendChild(p);
      }
      sahne.appendChild(svg);
      for (const o of odalar) {
        const e = el('div', 'pt-et');
        let [ex, ey] = o.yer;
        for (const id of k.noktalar) {   // etiket bir noktanın (halka) üstüne düşmesin: nokta etiketin yanına/altına
          const n = byId.get(id);
          if (!n.plan || n.plan.dis || n.oda !== o.id) continue;
          if (Math.abs(n.plan.x - ex) < 0.07 && Math.abs(n.plan.y - ey) * oran < 0.045) ey = n.plan.y + 0.045 / oran + 0.02;
        }
        e.style.left = ex * 100 + '%'; e.style.top = ey * 100 + '%';
        e.append(el('b', null, o.ad));
        if (o.m2 != null) e.append(el('span', null, m2yaz(o.m2)));
        sahne.appendChild(e);
      }
      if (burada && burada.plan && !burada.plan.dis) konuYer = [burada.plan.x, burada.plan.y];
    } else {
      for (const e of k.bahce.etiketler || []) {
        const d = el('div', 'pt-et' + (e.buyuk ? ' iri' : '') + (e.soluk ? ' soluk' : ''));
        d.style.left = e.yer[0] * 100 + '%'; d.style.top = e.yer[1] * 100 + '%';
        d.append(el('b', null, e.ad));
        const alt = e.alt || (e.m2 != null ? (e.yaklasik ? 'yaklaşık ' : '') + m2yaz(e.m2) : '');
        if (alt) d.append(el('span', null, alt));
        if (e.kat_don) {
          d.classList.add('tikla');
          d.addEventListener('click', () => { bahce = false; gor.z = 1; ciz(); });
        }
        sahne.appendChild(d);
      }
      if (burada && burada.bahce) konuYer = burada.bahce;
    }

    koni = null;
    if (konuYer) {
      koni = el('div', 'pt-koni');
      koni.style.left = konuYer[0] * 100 + '%'; koni.style.top = konuYer[1] * 100 + '%';
      sahne.appendChild(koni);
    }
    const idler = bahce ? k.bahce.noktalar : k.noktalar;
    for (const id of idler) {
      const n = byId.get(id);
      const yer = bahce ? n.bahce : (n.plan && !n.plan.dis ? [n.plan.x, n.plan.y] : null);
      if (!yer) continue;
      const ben = c && c.id === id;
      const b = el('button', 'pt-nok' + (ben ? ' ben' : '')); b.type = 'button';
      b.style.left = yer[0] * 100 + '%'; b.style.top = yer[1] * 100 + '%';
      b.setAttribute('aria-label', n.ad); b.title = n.ad;
      b.append(el('i'));
      b.dataset.git = id;
      sahne.appendChild(b);
    }
    alan.appendChild(sahne);
    kok.appendChild(alan);
    kok.appendChild(el('div', 'pt-alt', bahce
      ? 'Noktaya dokun: oraya git · iki parmakla yakınlaştır'
      : 'Odaya ya da noktaya dokun: oraya git · iki parmakla yakınlaştır'));
    girdiKur();
    sigdir();
    kare();
  }

  // ---------- sürükle, kıstır, tekerlek; kısa dokunuş = git
  function girdiKur() {
    const ptrs = new Map();
    let kistir = null, oynadi = 0, yakala = false;
    const fark = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    const yakin = (cx, cy, z1) => { // (cx,cy) alan içi nokta yerinde kalacak şekilde yakınlaştır
      const z0 = gor.z; z1 = Math.max(1, Math.min(6, z1));
      gor.x = cx - (cx - gor.x) * (z1 / z0); gor.y = cy - (cy - gor.y) * (z1 / z0); gor.z = z1;
      sinirla(); uygula();
    };
    alan.addEventListener('pointerdown', (e) => {
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { oynadi = 0; yakala = false; }
      if (ptrs.size === 2) { kistir = { ...fark(), z: gor.z }; oynadi = 999; }
    });
    alan.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        oynadi += Math.abs(dx) + Math.abs(dy);
        if (oynadi > 8 && !yakala) { yakala = true; try { alan.setPointerCapture(e.pointerId); } catch (_) { /* yakalanamadı */ } }
        if (yakala) { gor.x += dx; gor.y += dy; sinirla(); uygula(); }
      } else if (ptrs.size === 2 && kistir) {
        const f = fark(); const r = alan.getBoundingClientRect();
        yakin(f.x - r.left, f.y - r.top, kistir.z * (f.d / kistir.d));
      }
    });
    const birak = (e) => {
      if (!ptrs.delete(e.pointerId)) return;
      if (ptrs.size < 2) kistir = null;
    };
    alan.addEventListener('pointerup', birak);
    alan.addEventListener('pointercancel', birak);
    alan.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = alan.getBoundingClientRect();
      yakin(e.clientX - r.left, e.clientY - r.top, gor.z * Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    alan.addEventListener('dblclick', (e) => { e.preventDefault(); gor.z = 1; sinirla(); uygula(); });
    // dokunuş: oynamadıysa git (kıstırma ya da kaydırma sonrası tıklama yutulur)
    alan.addEventListener('click', (e) => {
      if (oynadi > 8) { oynadi = 0; return; }
      const hedef = e.target.closest('[data-git]');
      if (hedef) git(hedef.dataset.git);
    });
  }

  function kare() {   // her karede: bakış konisi bakış yönüyle döner
    if (!koni || !kok || !kok.isConnected) return;
    const { yaw, yatayFov } = bakisBilgi();
    const a = Math.round(Math.min(120, Math.max(30, yatayFov)));
    if (koni.dataset.a !== String(a)) {
      koni.dataset.a = String(a);
      koni.style.background = `conic-gradient(from ${-a / 2}deg, rgba(63,193,176,.78) 0deg ${a}deg, transparent ${a}deg)`;
    }
    koni.style.setProperty('--yaw', yaw.toFixed(1) + 'deg');
  }

  function hazirla(kapEl) {
    kok = kapEl;
    const c = cur();
    if (c) {
      kat = c.kat;
      const k = katBul(kat);
      bahce = !!(k.bahce && k.bahce.noktalar.includes(c.id));
    }
    gor.z = 1; gor.x = 0; gor.y = 0;
    ciz();
  }
  window.addEventListener('resize', () => { if (kok && kok.isConnected && alan && alan.clientWidth) sigdir(); });
  return { hazirla, kare };
}
