// ============ SERVICE WORKER - برنامه‌ریزی تحصیلی هوشمند ============
// این فایل باعث میشه برنامه بعد از بار اول، کاملاً آفلاین کار کنه

const CACHE_NAME = 'study-planner-v1.0.0';
const CACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// ============ INSTALL ============
// وقتی Service Worker برای اولین بار نصب میشه
self.addEventListener('install', event => {
    console.log('[SW] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] Caching assets');
                return cache.addAll(CACHE_ASSETS);
            })
            .then(() => {
                console.log('[SW] Installed successfully');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] Install failed:', err);
            })
    );
});

// ============ ACTIVATE ============
// پاک کردن کش‌های قدیمی
self.addEventListener('activate', event => {
    console.log('[SW] Activating...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Activated successfully');
                return self.clients.claim();
            })
    );
});

// ============ FETCH ============
// استراتژی: Cache First, then Network
self.addEventListener('fetch', event => {
    // فقط درخواست‌های GET رو مدیریت کن
    if (event.request.method !== 'GET') return;

    // درخواست‌های خارجی (مثل Google Fonts) رو نادیده بگیر
    // اما اگه آفلاین بودی، از کش بخون
    const url = new URL(event.request.url);
    const isExternal = url.origin !== location.origin;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // اگه توی کش بود، از کش برگردون
                if (cachedResponse) {
                    // همزمان در پس‌زمینه آپدیت کن (stale-while-revalidate)
                    fetch(event.request)
                        .then(networkResponse => {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_NAME).then(cache => {
                                    cache.put(event.request, networkResponse.clone());
                                });
                            }
                        })
                        .catch(() => { /* آفلاین - اشکالی نداره */ });

                    return cachedResponse;
                }

                // اگه توی کش نبود، از شبکه بگیر
                return fetch(event.request)
                    .then(networkResponse => {
                        // فقط پاسخ‌های موفق رو کش کن
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
                            return networkResponse;
                        }

                        // کپی از پاسخ برای کش
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });

                        return networkResponse;
                    })
                    .catch(err => {
                        console.log('[SW] Fetch failed:', err);
                        
                        // اگه درخواست HTML بود و آفلاین، صفحه اصلی رو برگردون
                        if (event.request.headers.get('accept')?.includes('text/html')) {
                            return caches.match('./index.html');
                        }
                        
                        // در غیر این صورت، خطا
                        return new Response('آفلاین هستید', {
                            status: 503,
                            statusText: 'Offline',
                            headers: new Headers({
                                'Content-Type': 'text/plain; charset=utf-8'
                            })
                        });
                    });
            })
    );
});

// ============ MESSAGE ============
// دریافت پیام از برنامه اصلی
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.delete(CACHE_NAME).then(() => {
            console.log('[SW] Cache cleared');
        });
    }
});

// ============ SYNC (اختیاری) ============
// برای همگام‌سازی در پس‌زمینه (وقتی اینترنت برگشت)
self.addEventListener('sync', event => {
    if (event.tag === 'sync-data') {
        console.log('[SW] Background sync triggered');
        // اینجا می‌تونی داده‌ها رو با سرور همگام کنی
    }
});

console.log('[SW] Service Worker loaded ✅');