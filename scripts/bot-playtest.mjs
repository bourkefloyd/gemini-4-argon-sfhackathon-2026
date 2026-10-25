#!/usr/bin/env node
/**
 * Headless CLI Playtest Runner (`scripts/bot-playtest.mjs`)
 *
 * Runs all courses in Node at 1000+ Hz using `MarblePhysics` + `AutonomousDriver`,
 * verifies that the bot reaches `'goal'` on `Practice Race` and `Intermediate Madness`,
 * and outputs a structured telemetry report ready for the Gemini 4 Argon 1M Architect.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const entrySource = `
import { BUILT_IN_COURSES, generateArchitectCoursePreset } from './src/courses/index.ts';
import { runHeadlessBotRollout } from './src/bot/index.ts';

export async function executeCliPlaytest() {
  const courses = [
    ...BUILT_IN_COURSES,
    generateArchitectCoursePreset('spiral-citadel'),
  ];

  const styles = ['tourist', 'speedrunner', 'chaos-explorer'];
  const report = {
    generatedAt: new Date().toISOString(),
    coursesTested: courses.length,
    totalRollouts: courses.length * styles.length,
    runs: [],
  };

  let allRequiredGoalsReached = true;

  console.log('================================================================================');
  console.log('  MARBLE MADNESS SDF — 120 Hz AUTONOMOUS BOT HEADLESS PLAYTEST & TELEMETRY CLI  ');
  console.log('================================================================================\\n');

  for (const course of courses) {
    for (const style of styles) {
      const result = runHeadlessBotRollout(course, {
        style,
        maxDurationSec: style === 'chaos-explorer' ? 28 : course.parTimeSec,
        seed: 2026,
      });

      const { summary, finalState, effectiveHz, wallClockMs } = result;
      report.runs.push({
        courseId: course.id,
        courseName: course.name,
        style,
        reachedGoal: summary.reachedGoal,
        outcome: summary.outcome,
        durationSec: summary.durationSec,
        parTimeSec: summary.parTimeSec,
        timeRemainingSec: summary.timeRemainingSec,
        effectiveHz,
        wallClockMs,
        topSpeed: summary.topSpeed,
        topHorizontalSpeed: summary.topHorizontalSpeed,
        averageSpeed: summary.averageSpeed,
        slipRatioPeak: summary.slipRatioPeak,
        highSlipEventsCount: summary.highSlipEventsCount,
        totalAirtimeSec: summary.totalAirtimeSec,
        longestJumpAirtimeSec: summary.longestJumpAirtimeSec,
        jumpCount: summary.jumpCount,
        backspinBrakeCount: summary.backspinBrakeCount,
        backspinTimeSec: summary.backspinTimeSec,
        deathCount: summary.deathCount,
        deathCoordinates: summary.deathCoordinates,
        splitTimes: summary.splitTimes,
        bottleneckSegments: summary.bottleneckSegments,
        surfaceTimeBreakdownSec: summary.surfaceTimeBreakdownSec,
        finalPosition: finalState.position,
        argonContextPromptBlock: summary.argonContextPromptBlock,
      });

      if (
        (course.id === 'practice-race' || course.id === 'intermediate-madness') &&
        (style === 'tourist' || style === 'speedrunner') &&
        !summary.reachedGoal
      ) {
        allRequiredGoalsReached = false;
      }

      console.log(summary.argonContextPromptBlock);
      console.log(
        \`  -> Simulated \${summary.framesSimulated} steps at \${effectiveHz} Hz (\${wallClockMs} ms) | Final pos: [\${finalState.position.map((n) => n.toFixed(2)).join(', ')}]\\n\`
      );
    }
  }

  return { report, allRequiredGoalsReached };
}
`;

async function main() {
  const bundleOutPath = path.join(rootDir, '.tmp-bot-playtest-bundle.mjs');
  try {
    await build({
      stdin: {
        contents: entrySource,
        resolveDir: rootDir,
        sourcefile: 'bot-playtest-entry.ts',
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      outfile: bundleOutPath,
      logLevel: 'silent',
    });

    const mod = await import(pathToFileURL(bundleOutPath).href);
    const { report, allRequiredGoalsReached } = await mod.executeCliPlaytest();

    const jsonOutPath = process.env.BOT_PLAYTEST_JSON_OUT;
    if (jsonOutPath) {
      fs.mkdirSync(path.dirname(path.resolve(jsonOutPath)), { recursive: true });
      fs.writeFileSync(jsonOutPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`Saved JSON telemetry report to ${jsonOutPath}`);
    }

    console.log('--- JSON TELEMETRY SUMMARY (COMPACT) ---');
    console.log(
      JSON.stringify(
        report.runs.map((r) => ({
          courseId: r.courseId,
          style: r.style,
          outcome: r.outcome,
          durationSec: r.durationSec,
          effectiveHz: r.effectiveHz,
          topSpeed: r.topSpeed,
          slipRatioPeak: r.slipRatioPeak,
          airtimeSec: r.totalAirtimeSec,
          deaths: r.deathCount,
          topBottleneck: r.bottleneckSegments[0]?.label ?? 'none',
        })),
        null,
        2,
      ),
    );

    if (!allRequiredGoalsReached) {
      console.error('ERROR: Bot failed to reach goal on required courses.');
      process.exitCode = 1;
    }
  } finally {
    if (fs.existsSync(bundleOutPath)) {
      fs.unlinkSync(bundleOutPath);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
