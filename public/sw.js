/* Service worker Nakhoda.
 *
 * Lingkupnya sempit dan disengaja: ini hanya membuat cangkang app bisa dibuka
 * saat luring dan bisa dipasang ke layar utama. Data portofolio TIDAK lewat
 * sini sama sekali, itu urusan cache persisten Firestore yang sudah menangani
 * sinkronisasi, konflik, dan antrean tulis jauh lebih baik daripada yang bisa
 * ditiru di sini.
 *
 * Dua aturan yang dipegang:
 *   1. Permintaan ke /api/ dan ke domain luar tidak pernah disentuh. Harga
 *      basi yang disajikan dari cache jauh lebih berbahaya daripada harga yang
 *      gagal dimuat, karena yang basi terlihat seperti benar.
 *   2. Navigasi dilayani jaringan lebih dulu. Halaman lama dari cache hanya
 *      dipakai kalau jaringan benar-benar tidak ada.
 */

const VERSI = "nakhoda-v2";
const BEKAL = [
  "/", "/manifest.webmanifest", "/ikon.svg", "/ikon-kecil.svg", "/favicon.ico",
  "/ikon-192.png", "/ikon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSI)
      // addAll gagal seluruhnya kalau satu berkas meleset, jadi tiap berkas
      // ditambahkan sendiri-sendiri dan kegagalannya ditelan.
      .then((c) => Promise.allSettled(BEKAL.map((u) => c.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((k) => Promise.all(k.filter((n) => n !== VERSI).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const permintaan = e.request;
  if (permintaan.method !== "GET") return;

  const url = new URL(permintaan.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (permintaan.mode === "navigate") {
    e.respondWith(
      fetch(permintaan)
        .then((balasan) => {
          const salinan = balasan.clone();
          caches.open(VERSI).then((c) => c.put(permintaan, salinan));
          return balasan;
        })
        .catch(() => caches.match(permintaan).then((c) => c || caches.match("/"))),
    );
    return;
  }

  // Aset statis Next punya nama ber-hash, jadi isinya tidak pernah berubah
  // untuk URL yang sama. Aman disajikan dari cache lebih dulu.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(permintaan).then(
        (tersimpan) =>
          tersimpan ||
          fetch(permintaan).then((balasan) => {
            if (balasan.ok) {
              const salinan = balasan.clone();
              caches.open(VERSI).then((c) => c.put(permintaan, salinan));
            }
            return balasan;
          }),
      ),
    );
  }
});
