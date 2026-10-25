/**
 * Self-contained interactive HTML diagram of the Argon 1M architecture.
 * The Builder Guide asks for this before a demo so judges can see the loop
 * without reading the repo.
 */

export interface ArchitectureDiagramStats {
  readonly totalTokens: number;
  readonly cachedTokens: number;
  readonly dynamicTokens: number;
  readonly courseName: string;
}

export function buildArchitectureDiagramHtml(stats: ArchitectureDiagramStats): string {
  const total = Math.round(stats.totalTokens).toLocaleString();
  const cached = Math.round(stats.cachedTokens).toLocaleString();
  const dynamic = Math.round(stats.dynamicTokens).toLocaleString();
  const course = stats.courseName.replace(/[<>&"]/g, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Marble Madness SDF — 1M Architecture</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #07101c; color: #e7f2ff; font: 13px/1.35 "Segoe UI", sans-serif; }
  h1 { font-size: 15px; margin: 12px 16px 4px; letter-spacing: 0.04em; }
  p.lead { margin: 0 16px 10px; color: #9fb6d0; }
  svg { width: 100%; height: auto; display: block; }
  .node { cursor: pointer; }
  .node rect { fill: #102033; stroke: #3ce8ff; }
  .node.argon rect { stroke: #d96bff; }
  .node.flash rect { stroke: #ffd23f; }
  .node.agy rect { stroke: #ff9f43; }
  .node.gate rect { stroke: #28f79c; }
  .node text { fill: #f4fbff; font-size: 11px; }
  #detail { margin: 8px 16px 16px; min-height: 3.2em; padding: 8px 10px; border: 1px solid #24506a; border-radius: 8px; background: #0c1828; }
</style>
</head>
<body>
<h1>HOW THIS WORKS — ${course}</h1>
<p class="lead">Click a block. One CourseSpec feeds the picture and the 120 Hz marble. Argon only hot-swaps after a person approves.</p>
<svg viewBox="0 0 920 460" role="img" aria-label="Architecture diagram">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#7fd4ff" />
    </marker>
  </defs>
  <g class="node" data-detail="The 1,000,000-token window holds engine contracts, the CPU/GPU SDF kernel, compiled GLSL and WGSL, every course, the feel bible, and the live 120 Hz death and slip trace. Static prefix is implicitly cached at 95% off. This session packed ${total} tokens (${cached} cached, ${dynamic} live telemetry).">
    <rect x="24" y="24" width="250" height="92" rx="10" />
    <text x="40" y="52">1M-token context</text>
    <text x="40" y="72">${total} / 1,000,000 packed</text>
    <text x="40" y="92">95% implicit cache on the prefix</text>
  </g>
  <g class="node argon" data-detail="gemini-4-argon, thinking_level high, is the lead architect. It reads the full window and writes the macro CourseSpec: elevation, tourist line, and the risk-reward shortcut.">
    <rect x="330" y="24" width="250" height="92" rx="10" />
    <text x="346" y="52">gemini-4-argon</text>
    <text x="346" y="72">Lead architect · thinking high</text>
    <text x="346" y="92">Macro layout + shortcut topology</text>
  </g>
  <g class="node flash" data-detail="gemini-3.8-flash runs in parallel as the hazard and portal specialist: SDF pistons, wave floors, Steelies, and linked blue/orange flings. gemini-3.8-flash-tts speaks the one-line arcade callout.">
    <rect x="630" y="24" width="266" height="92" rx="10" />
    <text x="646" y="52">gemini-3.8-flash</text>
    <text x="646" y="72">Hazards, portals, TTS announcer</text>
    <text x="646" y="92">Parallel with the lead</text>
  </g>
  <g class="node" data-detail="The CourseSpec is one scene. The CPU evaluator (src/sdf/eval-cpu.ts) and the GLSL/WGSL compilers lower the same primitives and CSG ops. That shared program is the .msdf RPN bytecode idea: distance, normal, and material stay lockstep so the marble cannot fall through a surface the shader did not draw.">
    <rect x="24" y="180" width="400" height="110" rx="10" />
    <text x="40" y="210">Lockstep SDF + .msdf RPN bytecode</text>
    <text x="40" y="232">CourseSpec → CPU distance kernel</text>
    <text x="40" y="252">same tree → GLSL ES 3.00 + WGSL raymarch</text>
    <text x="40" y="272">tetrahedral normals, 120 Hz sphere cast</text>
  </g>
  <g class="node agy" data-detail="antigravity-preview-09-2026 is the managed agent. The Interactions call sets agent_config type antigravity, model gemini-4-argon, environment remote, background true. The sandbox re-checks solvability before the approve button unlocks. Allowlist: api.github.com and generativelanguage.googleapis.com.">
    <rect x="470" y="180" width="426" height="110" rx="10" />
    <text x="486" y="210">antigravity-preview-09-2026</text>
    <text x="486" y="232">Managed-agent remote sandbox</text>
    <text x="486" y="252">model gemini-4-argon · background true</text>
    <text x="486" y="272">Signs the solvability certificate</text>
  </g>
  <g class="node gate" data-detail="The 120 Hz solvability gate runs createCpuWorldEvaluator, compileCourseToGlsl, compileCourseToWgsl, and a bot rollout. startPos must be grounded and the goal must be reachable. Nothing hot-swaps until you press Approve.">
    <rect x="180" y="340" width="560" height="92" rx="10" />
    <text x="200" y="372">120 Hz solvability gate → human Approve &amp; Hot-Swap</text>
    <text x="200" y="394">Grounded spawn, shader compile, bot rollout, then your button</text>
    <text x="200" y="414">People stay in control of the live course</text>
  </g>
  <path d="M274 70 H330" stroke="#7fd4ff" stroke-width="2" marker-end="url(#arrow)" />
  <path d="M580 70 H630" stroke="#7fd4ff" stroke-width="2" marker-end="url(#arrow)" />
  <path d="M455 116 V160 H224 V180" stroke="#7fd4ff" stroke-width="2" fill="none" marker-end="url(#arrow)" />
  <path d="M763 116 V160 H683 V180" stroke="#7fd4ff" stroke-width="2" fill="none" marker-end="url(#arrow)" />
  <path d="M424 235 H470" stroke="#7fd4ff" stroke-width="2" marker-end="url(#arrow)" />
  <path d="M683 290 V320 H460 V340" stroke="#28f79c" stroke-width="2" fill="none" marker-end="url(#arrow)" />
</svg>
<div id="detail">Click any block to read what that stage does during the three-minute demo.</div>
<script>
  const detail = document.getElementById('detail');
  document.querySelectorAll('.node').forEach((node) => {
    node.addEventListener('click', () => {
      detail.textContent = node.getAttribute('data-detail') || '';
    });
  });
</script>
</body>
</html>`;
}
