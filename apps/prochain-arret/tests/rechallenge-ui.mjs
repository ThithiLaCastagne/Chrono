// Independent DOM regression harness. It tests observable lifecycle contracts,
// not browser rendering, real permissions or notification audibility.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { Window } = await import(process.env.DOM_TEST_MODULE);
const { clearSearchCache } = await import('../dist/data.js');
let sequence = 0;
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const globals = ['window', 'document', 'navigator', 'location', 'localStorage', 'performance', 'fetch', 'Notification', 'BroadcastChannel', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];

async function page(options = {}) {
  clearSearchCache();
  const saved = Object.fromEntries(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const savedNow = Date.now;
  const w = new Window({ url: 'https://example.test/', settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  w.document.write(readFileSync('dist/index.html', 'utf8'));
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  Object.defineProperty(w.document, 'visibilityState', { value: 'visible', configurable: true });
  Object.defineProperty(w.navigator, 'onLine', { value: true, configurable: true });
  Object.defineProperty(w.navigator, 'vibrate', { value: () => true, configurable: true });
  let wall = 1700000000000, mono = 0, taskId = 0;
  const tasks = new Map(), watches = [], notifications = [], permissionRequests = [], notificationPermissionRequests = [], workerMessages = [];
  const workerEvents = new Map(); let reloads = 0;
  const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
  const schedule = (fn, ms = 0, interval = 0) => { const id = ++taskId; tasks.set(id, { fn, at: mono + ms, interval }); return id; };
  const position = (lat = 48.87, accuracy = 20) => ({ coords: { latitude: lat, longitude: 2.35, accuracy }, timestamp: wall });
  Object.defineProperty(w.navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition(ok, error) { permissionRequests.push({ ok, error }); if (!options.pendingGPS) ok(position()); },
    watchPosition(ok, error) { watches.push({ ok, error, active: true }); return watches.length; },
    clearWatch(id) { if (watches[id - 1]) watches[id - 1].active = false; }
  } });
  if (options.wake) Object.defineProperty(w.navigator, 'wakeLock', { value: options.wake, configurable: true });
  if (options.audio) w.AudioContext = options.audio;
  if (options.locks) Object.defineProperty(w.navigator, 'locks', { value: options.locks, configurable: true });
  const registration = {
    waiting: options.waiting ? { postMessage: message => workerMessages.push(message) } : null, installing: null, active: {}, addEventListener() {}, update: async () => {},
    showNotification: async (title, settings) => { notifications.push({ title, ...settings, closed: false, close() { this.closed = true; } }); },
    getNotifications: async (filter = {}) => notifications.filter(n => !n.closed && (!filter.tag || n.tag === filter.tag))
  };
  if (options.notifications || options.waiting) {
    class Notification { static permission = options.notificationPermission || 'granted'; static async requestPermission() { notificationPermissionRequests.push(true); return 'granted'; } constructor(title, settings) { Object.assign(this, { title, ...settings, closed: false }); notifications.push(this); } close() { this.closed = true; } }
    w.Notification = Notification;
    Object.defineProperty(w.navigator, 'serviceWorker', { configurable: true, value: {
      register: async () => registration, addEventListener: (type, fn) => workerEvents.set(type, fn),
      getRegistration: () => options.notificationGate?.promise || Promise.resolve(registration)
    } });
  }
  const storage = options.storage || w.localStorage;
  for (const [key, value] of Object.entries(options.seed || {})) storage.setItem('pa:' + key, JSON.stringify(value));
  const bindings = { window: w, document: w.document, navigator: w.navigator, location: { href: w.location.href, origin: w.location.origin, reload: () => reloads++ }, localStorage: storage,
    performance: { now: () => mono }, fetch: options.fetch || (async () => ({ ok: true, json: async () => ({ features: [], elements: [], androidAvailable: false }) })),
    Notification: w.Notification, BroadcastChannel: options.BroadcastChannel,
    setTimeout: (fn, ms) => schedule(fn, ms), setInterval: (fn, ms) => schedule(fn, ms, ms), clearTimeout: id => tasks.delete(id), clearInterval: id => tasks.delete(id)
  };
  function activate() { for (const [key, value] of Object.entries(bindings)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); Date.now = () => wall; }
  activate();
  await import('../dist/app.js?rechallenge=' + sequence++);
  await flush();
  const $ = selector => w.document.querySelector(selector);
  const click = selector => { activate(); assert.ok($(selector), 'missing control ' + selector); $(selector).click(); };
  const advance = async ms => {
    activate(); const end = mono + ms; let limit = 0;
    while (true) {
      const next = [...tasks].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++limit < 20000, 'bounded virtual timer loop');
      const [id, task] = next; wall += task.at - mono; mono = task.at;
      if (task.interval) task.at += task.interval; else tasks.delete(id);
      task.fn(); await flush();
    }
    wall += end - mono; mono = end; await flush();
  };
  // happy-dom 20 can select the wrong option after innerHTML replacement; the
  // selected attribute is the emitted browser contract, and saved config verifies behavior.
  const dispatchWorker = (type, event = {}) => { activate(); workerEvents.get(type)?.(event); };
  const dispatchStorage = key => { activate(); const event = new w.Event('storage'); Object.defineProperty(event, 'key', { value: key }); w.dispatchEvent(event); };
  const selectedOption = selector => $(selector).querySelector('option[selected]')?.value ?? $(selector).value;
  const change = (selector, value) => { activate(); assert.ok($(selector), selector); $(selector).value = String(value); $(selector).dispatchEvent(new w.Event('change')); };
  const resumeAfterSuspension = async ms => { activate(); wall += ms; mono += ms; for (const [id, task] of [...tasks]) { if (task.at > mono) continue; if (task.interval) task.at = mono + task.interval; else tasks.delete(id); task.fn(); await flush(); } };
  const choose = (name = 'Destination QA') => {
    click('#manual'); $('#pointName').value = name; $('#pointLat').value = '48.85'; $('#pointLon').value = '2.35';
    $('#manualForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  };
  const start = async () => { activate(); if ($('#ack')) { $('#ack').checked = true; $('#ack').dispatchEvent(new w.Event('change')); } click('#start'); await flush(); };
  const arrive = async () => { await advance(30000); assert.ok(watches[0]?.active, 'tracking was started'); watches[0].ok(position(48.85)); await flush(); };
  const terminate = async () => {
    activate();
    if ($('#endAlert')) click('#endAlert');
    else {
      if ($('#dismissAlert') && !$('#alertOverlay').hidden) click('#dismissAlert');
      if ($('#modal').open) $('#modal').close();
      if (!$('#finish') && $('#returnTrip')) click('#returnTrip');
      if ($('#finish')) click('#finish');
      if ($('#confirmStop')) click('#confirmStop');
    }
    await flush();
  };
  const close = async () => { await terminate(); tasks.clear(); await w.happyDOM.close(); Date.now = savedNow; for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
  return { w, $, click, activate, shiftWall: ms => { wall += ms; }, selectedOption, dispatchWorker, dispatchStorage, workerMessages, notificationPermissionRequests, reloads: () => reloads, change, choose, start, arrive, terminate, close, advance, resumeAfterSuspension, flush, watches, notifications, registration, position, permissionRequests, storage };
}
async function scenario(options, action) { const h = await page(options); try { await action(h); } finally { await h.close(); } }

test('a pending screen wake lock cannot block GPS tracking', () => scenario({ wake: { request: () => new Promise(() => {}) } }, async h => {
  h.choose(); await h.start(); await h.advance(5000);
  assert.equal(h.watches.filter(w => w.active).length, 1);
  await h.arrive(); assert.match(h.$('#alertTitle').textContent, /C’est votre arrêt/);
}));

test('a pending audio resume cannot block GPS tracking indefinitely', () => scenario({ audio: class { resume() { return new Promise(() => {}); } } }, async h => {
  h.choose(); await h.start(); await h.advance(5000);
  assert.equal(h.watches.filter(w => w.active).length, 1);
  await h.arrive(); assert.match(h.$('#alertTitle').textContent, /C’est votre arrêt/);
}));

test('an arrival is actionable even while a help dialog is open', () => scenario({}, async h => {
  h.choose(); await h.start(); h.click('#helpTop'); assert.equal(h.$('#modal').open, true);
  await h.arrive();
  assert.match(h.$('#alertTitle').textContent, /C’est votre arrêt/);
  assert.equal(h.$('#modal').open, false, 'a blocking modal must not remain above the arrival');
  assert.equal(h.$('#alertOverlay').hidden, false);
  assert.ok(h.$('#alertOverlay').contains(h.w.document.activeElement));
}));

test('a notification lookup resolving after trip completion cannot send a stale alarm', async () => {
  const gate = deferred();
  await scenario({ notifications: true, notificationGate: gate }, async h => {
    h.choose(); await h.start(); await h.arrive(); await h.terminate();
    gate.resolve(h.registration); await h.flush();
    assert.equal(h.notifications.length, 0);
  });
});

test('revoking GPS leaves the explicitly programmed backup timer operational', () => scenario({}, async h => {
  h.choose(); h.$('#backup').value = '5'; h.$('#backup').dispatchEvent(new h.w.Event('change')); await h.start();
  h.watches[0].error({ code: 1 }); await h.flush();
  assert.equal(h.watches[0].active, false); h.click('#dismissAlert');
  await h.advance(301000);
  assert.equal(h.$('#alertOverlay').hidden, false);
  assert.match(h.$('#alertTitle').textContent, /rappel de secours/);
}));

test('ending a trip closes its delivered web notifications', () => scenario({ notifications: true }, async h => {
  h.choose(); await h.start(); await h.arrive();
  assert.ok(h.notifications.some(n => !n.closed), 'arrival notification was delivered');
  await h.terminate(); await h.flush();
  assert.equal(h.notifications.filter(n => !n.closed).length, 0);
}));

test('erasing local data also closes already delivered journey notifications', () => scenario({ notifications: true }, async h => {
  h.choose(); await h.start(); await h.arrive(); h.click('#dismissAlert');
  h.click('[data-page="settings"]'); h.click('#deleteData'); h.click('#confirmDelete'); await h.flush();
  assert.equal(h.notifications.filter(n => !n.closed).length, 0);
  for (const key of ['favorites', 'recent', 'prefs', 'trip']) assert.equal(h.w.localStorage.getItem('pa:' + key), null);
  assert.ok(h.$('#manual'));
}));

function sharedStorage() {
  const entries = new Map();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key) };
}
function lockManager() {
  let held = false;
  return { async request(name, options, callback) {
    assert.equal(options.ifAvailable, true, 'a second tab must fail promptly, not wait invisibly');
    if (held) return callback(null);
    held = true;
    try { return await callback({ name, mode: 'exclusive' }); } finally { held = false; }
  } };
}
for (const mechanism of ['Web Locks', 'storage lease']) test('only one tab tracks a journey with ' + mechanism, async () => {
  const options = { storage: sharedStorage(), ...(mechanism === 'Web Locks' ? { locks: lockManager() } : {}) };
  let first, second;
  try {
    first = await page(options); first.choose('First tab destination'); await first.start(); await first.advance(2000);
    assert.equal(first.watches.filter(w => w.active).length, 1);
    second = await page(options); second.choose('Second tab destination'); await second.start(); await second.advance(2000);
    assert.equal(second.watches.filter(w => w.active).length, 0, 'the second tab must not duplicate active GPS tracking');
    assert.match(second.$('#toast').textContent, /autre onglet/i);
    assert.equal(first.watches.filter(w => w.active).length, 1, 'the first tab remains the owner');
    await first.terminate();
    await second.start(); await second.advance(2000);
    assert.equal(second.watches.filter(w => w.active).length, 1, 'a released journey can be started in the other tab');
  } finally {
    if (second) await second.close();
    if (first) await first.close();
  }
});

test('canceling a pending GPS activation releases ownership for another tab', async () => {
  const storage = sharedStorage(), locks = lockManager(); let first, second;
  try {
    first = await page({ storage, locks, pendingGPS: true }); first.choose('Pending permission'); await first.start();
    assert.equal(first.permissionRequests.length, 1);
    first.click('#backHome'); await first.flush();
    second = await page({ storage, locks }); second.choose('Other tab'); await second.start(); await second.advance(2000);
    assert.equal(second.watches.filter(w => w.active).length, 1, 'canceled startup must not retain the global lock');
    first.activate(); first.permissionRequests[0].ok(first.position()); await first.flush();
    assert.equal(first.watches.length, 0, 'a late permission result cannot resurrect a canceled trip');
  } finally { if (second) await second.close(); if (first) await first.close(); }
});

test('transport selection configures a genuinely longer high-speed approach', () => scenario({}, async h => {
  h.choose();
  assert.deepEqual([...h.$('#transport').options].map(o => o.value), ['bus', 'tram', 'metro', 'train', 'highspeed', 'ferry', 'cable', 'other']);
  h.$('#ack').checked = true; h.$('#ack').dispatchEvent(new h.w.Event('change'));
  h.change('#transport', 'highspeed');
  assert.equal(h.$('#ack').checked, false, 'changed safety parameters need a new acknowledgement');
  assert.equal(h.$('#start').disabled, true);
  await h.start();
  const trip = JSON.parse(h.storage.getItem('pa:trip'));
  assert.equal(trip.transport, 'highspeed'); assert.ok(trip.radius >= 8000); assert.ok(trip.arrivalRadius >= 300); assert.ok(trip.leadSeconds >= 120);
  assert.ok(h.watches[0].active);
}));

test('favorite toggling does not reset manually adjusted journey parameters', () => scenario({}, async h => {
  h.choose(); h.change('#transport', 'ferry'); h.change('#radiusInput', 2200); h.change('#arrivalInput', 400); h.change('#maxDuration', 72); h.change('#backup', 2880);
  h.click('#favorite');
  assert.equal(h.selectedOption('#transport'), 'ferry'); assert.equal(h.$('#radiusInput').value, '2200'); assert.equal(h.$('#arrivalInput').value, '400'); assert.equal(h.selectedOption('#maxDuration'), '72'); assert.equal(h.selectedOption('#backup'), '2880');
  await h.start(); const trip = JSON.parse(h.storage.getItem('pa:trip'));
  assert.equal(trip.maxDurationHours, 72); assert.equal(trip.backup, 2880);
}));

test('reconfiguring an interrupted journey preserves its saved transport and alert choices', () => scenario({ seed: { trip: {
  id: 'old-journey', target: { name: 'Long-distance ferry', lat: 48.85, lon: 2.35 }, transport: 'ferry', radius: 2400, arrivalRadius: 450, leadSeconds: 90, maxDurationHours: 72, backup: 720, sound: false, vibration: true, voice: false
} } }, async h => {
  assert.equal(h.watches.length, 0); h.click('#resumeTrip');
  assert.equal(h.selectedOption('#transport'), 'ferry'); assert.equal(h.$('#radiusInput').value, '2400'); assert.equal(h.$('#arrivalInput').value, '450'); assert.equal(h.selectedOption('#maxDuration'), '72'); assert.equal(h.selectedOption('#backup'), '720');
  assert.equal(h.$('#ack').checked, false); await h.start();
  const trip = JSON.parse(h.storage.getItem('pa:trip'));
  assert.equal(trip.leadSeconds, 90); assert.equal(trip.sound, false); assert.equal(trip.maxDurationHours, 72); assert.equal(trip.backup, 720);
  assert.notEqual(trip.id, 'old-journey', 'a resumed configuration starts a distinct trip');
}));

for (const [label, radius, arrival] of [['blank radius', '', 130], ['too small', 299, 130], ['too large', 30001, 130], ['arrival too small', 800, 74], ['arrival too large', 2000, 1001], ['equal zones', 500, 500], ['arrival outside approach', 300, 400]]) test('configuration blocks ' + label + ' without requesting GPS', () => scenario({}, async h => {
  h.choose(); h.change('#radiusInput', radius); h.change('#arrivalInput', arrival); await h.start();
  assert.equal(h.permissionRequests.length, 0); assert.equal(h.watches.length, 0); assert.match(h.$('#configureError').textContent, /rayon|approche|arrivée/i);
}));

test('a backup scheduled at automatic shutdown is rejected before activation', () => scenario({}, async h => {
  h.choose(); h.change('#maxDuration', 1); h.change('#backup', 60); await h.start();
  assert.equal(h.permissionRequests.length, 0); assert.match(h.$('#configureError').textContent, /rappel.*précéder/i);
}));

test('a long ferry journey survives six hours and stops at its configured duration', () => scenario({}, async h => {
  h.choose(); h.change('#transport', 'ferry'); await h.start();
  await h.resumeAfterSuspension(7 * 3600000);
  assert.ok(h.$('#finish')); assert.equal(h.watches[0].active, true, 'the obsolete six-hour cap must not stop a long journey');
  await h.resumeAfterSuspension(42 * 3600000);
  assert.equal(h.watches[0].active, false, 'configured expiry stops location even after a suspended page resumes');
  assert.ok(h.$('#manual')); assert.match(h.$('#alertTitle').textContent, /arrêté|terminé|durée.*atteinte/i);
}));

test('an update waits for a journey to end and blocks a new activation while applying', () => scenario({ waiting: true }, async h => {
  assert.ok(h.$('#applyUpdate')); assert.equal(h.workerMessages.length, 0);
  h.choose(); await h.start(); h.click('#applyUpdate');
  assert.equal(h.workerMessages.length, 0); assert.match(h.$('#toast').textContent, /Terminez le trajet/);
  await h.terminate(); h.click('#applyUpdate');
  assert.deepEqual(h.workerMessages, [{ type: 'ACTIVATE_UPDATE' }]);
  h.choose('Next journey'); await h.start();
  assert.equal(h.watches.filter(w => w.active).length, 0, 'new GPS cannot race an accepted update');
}));

test('a pending GPS permission is protected from update activation', () => scenario({ waiting: true, pendingGPS: true }, async h => {
  h.choose(); await h.start(); h.click('#applyUpdate');
  assert.equal(h.workerMessages.length, 0);
  h.click('#backHome'); await h.flush(); h.click('#applyUpdate');
  assert.equal(h.workerMessages.length, 1);
}));

test('a blocked worker update becomes retryable and unsolicited controller changes do not reload', () => scenario({ waiting: true }, async h => {
  h.dispatchWorker('controllerchange'); assert.equal(h.reloads(), 0);
  h.click('#applyUpdate'); assert.equal(h.$('#applyUpdate').disabled, true);
  h.dispatchWorker('message', { data: { type: 'UPDATE_BLOCKED' } });
  assert.equal(h.$('#applyUpdate').disabled, false); assert.match(h.$('#toast').textContent, /autres onglets/);
  h.click('#applyUpdate'); h.dispatchWorker('controllerchange'); assert.equal(h.reloads(), 1);
}));

test('erasing data in another tab stops GPS and prevents late callbacks restoring history', async () => {
  const storage = sharedStorage(), locks = lockManager(); let first, second;
  try {
    first = await page({ storage, locks, seed: { favorites: [{ name: 'Saved private destination', lat: 48.85, lon: 2.35 }] } }); first.choose(); await first.start();
    const latePosition = first.watches[0];
    second = await page({ storage, locks }); second.click('[data-page="settings"]'); second.click('#deleteData'); second.click('#confirmDelete'); await second.flush();
    assert.ok(storage.getItem('pa:reset'), 'the other documents receive a real storage reset event');
    first.dispatchStorage('pa:reset'); await first.flush();
    assert.equal(latePosition.active, false); assert.ok(first.$('#manual'));
    latePosition.ok(first.position(48.85)); await first.flush();
    assert.equal(first.$('#alertOverlay').hidden, true); assert.equal(JSON.parse(storage.getItem('pa:trip')), null); assert.equal(storage.getItem('pa:recent'), null);
    first.click('[data-page="favorites"]'); assert.equal(first.$('[data-fav]'), null);
  } finally { if (second) await second.close(); if (first) await first.close(); }
});

test('an arrival makes the background inert and restores usable focus when dismissed', () => scenario({}, async h => {
  h.choose(); await h.start(); await h.arrive();
  assert.equal(h.$('main').inert, true); assert.equal(h.$('header').inert, true);
  h.click('#dismissAlert'); assert.equal(h.$('main').inert, false); assert.equal(h.$('header').inert, false);
  assert.ok(h.$('#content').contains(h.w.document.activeElement));
}));

test('an empty search leaves direct access to manual destination entry', () => scenario({}, async h => {
  h.$('#query').value = 'Unique absent stop'; h.$('#searchForm').dispatchEvent(new h.w.Event('submit', { bubbles: true, cancelable: true })); await h.flush();
  assert.ok(h.$('#manualFallback')); h.click('#manualFallback'); assert.ok(h.$('#manualForm')); assert.equal(h.$('#modal').open, true);
}));

test('a stalled APK lookup exposes a retry after six seconds', () => scenario({ fetch: () => new Promise(() => {}) }, async h => {
  h.click('#androidHome'); assert.equal(h.$('#modal').open, true); assert.match(h.$('#modal').textContent, /Vérification/);
  await h.advance(6500); assert.ok(h.$('#retryInstall')); assert.equal(h.$('#modal .spinner'), null); assert.match(h.$('#modal').textContent, /pas pu être vérifié/);
}));

test('testing the web alarm never blocks on notification permission', () => scenario({ notifications: true, notificationPermission: 'default' }, async h => {
  h.click('[data-page="settings"]'); h.click('#testSettings'); await h.flush();
  assert.equal(h.notificationPermissionRequests.length, 0); assert.equal(h.$('#alertOverlay').hidden, false); assert.match(h.$('#alertTitle').textContent, /Voilà votre alerte/);
}));

for (const [label, shift] of [['one hour backward', -3600000], ['one day forward', 24 * 3600000]]) test('fresh GPS still arrives after the system clock jumps ' + label, () => scenario({}, async h => {
  h.choose(); await h.start(); h.shiftWall(shift); await h.advance(31000);
  h.watches[0].ok(h.position(48.85)); await h.flush();
  assert.equal(h.$('#alertOverlay').hidden, false); assert.match(h.$('#alertTitle').textContent, /C’est votre arrêt/);
  assert.equal(h.$('#elapsed').textContent, '0 min'); assert.equal(h.$('#age').textContent, '0 s');
}));
