const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const WINDOW_MS = 15 * 60 * 1000;

function fixture() {
    let now = 0;
    let cleanup;
    let interval;
    let unrefCalled = false;
    let windows;
    class WindowMap extends Map {
        constructor() {
            super();
            windows = this;
        }
    }
    const context = {
        module: { exports: {} },
        Map: WindowMap,
        Date: { now: () => now },
        setInterval(callback, milliseconds) {
            cleanup = callback;
            interval = milliseconds;
            return { unref() { unrefCalled = true; } };
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/middlewares/aiRateLimit.js'), 'utf8'), context);
    const request = (ip = 'client', userId = 1) => {
        const result = { headers: {}, statusCode: 200, allowed: false };
        const res = {
            set(name, value) { result.headers[name] = value; },
            status(code) { result.statusCode = code; return this; },
            json(body) { result.body = body; return this; },
        };
        context.module.exports.aiRateLimit({ ip, user: { id: userId } }, res, () => { result.allowed = true; });
        return result;
    };
    return { request, windows, cleanup: () => cleanup(), advance: ms => { now += ms; }, interval, unrefCalled };
}

test('AI limiter blocks the 21st request and resets after the window expires', () => {
    const f = fixture();
    for (let i = 0; i < 20; i++) assert.equal(f.request().allowed, true);
    f.advance(1000);
    const blocked = f.request();
    assert.equal(blocked.statusCode, 429);
    assert.equal(blocked.headers['Retry-After'], '899');
    assert.equal(f.request('client', 2).allowed, true);
    f.advance(WINDOW_MS - 1000);
    assert.equal(f.request().allowed, true);
});

test('cleanup deletes expired clients at the boundary and preserves active limits', () => {
    const f = fixture();
    f.request('expired');
    f.advance(1000);
    for (let i = 0; i < 20; i++) f.request('active');
    f.advance(WINDOW_MS - 1000);
    f.cleanup();
    assert.equal(f.windows.has('expired:1'), false);
    assert.equal(f.windows.has('active:1'), true);
    assert.equal(f.request('active').statusCode, 429);
    f.advance(1000);
    f.cleanup();
    assert.equal(f.windows.size, 0);
});

test('cleanup runs every window without keeping the Node process alive', () => {
    const f = fixture();
    assert.equal(f.interval, WINDOW_MS);
    assert.equal(f.unrefCalled, true);
});
