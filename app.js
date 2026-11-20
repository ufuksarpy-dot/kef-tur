// Tur görüntüleyici (şablon): projeye özgü hiçbir şey içermez, her şey tur.json'dan gelir.
// Panorama sahnesi, girdi (sürükle/kıstır/eylemsizlik), zemin halkaları ve geçiş burada;
// paneller ve açılış ekranı arayuz.js'de.
import * as THREE from './lib/three.module.js';
import { yonHesapla, zeminNoktasi, panoKuresi, aciFarki } from './geo.js';
import { arayuzKur } from './arayuz.js';
import { m2yaz } from './bicim.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#c');
const durumEl = $('#durum');
const RAD = Math.PI / 180;
const FOV_MIN = 35, FOV_MAX = 95;
const PITCH_MAX = 85 * RAD;
const sorgu = new URLSearchParams(location.search);

// ---------- sahne
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (e) {
  durumEl.textContent = 'Bu tarayıcı 3B görüntü göstermiyor.';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x0b0d10, 1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1200);
camera.rotation.order = 'YXZ';

const A = new THREE.Mesh(panoKuresi(THREE, 500), new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false }));
const B = new THREE.Mesh(panoKuresi(THREE, 499), new THREE.MeshBasicMaterial({ depthWrite: false, depthTest: false, transparent: true, opacity: 0 }));
A.renderOrder = 0; B.renderOrder = 1;
A.visible = false; B.visible = false;
scene.add(A, B);

// ---------- bakış durumu
const bakis = { yaw: 0, pitch: 0, fov: 70 };
let fovCarpan = 1;
const varsayilanFov = () => (window.innerWidth < window.innerHeight ? 62 : 72);
bakis.fov = varsayilanFov();

function boyutla() {
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
}
function kameraGuncelle() {
  // fov = küçük kenarın görüş açısı (yatay ekranda dikey, dik ekranda yatay)
  const f = bakis.fov * fovCarpan * RAD;
  const asp = camera.aspect;
  const dikey = asp >= 1 ? f : 2 * Math.atan(Math.tan(f / 2) / asp);
  camera.fov = Math.min(dikey / RAD, 120);
  camera.updateProjectionMatrix();
  camera.rotation.set(bakis.pitch, -bakis.yaw, 0);
}
const radPerPx = () => (camera.fov * RAD) / (canvas.clientHeight || window.innerHeight);
const yatayFov = () => (2 * Math.atan(Math.tan((camera.fov * RAD) / 2) * camera.aspect)) / RAD;
window.addEventListener('resize', boyutla);
window.addEventListener('orientationchange', () => setTimeout(boyutla, 200));

// ---------- veri
let tur = null;
const byId = new Map();
const odaById = new Map();
let cur = null;
let arayuz = null;
const mesaj = (s) => { durumEl.textContent = s || ''; };

// ---------- doku yükleme
const bag = navigator.connection || {};
// Aynı anda en çok BİR net doku (8K ya da 4K) bellekte durur; küçük (2k) kopyalar komşular için önbellekte.
function netSecimi(n) {
  const k = n.pano || {};
  const tercih = sorgu.get('net'); // hata ayıklama: ?net=2k|4k|8k
  let sinir = renderer.capabilities.maxTextureSize >= 8192 ? 8192 : 4096;
  if (navigator.deviceMemory && navigator.deviceMemory < 4) sinir = Math.min(sinir, 4096);
  if (bag.saveData) sinir = Math.min(sinir, 4096);
  if (tercih === '2k') return [];
  if (tercih === '4k') sinir = 4096;
  const liste = [];
  if (k.k8 && sinir >= 8192) liste.push({ url: k.k8, w: 8192 });
  if (k.k4) liste.push({ url: k.k4, w: 4096 });
  return liste; // sırayla denenir: 8K olmazsa 4K
}

async function resimIndir(url, { ilerleme, signal } = {}) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const toplam = Number(r.headers.get('content-length')) || 0;
  let blob;
  if (ilerleme && r.body && toplam) {
    const oku = r.body.getReader(); const parca = []; let al = 0;
    for (;;) {
      const { done, value } = await oku.read();
      if (done) break;
      parca.push(value); al += value.length; ilerleme(al / toplam);
    }
    blob = new Blob(parca, { type: 'image/jpeg' });
  } else blob = await r.blob();
  if (window.createImageBitmap) {
    try {
      return { g: await createImageBitmap(blob, { imageOrientation: 'flipY', premultiplyAlpha: 'none' }), bitmap: true };
    } catch (_) { /* eski tarayıcı: Image'e düş */ }
  }
  const u = URL.createObjectURL(blob);
  try {
    const im = new Image(); im.src = u; await im.decode();
    return { g: im, bitmap: false };
  } finally { URL.revokeObjectURL(u); }
}
function dokuYap({ g, bitmap }, net) {
  const t = new THREE.Texture(g);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;           // 8K'da mipmap fazladan ~%33 bellek; telefonda 8K ≈ ekran çözünürlüğü, gerekmez
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.flipY = !bitmap;                   // ImageBitmap zaten ters çevrilerek üretildi
  if (net && bitmap && g.close) t.onUpdate = () => { try { g.close(); } catch (_) {} }; // GPU'ya gidince işlemci kopyası bırakılır
  t.needsUpdate = true;
  return t;
}

const cache = new Map(); // id -> { p: Promise<Texture>, t?: Texture }   (yalnız 2k)
function yukle2k(n) {
  let e = cache.get(n.id);
  if (e) return e.p;
  e = {};
  e.p = resimIndir(n.pano.k2).then((g) => {
    const t = dokuYap(g, false); e.t = t;
    try { renderer.initTexture(t); } catch (_) { /* erken yükleme isteğe bağlı */ }
    return t;
  });
  e.p.catch(() => cache.delete(n.id));
  cache.set(n.id, e);
  return e.p;
}
function komsuOnYukle(n) {
  for (const id of n.komsular || []) { const k = byId.get(id); if (k) yukle2k(k).catch(() => {}); }
}
function temizle(gerekli) {
  for (const [id, e] of cache) {
    if (!gerekli.has(id) && e.t && A.material.map !== e.t && B.material.map !== e.t) { e.t.dispose(); cache.delete(id); }
  }
}

// ---------- net kopya (arkadan iner, yerine fark edilmeden geçer)
const netEl = $('#netlik');
const net = { id: null, ctrl: null, tex: null, bekleyen: null };
function cizgi(p) {
  if (p == null) { netEl.classList.remove('var'); return; }
  netEl.classList.add('var');
  netEl.style.transform = `scaleX(${Math.max(0.03, Math.min(1, p)).toFixed(3)})`;
}
function netIptal() {
  if (net.ctrl) { net.ctrl.abort(); net.ctrl = null; }
  if (net.bekleyen) { net.bekleyen.tex.dispose(); net.bekleyen = null; }
  cizgi(null);
}
function netBaslat(n) {
  netIptal();
  const liste = netSecimi(n);
  if (!liste.length) { komsuOnYukle(n); return; }
  const ctrl = new AbortController();
  net.ctrl = ctrl; net.id = n.id;
  netEl.style.transform = 'scaleX(0.03)';
  (async () => {
    for (const a of liste) {
      try {
        cizgi(0.03);
        const g = await resimIndir(a.url, { signal: ctrl.signal, ilerleme: (p) => { if (net.ctrl === ctrl) cizgi(p); } });
        if (ctrl.signal.aborted) { if (g.bitmap) g.g.close(); return; }
        net.bekleyen = { id: n.id, tex: dokuYap(g, true), w: a.w };
        net.ctrl = null;
        netUygula();
        return;
      } catch (e) {
        if (ctrl.signal.aborted) return;
        console.warn('net kopya alınamadı', a.url, e);
      }
    }
    if (net.ctrl === ctrl) { net.ctrl = null; cizgi(null); komsuOnYukle(n); }
  })();
}
function netUygula() {
  const b = net.bekleyen;
  if (!b) return;
  if (!cur || b.id !== cur.id) { b.tex.dispose(); net.bekleyen = null; cizgi(null); return; }
  // geçiş sürerken ya da parmak ekrandayken (GPU'ya yükleme kasma yapar) bekle
  if (hedefId || surukleniyor || Math.abs(hizYaw) > 0.05 || Math.abs(hizPitch) > 0.05) { setTimeout(netUygula, 150); return; }
  try { renderer.initTexture(b.tex); } catch (_) {}
  const eski = net.tex;
  A.material.map = b.tex; // aynı görüntü, daha keskin: yanıp sönme olmaz
  net.tex = b.tex; net.bekleyen = null;
  if (eski) eski.dispose();
  cizgi(1); setTimeout(() => { if (!net.ctrl) cizgi(null); }, 200);
  komsuOnYukle(cur);
}

// ---------- hotspot (DOM halkaları: ekranda sabit boyut, zemin noktasına izdüşümle yerleşir)
const halkaKap = $('#halkalar');
const seritEl = $('#serit');
const hotspots = { children: [], visible: true };
const v3 = new THREE.Vector3();
function hotspotKur() {
  halkaKap.textContent = '';
  hotspots.children.length = 0;
  for (const id of cur.komsular || []) {
    const k = byId.get(id);
    if (!k) continue;
    // Kat geçişi: tur.json 'halkalar' halkayı basamağın üstüne koyar (dünya: x doğu, y kuzey, z yukarı;
    // konum[2] göz kotu). Yoksa komşunun döşemesine izdüşüm.
    const ozel = cur.halkalar && cur.halkalar[id];
    const [x, y, z] = ozel
      ? [ozel.konum[0] - cur.konum[0], ozel.konum[2] - cur.konum[2], -(ozel.konum[1] - cur.konum[1])]
      : zeminNoktasi(cur.konum, k.konum);
    const el = document.createElement('div');
    el.className = ozel ? 'hk hk-kat' : 'hk';
    // Halkada her zaman oda adı ve alanı ("Mutfak · 17,8 m²"); aynı odadaki noktalarda da (Ufuk 20.11: aynı nokta
    // iki ayrı adla görünmesin). Alanı olmayan yerde (dış mekân, merdiven) noktanın adı.
    let yazi = (ozel && ozel.etiket) || k.ad;
    if (!ozel && k.oda) {
      const o = odaById.get(k.oda);
      if (o && o.m2 != null) yazi = `${o.ad} · ${m2yaz(o.m2)}`;
    }
    const et = document.createElement('span'); et.className = 'hk-et'; et.textContent = yazi;
    const hl = document.createElement('i'); hl.className = 'hk-halka';
    el.append(et, hl);
    halkaKap.appendChild(el);
    hotspots.children.push({ id, el, pos: new THREE.Vector3(x, y + 0.01, z), sx: 0, sy: 0, gorunur: false });
  }
}
function hotspotGuncelle() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const altUst = seritEl.getBoundingClientRect().top - 4;
  halkaKap.style.display = hotspots.visible ? '' : 'none';
  for (const g of hotspots.children) {
    v3.copy(g.pos).project(camera);
    g.sx = (v3.x * 0.5 + 0.5) * w; g.sy = (-v3.y * 0.5 + 0.5) * h;
    g.gorunur = hotspots.visible && v3.z > -1 && v3.z < 1 && g.sx > -40 && g.sx < w + 40 && g.sy > 60 && g.sy + 26 < altUst;
    g.el.style.visibility = g.gorunur ? 'visible' : 'hidden';
    if (g.gorunur) g.el.style.transform = `translate(${g.sx.toFixed(1)}px, ${g.sy.toFixed(1)}px)`;
  }
}
function hotspotBul(px, py) {
  let en = 50, bulunan = null;
  for (const g of hotspots.children) {
    if (!g.gorunur) continue;
    const d = Math.hypot(g.sx - px, g.sy - py);
    if (d < en) { en = d; bulunan = g.id; }
  }
  return bulunan;
}

// ---------- geçiş
const kolayla = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const yumusat = (p) => { p = Math.min(1, Math.max(0, p)); return p * p * (3 - 2 * p); };
// Zaman damgasına bağlı animasyon: rAF kısılırsa setTimeout yedeği sürer, süre dolunca mutlaka biter.
function anim(ms, fn, iptal) {
  return new Promise((res) => {
    const t0 = performance.now();
    let raf = 0, tm = 0, bitti = false;
    const adim = () => {
      if (bitti) return;
      cancelAnimationFrame(raf); clearTimeout(tm);
      if (iptal && iptal()) { bitti = true; res(); return; }
      const p = Math.min(1, (performance.now() - t0) / ms);
      fn(p);
      if (p >= 1) { bitti = true; res(); return; }
      raf = requestAnimationFrame(adim);
      tm = setTimeout(adim, 40);
    };
    adim();
  });
}

let gecisNo = 0;      // her yeni git() bir öncekini geçersiz kılar (son dokunuş kazanır)
let hedefId = null;
function gecisTemizle() { fovCarpan = 1; canvas.style.filter = ''; B.visible = false; B.material.opacity = 0; }
function urlGuncelle(id) {
  try { history.replaceState(history.state, '', '#' + encodeURIComponent(id)); } catch (_) {}
}
async function git(id, { anlik = false } = {}) {
  const n = byId.get(id);
  if (!n || id === hedefId) return;
  const no = ++gecisNo;
  if (cur && id === cur.id) { // yarım kalan geçişten vazgeç, olduğun yerde kal
    hedefId = null; gecisTemizle(); hotspots.visible = true;
    return;
  }
  hedefId = id;
  gecisTemizle();
  arayuz && arayuz.hedefSecildi(id);
  let tex;
  try { tex = await yukle2k(n); }
  catch (e) {
    if (no !== gecisNo) return;
    mesaj('Görsel yüklenemedi: ' + n.ad);
    setTimeout(() => mesaj(''), 2500);
    if (cur) arayuz && arayuz.hedefSecildi(cur.id);
    hedefId = null;
    return;
  }
  if (no !== gecisNo) return;
  mesaj('');
  netIptal(); // eski odanın net kopyası artık gerekmiyor (iniyorsa durur)
  if (!cur || anlik) {
    A.material.map = tex; A.material.needsUpdate = true; A.visible = true;
    cur = n;
  } else {
    hotspots.visible = false;
    const yon = yonHesapla(cur.konum, n.konum);
    const kay = yon.yatay > 0 ? aciFarki(bakis.yaw, yon.yaw) * 0.2 : 0;
    B.material.map = tex; B.material.needsUpdate = true; B.material.opacity = 0; B.visible = true;
    let onceki = 0;
    await anim(600, (p) => {
      const e = kolayla(p);
      fovCarpan = 1 - 0.16 * e;
      bakis.yaw += kay * (e - onceki); onceki = e;
      B.material.opacity = yumusat((p - 0.2) / 0.8);
      canvas.style.filter = `blur(${(3.5 * e).toFixed(2)}px)`;
    }, () => no !== gecisNo);
    if (no !== gecisNo) return;
    A.material.map = tex; A.material.needsUpdate = true;
    B.visible = false;
    cur = n;
  }
  // eski odanın net dokusu bırakıldı: bellekten at (aynı anda en çok bir net doku)
  if (net.tex && net.tex !== A.material.map) { net.tex.dispose(); net.tex = null; }
  urlGuncelle(n.id);
  hotspotKur();
  hotspots.visible = true;
  hedefId = null;
  arayuz && arayuz.odaDegisti(n);
  if (fovCarpan !== 1 || canvas.style.filter) {
    await anim(280, (p) => {
      const e = kolayla(p);
      fovCarpan = 0.84 + 0.16 * e;
      canvas.style.filter = p < 1 ? `blur(${(3.5 * (1 - e)).toFixed(2)}px)` : '';
    }, () => no !== gecisNo);
    if (no === gecisNo) { fovCarpan = 1; canvas.style.filter = ''; }
  }
  if (no !== gecisNo) return;
  netBaslat(n);
  temizle(new Set([n.id, ...(n.komsular || [])]));
}

// ---------- girdi: sürükle, kıstır, tekerlek, eylemsizlik
const ptrs = new Map();
let dokun = null, kistir = null, hizYaw = 0, hizPitch = 0, sonHareket = 0, surukleniyor = false;
const sinirla = () => {
  bakis.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, bakis.pitch));
  bakis.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, bakis.fov));
  bakis.yaw = ((bakis.yaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
};
const mesafe = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  surukleniyor = true; hizYaw = hizPitch = 0;
  if (ptrs.size === 1) dokun = { x: e.clientX, y: e.clientY, t: performance.now(), oynadi: 0 };
  else if (ptrs.size === 2) { kistir = { d: mesafe(), fov: bakis.fov }; if (dokun) dokun.oynadi = 999; }
  sonHareket = performance.now();
  arayuz && arayuz.ilkDokunus();
});
canvas.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) {
    const k = radPerPx(), simdi = performance.now(), dt = Math.max(1, simdi - sonHareket) / 1000;
    bakis.yaw -= dx * k; bakis.pitch += dy * k;
    hizYaw = hizYaw * 0.6 + (-dx * k / dt) * 0.4;
    hizPitch = hizPitch * 0.6 + (dy * k / dt) * 0.4;
    sonHareket = simdi;
    if (dokun) dokun.oynadi += Math.abs(dx) + Math.abs(dy);
  } else if (ptrs.size === 2 && kistir) {
    bakis.fov = kistir.fov * (kistir.d / mesafe());
    hizYaw = hizPitch = 0;
  }
  sinirla();
});
function birak(e, iptal) {
  if (!ptrs.delete(e.pointerId)) return;
  if (ptrs.size < 2) kistir = null;
  if (ptrs.size === 0) {
    surukleniyor = false;
    if (performance.now() - sonHareket > 90) hizYaw = hizPitch = 0;
    // >10 px oynayan dokunuş tıklama değildir
    if (!iptal && dokun && dokun.oynadi < 10 && performance.now() - dokun.t < 500) {
      const r = canvas.getBoundingClientRect();
      const id = hotspotBul(e.clientX - r.left, e.clientY - r.top);
      if (id) git(id);
    }
    dokun = null;
  } else hizYaw = hizPitch = 0;
}
canvas.addEventListener('pointerup', (e) => birak(e, false));
canvas.addEventListener('pointercancel', (e) => birak(e, true));
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  bakis.fov *= Math.exp(e.deltaY * 0.0012);
  sinirla();
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
for (const t of ['gesturestart', 'gesturechange']) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });

function bakisiSifirla() {
  const yon = cur && cur.yon != null ? cur.yon * RAD : 0;
  const y0 = bakis.yaw, p0 = bakis.pitch, f0 = bakis.fov, f1 = varsayilanFov();
  const dy = aciFarki(y0, yon);
  hizYaw = hizPitch = 0;
  anim(350, (p) => { const e = kolayla(p); bakis.yaw = y0 + dy * e; bakis.pitch = p0 * (1 - e); bakis.fov = f0 + (f1 - f0) * e; });
}

// ---------- döngü
let sonT = performance.now(), sonKare = 0;
function ciz(now) {
  const dt = Math.min(0.05, Math.max(0, (now - sonT) / 1000));
  sonT = now;
  if (!surukleniyor && (Math.abs(hizYaw) > 0.01 || Math.abs(hizPitch) > 0.01)) {
    bakis.yaw += hizYaw * dt; bakis.pitch += hizPitch * dt;
    const s = Math.exp(-dt * 3.5);
    hizYaw *= s; hizPitch *= s;
    sinirla();
  }
  kameraGuncelle();
  camera.updateMatrixWorld(true);
  hotspotGuncelle();
  arayuz && arayuz.kare();
  renderer.render(scene, camera);
}
function dongu(now) { sonKare = performance.now(); ciz(now); requestAnimationFrame(dongu); }
// rAF kısılmışsa (arka plan, odaksız pencere) zamanlayıcıyla çiz
setInterval(() => { if (performance.now() - sonKare > 250) ciz(performance.now()); }, 100);

// ---------- başlat
(async function basla() {
  boyutla();
  mesaj('Yükleniyor…');
  try {
    const r = await fetch('tur.json', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    tur = await r.json();
    if (!tur.noktalar || !tur.noktalar.length) throw new Error('nokta yok');
  } catch (e) {
    mesaj('Tur verisi (tur.json) okunamadı.');
    return;
  }
  for (const n of tur.noktalar) byId.set(n.id, n);
  for (const o of tur.odalar || []) odaById.set(o.id, o);
  document.title = (tur.proje.ad || 'Sanal tur') + ' – sanal tur';
  arayuz = arayuzKur({
    tur, byId, git, bakisSifirla: bakisiSifirla,
    cur: () => cur,
    bakisBilgi: () => ({ yaw: bakis.yaw / RAD, yatayFov: yatayFov() }),
    odaBul: (n) => (n && n.oda ? odaById.get(n.oda) : null),
    // cetvel için: dünya (x doğu, y kuzey, z yukarı; metre) -> kamera uzayı -> ekran. Kamera bulunulan noktada, göz kotunda.
    kam: (wx, wy, wz) => { const c = cur.konum; v3.set(wx - c[0], wz - c[2], -(wy - c[1])).applyMatrix4(camera.matrixWorldInverse); return [v3.x, v3.y, v3.z]; },
    ekran: (p) => { v3.set(p[0], p[1], p[2]).applyMatrix4(camera.projectionMatrix); return [(v3.x * 0.5 + 0.5) * canvas.clientWidth, (-v3.y * 0.5 + 0.5) * canvas.clientHeight]; },
    boyut: () => ({ w: canvas.clientWidth, h: canvas.clientHeight }),
    boyutla,
  });
  requestAnimationFrame(dongu);
  const hash = decodeURIComponent(location.hash.slice(1));
  const kapak = tur.proje.kapak || {};
  const ilk = byId.get(hash) || byId.get(tur.proje.baslangic) || byId.get(kapak.nokta) || tur.noktalar[0];
  if (ilk.yon != null) bakis.yaw = ilk.yon * RAD;
  await git(ilk.id, { anlik: true });
  window.__tur = { bakis, git, get cur() { return cur; }, hotspots, camera, byId, get hedef() { return hedefId; }, net, cache, renderer }; // hata ayıklama
})();
