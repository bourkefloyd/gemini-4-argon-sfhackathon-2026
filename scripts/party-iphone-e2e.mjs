/**
 * iPhone-viewport playtest.
 *
 * The phone loads the prebundled GitHub Pages site (two static files) with
 * ?party=1&room=ARGON&api=<mac tunnel>. Join, trackball, and Rescue Bridge
 * are tiny JSON calls to that tunnel. The laptop stage is the Mac Vite server
 * on localhost, which is the same process the tunnel proxies.
 *
 *   node scripts/party-iphone-e2e.mjs
 *   PARTY_PHONE_ORIGIN=http://127.0.0.1:4174 node scripts/party-iphone-e2e.mjs
 */
import fs from 'node:fs';
import { chromium, devices } from 'playwright';

function tunnelFromLog() {
  const log = fs.readFileSync('/tmp/marble-cf.log', 'utf8');
  const matches = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi) ?? [];
  const dead = new Set([
    'did-scott-yet-queens.trycloudflare.com',
    'argon-demo.trycloudflare.com',
  ]);
  for (let i = matches.length - 1; i >= 0; i--) {
    const host = new URL(matches[i]).hostname;
    if (!dead.has(host)) return matches[i];
  }
  throw new Error('No live trycloudflare URL in /tmp/marble-cf.log');
}

const tunnel = (process.env.PARTY_TUNNEL_URL || tunnelFromLog()).replace(/\/+$/, '');
const stageUrl = process.env.PARTY_STAGE_URL || 'http://127.0.0.1:5173/';
const phoneUrl =
  process.env.PARTY_PHONE_ORIGIN != null
    ? `${process.env.PARTY_PHONE_ORIGIN.replace(/\/+$/, '')}/?party=1&room=ARGON&api=${encodeURIComponent(tunnel)}`
    : `${tunnel}/?party=1&room=ARGON`;
const tunnelHost = new URL(tunnel).host;

const browser = await chromium.launch({ headless: true });
const iphone = devices['iPhone 13'];

async function joinPhone(url) {
  const context = await browser.newContext({ ...iphone });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const started = Date.now();
  const tunnelRequests = [];
  page.on('request', (req) => {
    try {
      if (new URL(req.url()).host === tunnelHost) tunnelRequests.push(req.url());
    } catch {
      // Ignore unparseable URLs.
    }
  });
  const joined = page.waitForResponse(
    (res) => res.url().includes('/api/party/join') && res.request().method() === 'POST' && res.ok(),
  );
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('mobile-party-controller').waitFor({ state: 'visible' });
  const controllerMs = Date.now() - started;
  await joined;
  const assets = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      duration: entry.duration,
      startTime: entry.startTime,
      responseEnd: entry.responseEnd,
    })),
  );
  const pageOrigin = new URL(page.url()).origin;
  const staticAssets = assets.filter((entry) => {
    if (!entry.name.startsWith(pageOrigin)) return false;
    return entry.initiatorType === 'script' || entry.initiatorType === 'link' || entry.initiatorType === 'css';
  });
  const devModules = assets.filter(
    (entry) => entry.name.includes('/src/') || entry.name.includes('/@vite/') || entry.name.includes('node_modules'),
  );
  if (devModules.length > 0) {
    throw new Error(`Phone loaded Vite dev modules: ${devModules.map((entry) => entry.name).join(', ')}`);
  }
  const heavyChunks = staticAssets.filter((entry) =>
    /\/App-|\/sdf-courses-|\/systems-/.test(entry.name),
  );
  if (heavyChunks.length > 0) {
    throw new Error(`Phone loaded stage chunks: ${heavyChunks.map((entry) => entry.name).join(', ')}`);
  }
  // Entry + React vendor + CSS. The stage, SDF, and QR encoder stay off this path.
  if (staticAssets.length > 3) {
    throw new Error(
      `Phone downloaded ${staticAssets.length} static files, expected at most 3: ${staticAssets
        .map((entry) => entry.name)
        .join(', ')}`,
    );
  }
  const handle = await page.getByLabel('Player Handle').inputValue();
  await page.getByTestId('crowd-mutator-rescueBridge').click();
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="party-controller-feedback"]');
      return Boolean(el && /Rescue Bridge/i.test(el.textContent || ''));
    },
    null,
    { timeout: 10000 },
  );
  const pad = page.getByTestId('mobile-trackball-pad');
  const box = await pad.boundingBox();
  if (!box) throw new Error('trackball pad has no box');
  const inputSent = page.waitForResponse(
    (res) => res.url().includes('/api/party/input') && res.ok(),
  );
  await pad.dispatchEvent('pointerdown', {
    clientX: box.x + box.width * 0.72,
    clientY: box.y + box.height * 0.38,
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    bubbles: true,
  });
  await inputSent;
  const leaked = tunnelRequests.filter((target) => {
    const path = new URL(target).pathname;
    if (path.includes('/api/party') || path.startsWith('/assets/')) return false;
    if (path === '/' || path.endsWith('/')) return false;
    return true;
  });
  if (leaked.length > 0) {
    throw new Error(`Phone requested unexpected tunnel URLs: ${leaked.join(', ')}`);
  }
  const assetMs = staticAssets.length
    ? Math.max(...staticAssets.map((entry) => entry.responseEnd)) -
      Math.min(...staticAssets.map((entry) => entry.startTime))
    : 0;
  console.log(
    JSON.stringify({
      phone: 'ready',
      handle,
      controllerMs,
      assetMs: Math.round(assetMs),
      staticAssets: staticAssets.map((entry) => entry.name.replace(pageOrigin, '')),
      tunnelApiCalls: tunnelRequests.length,
    }),
  );
  return { context, page, handle, controllerMs };
}

try {
  const phone = await joinPhone(phoneUrl);
  const stageContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const stage = await stageContext.newPage();
  stage.setDefaultTimeout(20000);
  await stage.goto(stageUrl, { waitUntil: 'domcontentloaded' });
  await stage.getByTestId('hud-party-toggle').click();
  await stage.getByTestId('qr-party-hud-modal').waitFor({ state: 'visible' });
  await stage
    .getByTestId('party-toast-feed')
    .getByText(new RegExp(`@${phone.handle}.*Rescue Bridge`))
    .waitFor();
  const state = await stage.evaluate(async () => {
    const res = await fetch('/api/party/state');
    return res.json();
  });
  const player = state.players.find((entry) => entry.handle === phone.handle);
  if (!player) throw new Error('Stage room snapshot is missing the phone marble');
  if (player.roomId) {
    await stage.getByTestId(`room-pill-${player.roomId}`).click();
  }
  await stage.getByTestId('party-racer-roster').getByText(`@${phone.handle}`).waitFor();
  const joinText = await stage.getByTestId('party-join-url').innerText();
  const pagesHost = 'bourkefloyd.github.io/gemini-4-argon-sfhackathon-2026';
  if (!joinText.includes(pagesHost) || !joinText.includes('api=') || !joinText.includes(tunnelHost)) {
    throw new Error(`Stage QR URL is not the GitHub Pages party link: ${joinText}`);
  }
  const moved = Math.hypot(player.input?.moveXZ?.[0] ?? 0, player.input?.moveXZ?.[1] ?? 0);
  if (moved < 0.15) throw new Error(`Trackball input did not reach the stage (mag ${moved})`);
  const mutationLive = (state.activeMutations ?? []).some((entry) => entry.kind === 'rescueBridge');
  const mutationToast = (state.recentToasts ?? []).some(
    (entry) => entry.text?.includes(`@${phone.handle}`) && /Rescue Bridge/.test(entry.text),
  );
  if (!mutationLive && !mutationToast) {
    throw new Error('Stage snapshot is missing the rescueBridge mutation');
  }
  console.log(
    JSON.stringify({
      ok: true,
      handle: phone.handle,
      controllerMs: phone.controllerMs,
      move: player.input.moveXZ,
      joinUrl: joinText,
      mutations: state.activeMutations.map((entry) => entry.kind),
    }),
  );
  await phone.context.close();
  await stageContext.close();
} finally {
  await browser.close();
}
