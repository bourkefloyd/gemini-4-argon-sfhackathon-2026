import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT_PATH =
  '/cursor/stores/bc-07436942-d7b2-4c7b-9bb2-9c96a9f41e4d/media/playtest-build-0.png';

async function main() {
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--no-sandbox',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 960 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  page.on('pageerror', (err) => {
    console.error('[pageerror]', err);
  });

  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__MARBLE_PLAYTEST__));

  // Verify Course 2 via __MARBLE_PLAYTEST__ first
  const course2State = await page.evaluate(() => {
    const api = window.__MARBLE_PLAYTEST__;
    api.selectCourse(1);
    return api.stepFrames(60, [0, -1], false);
  });
  console.log('[playtest] Course 2 telemetry verified:', {
    courseId: course2State.courseId,
    position: course2State.position,
    surfaceMaterial: course2State.surfaceMaterial,
    distanceToGoal: course2State.distanceToGoal,
  });

  // Switch back to Course 1 (Practice Race) and roll down Ramp 1 for a dramatic action screenshot
  const showcaseState = await page.evaluate(() => {
    const api = window.__MARBLE_PLAYTEST__;
    api.selectCourse(0);
    return api.stepFrames(135, [0.04, -0.55], false);
  });
  console.log('[playtest] Course 1 showcase telemetry:', {
    courseId: showcaseState.courseId,
    position: showcaseState.position,
    speed: showcaseState.speed,
    slopeDeg: showcaseState.slopeDeg,
    distanceToGoal: showcaseState.distanceToGoal,
  });

  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT_PATH, fullPage: false });
  await browser.close();

  const stat = fs.statSync(OUT_PATH);
  console.log(`[playtest] Saved screenshot to ${OUT_PATH} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
