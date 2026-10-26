/* Mon argent grandit : fonctionnement hors ligne
 * Application pensée par MOYESAH Group et développée avec l'appui de Claude AI
 *
 * Principe :
 *  - la page est d'abord demandée au réseau, pour toujours avoir la dernière
 *    version quand il y a internet ;
 *  - sans réseau (ou s'il met plus de 4 secondes), la copie gardée sur
 *    l'appareil est servie ;
 *  - les polices Google sont gardées après le premier chargement ;
 *  - l'envoi de la progression au suivi parental n'est jamais intercepté.
 *
 * Les comptes, leçons et carnets ne passent pas par ce fichier : ils restent
 * dans le stockage du navigateur, comme avant.
 */
var CACHE = 'mag-v1';
var FICHIERS = ['./', './index.html', './manifest.webmanifest',
                './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
var POLICES = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function avecDelai(promesse, ms) {
  return new Promise(function (ok, ko) {
    var t = setTimeout(function () { ko(new Error('délai')); }, ms);
    promesse.then(function (r) { clearTimeout(t); ok(r); }, function (err) { clearTimeout(t); ko(err); });
  });
}

/* Réseau d'abord, copie locale en secours. */
function reseauDabord(req) {
  return avecDelai(fetch(req), 4000).then(function (rep) {
    if (rep && rep.ok) {
      var copie = rep.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copie); });
    }
    return rep;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (r) {
      return r || caches.match('./index.html');
    });
  });
}

/* Polices : copie locale d'abord, mise à jour en arrière-plan. */
function cacheDabord(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (r) {
      var reseau = fetch(req).then(function (rep) {
        if (rep && (rep.ok || rep.type === 'opaque')) c.put(req, rep.clone());
        return rep;
      }).catch(function () { return r; });
      return r || reseau;
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(reseauDabord(req)); return; }
  if (POLICES.indexOf(url.origin) >= 0) { e.respondWith(cacheDabord(req)); return; }
  // Tout le reste (script Google du suivi parental) passe sans être touché.
});
