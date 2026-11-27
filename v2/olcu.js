// Cetvel: bulunulan odanın duvar uzunlukları (taban), tavan yüksekliği, kapı/pencere ölçüleri.
// Çizgiler tur.json'daki oda geometrisinden 3B'de çizilir (panorama yönü ve göz yüksekliği geo.js ile aynı);
// derinlik testi yok: mobilyanın üstünden geçer. Her karede yeniden izdüşürülür.
import { olcuYaz, olcuSayi } from './bicim.js';

const NS = 'http://www.w3.org/2000/svg';
const NEAR = -0.06;       // kamera uzayında yakın kesme (kamera -Z'ye bakar)

export function olcuKur(api) {
  const kap = document.querySelector('#olcu');
  const svg = document.querySelector('#olcuSvg');
  const etKap = document.querySelector('#olcuEt');
  const dugme = document.querySelector('#olcuDugme');
  const altSerit = document.querySelector('#serit');
  const alt = document.createElementNS(NS, 'path'); alt.setAttribute('class', 'o-golge');
  const cizgi = document.createElementNS(NS, 'path'); cizgi.setAttribute('class', 'o-cizgi');
  const nokta = document.createElementNS(NS, 'path'); nokta.setAttribute('class', 'o-nokta');
  svg.append(alt, cizgi, nokta);
  let acik = false, simdiki = null, veri = null, zemin = 0;
  const havuz = [];

  function etiket(i) {
    if (!havuz[i]) { const d = document.createElement('div'); d.className = 'oe'; etKap.appendChild(d); havuz[i] = d; }
    return havuz[i];
  }
  function sec(n) {
    simdiki = n ? n.id : null;
    const o = n && api.odaBul(n);
    veri = o && o.olcu ? o.olcu : null;
    zemin = n ? n.konum[2] - 1.55 : 0;
    dugme.hidden = !veri;
    if (!veri && acik) ac(false);
  }
  function ac(a) {
    acik = a;
    dugme.classList.toggle('aktif', a);
    dugme.setAttribute('aria-pressed', a ? 'true' : 'false');
    kap.hidden = !a;
    if (!a) { alt.setAttribute('d', ''); cizgi.setAttribute('d', ''); nokta.setAttribute('d', ''); for (const d of havuz) d.style.display = 'none'; }
  }
  dugme.addEventListener('click', () => ac(!acik));

  // kamera uzayında kesilmiş doğru: [ekranA, ekranB, aKesildi, bKesildi] ya da null
  function kes(a, b) {
    let pa = a, pb = b, ka = false, kb = false;
    if (pa[2] > NEAR && pb[2] > NEAR) return null;
    if (pa[2] > NEAR) { const t = (NEAR - pa[2]) / (pb[2] - pa[2]); pa = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, NEAR]; ka = true; }
    else if (pb[2] > NEAR) { const t = (NEAR - pb[2]) / (pa[2] - pb[2]); pb = [pb[0] + (pa[0] - pb[0]) * t, pb[1] + (pa[1] - pb[1]) * t, NEAR]; kb = true; }
    return [api.ekran(pa), api.ekran(pb), ka, kb];
  }

  function kare() {
    const n = api.cur();
    if ((n ? n.id : null) !== simdiki) sec(n);
    if (!acik || !veri || !n) return;
    const { w, h } = api.boyut();
    const ustSinir = 78, altSinir = Math.max(ustSinir + 80, altSerit.getBoundingClientRect().top - 14);
    const icerde = (p, pay = 0) => p[0] > pay && p[0] < w - pay && p[1] > ustSinir && p[1] < altSinir;
    const K = (x, y, z) => api.kam(x, y, zemin + z);
    let yol = '', yolNokta = '';
    const adaylar = [];   // {x, y, t, oncelik}
    const ekle = (a, b, nok) => {
      const s = kes(a, b);
      if (!s) return null;
      yol += `M${s[0][0].toFixed(1)} ${s[0][1].toFixed(1)}L${s[1][0].toFixed(1)} ${s[1][1].toFixed(1)}`;
      if (nok) {
        if (!s[2]) yolNokta += `M${s[0][0].toFixed(1)} ${s[0][1].toFixed(1)}h0`;
        if (!s[3]) yolNokta += `M${s[1][0].toFixed(1)} ${s[1][1].toFixed(1)}h0`;
      }
      return s;
    };

    // kapı ve pencere: dikdörtgen çerçeve, ortasında "Pencere 1,80 × 3,05 m"
    for (const a of veri.acikliklar) {
      const c = a.p.map((q) => K(q[0], q[1], q[2] - 0)); // q[2] zaten kat döşemesine göre
      let gor = 0, ox = 0, oy = 0;
      for (let i = 0; i < 4; i++) {
        const s = ekle(c[i], c[(i + 1) % 4], false);
        if (s) { gor++; ox += (s[0][0] + s[1][0]) / 2; oy += (s[0][1] + s[1][1]) / 2; }
      }
      if (gor >= 2) {
        const mer = api.ekran([(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2, (c[0][2] + c[2][2]) / 2]);
        if (c[0][2] < NEAR && c[2][2] < NEAR) adaylar.push({ x: mer[0], y: mer[1], t: `${a.ad} ${olcuSayi(a.w)} × ${olcuSayi(a.h)} m`, o: 1 });
      }
    }
    // tavan yüksekliği: köşe çizgilerinden ekranın ortasına en yakın olan
    let en = null;
    for (const k of veri.koseler) {
      const alt0 = K(k[0], k[1], 0), ust0 = K(k[0], k[1], veri.tavan);
      if (alt0[2] > NEAR || ust0[2] > NEAR) continue;
      const pa = api.ekran(alt0), pu = api.ekran(ust0);
      if (!icerde(pa, 8) || !icerde(pu, 8)) continue;
      const d = Math.hypot((pa[0] + pu[0]) / 2 - w / 2, (pa[1] + pu[1]) / 2 - h / 2);
      if (!en || d < en.d) en = { d, a: alt0, u: ust0, pa, pu };
    }
    if (en) {
      ekle(en.a, en.u, true);
      adaylar.push({ x: (en.pa[0] + en.pu[0]) / 2, y: (en.pa[1] + en.pu[1]) / 2, t: olcuYaz(veri.tavan), o: 0 });
    }
    // duvar uzunlukları: tabanda
    for (const d of veri.duvarlar) {
      const s = ekle(K(d.a[0], d.a[1], 0.02), K(d.b[0], d.b[1], 0.02), true);
      if (!s) continue;
      const mx = (s[0][0] + s[1][0]) / 2, my = (s[0][1] + s[1][1]) / 2;
      adaylar.push({ x: mx, y: my, t: olcuYaz(d.m), o: 2, uz: Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) });
    }
    alt.setAttribute('d', yol); cizgi.setAttribute('d', yol); nokta.setAttribute('d', yolNokta);

    // etiketleri çakıştırmadan yerleştir (öncelik: tavan, açıklık, duvar; duvarda ekranda uzun olan önce)
    adaylar.sort((p, q) => p.o - q.o || (q.uz || 0) - (p.uz || 0));
    const konan = [];
    let i = 0;
    for (const c of adaylar) {
      if (c.o === 2 && c.uz < 70) continue;
      if (!icerde([c.x, c.y], 6)) continue;
      const gen = c.t.length * 7.4 + 16;
      if (konan.some((k) => Math.abs(k.x - c.x) < (k.gen + gen) / 2 && Math.abs(k.y - c.y) < 26)) continue;
      konan.push({ x: c.x, y: c.y, gen });
      const d = etiket(i++);
      d.style.display = ''; d.textContent = c.t;
      d.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px) translate(-50%, -50%)`;
    }
    for (; i < havuz.length; i++) havuz[i].style.display = 'none';
  }

  return { kare, sec, ac };
}
