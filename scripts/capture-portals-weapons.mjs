import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT_PATH =
  '/cursor/stores/bc-07436942-d7b2-4c7b-9bb2-9c96a9f41e4d/media/portals-weapons.png';

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

  const showcaseState = await page.evaluate(() => {
    const api = window.__MARBLE_PLAYTEST__;
    api.selectCourse(0);

    // 1. Place linked Blue & Orange SDF Portals in full view of the isometric camera on Turn 1 Plaza & Ramp 1
    api.setPortals([
      {
        id: 'showcase-portal-pair',
        // Blue Portal facing the camera on the Turn 1 Plaza wall/floor
        posA: [-1.1, 5.55, -17.8],
        normalA: [0.22, 0.32, 0.921],
        upA: [0.0, 0.943, -0.332],
        // Orange Portal on the eastern side of the plaza tilted to launch down Ramp 2
        posB: [6.8, 5.55, -15.6],
        normalB: [-0.42, 0.48, 0.77],
        upB: [0.0, 0.878, -0.478],
        radius: 1.55,
        activeA: true,
        activeB: true,
        flingBoost: 1.05,
      },
    ]);

    // 2. Roll the marble down Ramp 1 into the Mid-Course Turn Plaza
    api.stepFrames(145, [0.08, -0.75], false);

    // 3. Carve a CSG Matter Bomb crater ([F]) right into the Turn 1 Plaza floor
    api.triggerWeapon('matterBomb', {
      targetPosition: [1.6, 4.55, -15.2],
      radius: 1.95,
    });

    // 4. Activate Ferrofluid Bridge Extruder ([V]) and extrude a glowing capsule bridge trail
    api.teleportMarble([3.4, 5.2, -16.6], [7.5, 0, 0.8]);
    api.triggerWeapon('bridgeExtruder', { radius: 0.95 });
    api.stepFrames(28, [0.85, 0.1], false);

    // 5. Erupt a Tectonic Pop-Ramp ([B]) ahead of the marble
    api.triggerWeapon('popRamp', {
      targetPosition: [8.6, 4.45, -16.4],
      radius: 1.85,
    });

    // Step a few frames so the marble is airborne above the ramp & bridge with both portals in frame
    const finalState = api.stepFrames(10, [0.5, 0], false);
    // Pause further RAF ticks so software-rendered SwiftShader doesn't saturate the GPU queue during CDP screenshot
    window.requestAnimationFrame = () => 0;
    return finalState;
  });

  console.log('[portals-weapons] Showcase telemetry:', {
    courseId: showcaseState.courseId,
    position: showcaseState.position,
    speed: showcaseState.speed,
    portalsCount: showcaseState.portals.length,
    mutationsCount: showcaseState.fieldMutations.length,
    bridgeExtruderRemainingSec: showcaseState.bridgeExtruderRemainingSec,
  });

  await page.waitForTimeout(250);
  await page.screenshot({ path: OUT_PATH, fullPage: false });
  await browser.close();

  const stat = fs.statSync(OUT_PATH);
  console.log(`[portals-weapons] Saved screenshot to ${OUT_PATH} (${stat.size} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
