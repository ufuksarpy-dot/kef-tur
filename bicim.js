// Sayı yazımı (Ufuk, 20.11.2026): alan virgülden sonra tek hane, hane 0 ise yazılmaz ("36 m²", "36,4 m²").
export function sayi1(v) {
  let s = (Math.round(v * 10) / 10).toFixed(1);
  if (s.endsWith('.0')) s = s.slice(0, -2);
  return s.replace('.', ',');
}
export const m2yaz = (v) => sayi1(v) + ' m²';
