// ============ SERVICE WORKER - Cache First (آفلاین قوی) ============
const CACHE_NAME = 'study-planner-v2'; // نسخه رو عوض کردم تا کش قدیمی پاک بشه

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './Vazirmatn-Regular.woff2',
  './Vazirmatn-Bold.woff2',
  './icon-192.png',
  './icon-512.png'
];

// ۱. نصب: فایل‌های اصلی رو کش میکنه
self.addEventListener('install', function(event) {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS);
        })
    );
});

// ۲. فعال‌سازی: کش‌های قدیمی رو پاک میکنه
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(function() {
            return self.clients.claim();
        })
    );
});

// ۳. واکشی: اول از کش میخونه (آفلاین)، بعد از نت
self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    
    var url = new URL(event.request.url);
    if (url.origin !== location.origin) return;
    
    event.respondWith(
        caches.match(event.request).then(function(cachedResponse) {
            // اگه توی گوشی بود، همون رو بده (حتی اگه نت وصل باشه)
            if (cachedResponse) {
                return cachedResponse;
            }
            
            // اگه توی گوشی نبود، از اینترنت بگیر و ذخیره کن
            return fetch(event.request).then(function(response) {
                if (response && response.status === 200) {
                    var responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            }).catch(function() {
                // اگه نت نبود و فایل هم نبود، صفحه اصلی رو نشون بده
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// پیام‌ها
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
