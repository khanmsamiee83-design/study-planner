// ============ SERVICE WORKER - Auto Update ============
const CACHE_NAME = 'study-planner-v1';

// Install
self.addEventListener('install', function(event) {
    console.log('[SW] Installing...');
    self.skipWaiting();
});

// Activate - پاک کردن همه کش‌های قدیمی
self.addEventListener('activate', function(event) {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// Fetch - استراتژی Network First
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    
    var url = new URL(event.request.url);
    // فقط از دامنه خودمون
    if (url.origin !== location.origin) {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                if (response && response.status === 200) {
                    var responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(function() {
                return caches.match(event.request);
            })
    );
});

// Message
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME);
    }
});

console.log('[SW] Service Worker loaded ✅');
