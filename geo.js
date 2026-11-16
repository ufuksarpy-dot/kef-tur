// Yön matematiği — tarayıcıda (app.js) ve Node testinde ortak.
// Dünya: x doğu, y kuzey, z yukarı (metre). Panoramanın yatay ORTASI kuzeye (+Y) bakar,
// sağ yarısı doğuya (+X). yaw = atan2(dx, dy): kuzeyden saat yönünde. pitch: + yukarı.

export const KAMERA_YUKSEKLIGI = 1.55;

/** a -> b yönü. Döner: { yaw, pitch (radyan), yatay (m) }. Pitch, b'nin zeminine bakar. */
export function yonHesapla(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const yatay = Math.hypot(dx, dy);
  const dz = (b[2] || 0) - ((a[2] || 0) + KAMERA_YUKSEKLIGI);
  return { yaw: Math.atan2(dx, dy), pitch: Math.atan2(dz, yatay), yatay, dz };
}

/** (yaw, pitch) bakışının three.js (y yukarı, kuzey = -Z, doğu = +X) birim vektörü. */
export function bakisYonu(yaw, pitch) {
  const c = Math.cos(pitch);
  return [Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
}

export const EN_DIK_EGIM = (35 * Math.PI) / 180; // halka ufkun en çok 35° altına konur

/**
 * Komşunun zemin noktası, kamera merkezli three.js koordinatında [x, y, z].
 * Yakın komşuda halka çok dik (ayak ucuna) düşmesin diye, ufkun altındaki açı
 * enDikEgim'i aşarsa nokta aynı yönde uzağa kaydırılır.
 */
export function zeminNoktasi(a, b, enAzMesafe = 0.8, enDikEgim = EN_DIK_EGIM) {
  const { yaw, yatay, dz } = yonHesapla(a, b);
  let h = Math.max(yatay, enAzMesafe);
  if (dz < 0) h = Math.max(h, -dz / Math.tan(enDikEgim));
  return [Math.sin(yaw) * h, dz, -Math.cos(yaw) * h];
}

/** İki açı arası en kısa fark, (-π, π]. */
export function aciFarki(a, b) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** İçten bakılan küre: görüntü merkezi (u=0.5) -Z (kuzey), sağ yarı +X (doğu). */
export function panoKuresi(THREE, yaricap = 500) {
  const g = new THREE.SphereGeometry(yaricap, 64, 40);
  g.scale(-1, 1, 1);
  g.rotateY(-Math.PI / 2);
  return g;
}
