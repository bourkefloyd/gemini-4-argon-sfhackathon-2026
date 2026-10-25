# Lockstep Jet-SDFs for a real-time WebGPU marble

Research landing page for the clean-room Marble Madness remake, and the builder guide for the Gemini 4 Argon SF Hackathon. The paper is [paper/README.md](paper/README.md). Numbers below are the ones computed in the notebooks and `tests/security-bytecode.spec.ts`.

**Paper:** [Lockstep Analytical Jet-SDFs, Non-Euclidean Portals, and One-Way Geometric Compilation for Real-Time WebGPU Physics Games](paper/README.md)  
**Notebooks:** [frontier and inventions](notebooks/sdf_frontier_and_inventions.ipynb) · [graphics, physics, living SDF](notebooks/sdf_marble_madness_guide.ipynb)  
**Figures:** [docs/figures/](docs/figures/)

## Abstract

A 120 Hz marble and a WebGPU picture share one analytic distance. The symplectic jet (`jSDF`) carries \((d, \nabla d, \partial_t d)\) through a smooth-minimum in one pass: \(4.25\times\) a 4-tap tetrahedral normal in the notebook loop, and a \(1.92\times\) meniscus stretch where \(\|\nabla d\| = 0.522\). The metric-bridged portal (`pSDF`) stays Lipschitz \(1.000\) across the aperture (clipped disc: \(25.7\)). \(\kappa\text{-March}\) cuts mean sphere-trace steps by \(35.9\%\). One-way `.msdf` bytecode is up to \(9.21\times\) the AST, the sparse brick atlas is \(41.86\times\)–\(581.28\times\), and a 120 Hz proof-of-play replay verifies in \(8.19\)–\(9.87\,\mathrm{ms}\). Course synthesis packs six sections into `gemini-4-argon` with a \(95\%\) implicit-cache discount.

## Key empirical results

| Result | Measured value | Where |
| --- | --- | --- |
| `jSDF` vs 4-tap tetrahedron | **\(4.25\times\)** (20.3 ms vs 86.4 ms / 1k queries) | Frontier notebook |
| Meniscus launch, \(\|\nabla d\| = 0.522\) | **\(1.92\times\)** (\(-2.458\) vs \(-1.283\)) | Frontier notebook |
| `pSDF` Lipschitz, neighbor texels | **\(1.000\)** (random rim pairs \(0.994\)) | Frontier notebook |
| Clipped-disc Lipschitz, same grid | **\(25.7\)** | Frontier notebook |
| \(\kappa\text{-March}\) step count | \(22.12 \to 14.19\) (**\(35.9\%\)**) | Frontier notebook |
| `.msdf` RPN vs AST | **\(9.21\times\)** Practice, \(6.95\times\) Intermediate, \(8.70\times\) dense | Security tests |
| Bytecode size | Intermediate **\(41.5\%\)** smaller (5,036 B → 2,944 B) | Security tests |
| Sparse brick atlas vs AST | **\(41.86\times\)–\(581.28\times\)** | Security tests |
| `.mpop` proof of play | **\(8.19\)–\(9.87\,\mathrm{ms}\)** for 470 ticks | Security tests |
| Look-ahead bot | **\(>1{,}000\,\mathrm{Hz}\)** wall-clock, 120 Hz physics step | `tests/bot-playtest.spec.ts` |

The checked-in bot gate is \(>1{,}000\,\mathrm{Hz}\). A \(2{,}900\)–\(9{,}600\,\mathrm{Hz}\) band is not in those assertions.

## Traditional Polygon/BVH vs. Lockstep SDF Pipeline

Why not build this in Three.js / Unreal with a stock triangle-mesh BVH collider (Rapier / PhysX)? A direct quantitative comparison across rolling physics, live CSG mutation, AI course authoring, and 4K primary visibility shows both where our lockstep SDF pipeline stands out and where traditional rasterization still wins:

| Dimension | Traditional Polygon Mesh + BVH (Three.js/UE5 + Rapier/PhysX) | Lockstep Graphics + Physics SDF Pipeline (Ours) | Measured Advantage / Trade-off |
| --- | --- | --- | --- |
| **Curved Chute Rolling Normals (\(v = 22\,\mathrm{u/s}\))** | Piecewise-planar facets (\(C^0\)): **\(2.81^\circ\)–\(5.63^\circ\)** edge jumps trigger **\(0.66\)–\(1.32\,\mathrm{u/s}\)** phantom ghost hops | **\(C^\infty\) analytical `jSDF` normals** (**\(0.00^\circ\)** facet chatter) + exact **\(1.92\times\)** meniscus velocity stretch | **Ours:** Eliminates internal-edge ghost collisions |
| **Realtime CSG Mutation (Crater / Bridge)** | CPU mesh boolean + BVH collider refit + GPU VBO re-upload: **\(9.4\,\mathrm{ms}\)** (5k tris) to **\(44.6\,\mathrm{ms}\)** (60k tris) | 64-byte `FieldMutation[16]` ring-buffer write: **\(0.0018\,\mathrm{ms}\)** (\(1.8\,\mu\mathrm{s}\)), zero remesh | **Ours:** **\(5{,}200\times\)–\(24{,}700\times\) faster** edit latency |
| **Non-Euclidean Portals** | Stencil / RTT camera recursion + cloned proxy colliders; clipped SDF disc jumps to Lipschitz **\(25.7\)** | Metric-bridged `pSDF` keeps **Lipschitz \(1.000\)** across throat; shadows, AO, and 120 Hz contacts cross natively | **Ours:** Unified visual + shadow + 120 Hz contact portal |
| **`gemini-4-argon` Course Synthesis** | Raw watertight mesh + hulls: **\(\sim 685{,}000\) tokens** (\(\sim 2.7\,\mathrm{MB}\)); dual Three.js + Rapier code: **\(\sim 6{,}400\) tokens** (drift risk) | Declarative `CourseSpec` CSG tree: **\(1{,}273\) tokens** (\(\sim 5.0\,\mathrm{KB}\)), compiles in **\(<1.5\,\mathrm{ms}\)** with zero visual/physics drift | **Ours:** **\(538\times\) smaller** than mesh; fits 6 courses + engine in \(<15\%\) of 1M window |
| **4K Primary Visibility (\(N = 1{,}000\) objects)** | Hardware Z-buffer rasterizer shades frontmost pixels in \(O(1)\): **\(2.76\,\mathrm{ms}\)** | Naive SDF trace blows 60 FPS at \(N \approx 83\) (\(177\,\mathrm{ms}\)); **Sparse Brick Atlas + \(\kappa\text{-March}\): \(5.29\,\mathrm{ms}\)** | **Traditional wins by \(1.9\times\)** on dense static UV meshes & skeletal rigs; bricks close the gap by **\(33.5\times\)** |

![Traditional Polygon Mesh + BVH vs. Lockstep Analytical Jet-SDF Pipeline](docs/figures/sdf-vs-traditional-mesh-comparison.png)

## Figures

![Industry frontier](docs/figures/sdf-industry-frontier-plot.png)

![Jet meniscus launch](docs/figures/sdf-jsdf-meniscus-launch.png)

![Portal field and shadow](docs/figures/sdf-portal-field-and-shadow.png)

![Hard seam versus smooth fillet](docs/figures/sdf-ch2-hard-vs-smooth-seam.png)

![Sphere tracing](docs/figures/sdf-ch3-sphere-tracing.png)

![Field mutations](docs/figures/sdf-ch5-field-mutations.png)

![Playtest Build 1](docs/figures/playtest-build-1.png)

![Portals and weapons](docs/figures/portals-weapons.png)

![Campaign courses](docs/figures/courses-campaign.png)

Run the game with `npm install` and `npm run dev` (Vite on port 5173). `npm test` reruns the security table, the solvability gate, and the bot rollout.

---

# Gemini 4 Argon SF Hackathon — team guide

Practical notes for a team hacking at this event. Event facts come from the [official details page](https://cerebralvalley.ai/e/gemini-4-argon-sf/details) as fetched on 2026-10-25. Builder facts come from Bourke’s shared Google Doc, [Build with Gemini 4 Argon: 1-day hackathon builder guide](https://docs.google.com/document/d/1kN0n6hPNNTIHMVqf5-hDACrZuIg4KFrWiYpla4WQW8w/edit?usp=sharing), read the same day. Anything neither source states is listed under [What these sources do not say](#what-these-sources-do-not-say). Do not treat those gaps as rules.

The [project section](#the-hack-project-intent) is Bourke’s concept for this repo. It is not an event rule. Sentences there that are not on the event page, not in the builder guide, and not taken from the inspiration repo, are marked as project intent.

**Event source:** https://cerebralvalley.ai/e/gemini-4-argon-sf/details  
**Canonical event page:** https://cerebralvalley.ai/e/gemini-4-argon-sf  
**Markdown alternate linked from the details page:** https://cerebralvalley.ai/e/gemini-4-argon-sf.md  
**Builder guide:** https://docs.google.com/document/d/1kN0n6hPNNTIHMVqf5-hDACrZuIg4KFrWiYpla4WQW8w/edit?usp=sharing

## The hack (project intent)

**Build a remake of Marble Madness using signed distance fields (SDFs).** That choice is this project’s intent. The event page does not name Marble Madness, SDFs, or this repo.

A marble-on-a-course game is a ball moving through one continuous solid: banks, gaps, tubes, rails. An SDF is a function from a point to the signed distance to that solid. **Project intent:** use that one description for both the picture and the motion. Raymarch the field to draw the course. Use the distance, and the gradient as a surface normal, to keep the marble from sinking through it. The level can stay a spec plus a shader-sized function instead of a mesh plus a separate collider. The event page does not state that rationale. [gamex](#inspiration-repo) is already built that way: one scene specification, a GPU raymarch to draw it, and a CPU evaluation of the same scene for physics.

### Hard-problem bet

**Project intent:** spend the hack on two hard Gemini 4 Argon problems: a context on the order of a **million tokens**, and **parallel agents**.

The builder guide states the mechanism. `gemini-4-argon` puts input, thinking, and output in one **1M-token** window, and it keeps context across large codebases. Most teams use Argon as the lead and `gemini-3.8-flash` for parallel leaf tasks. **Managed Agents** in that guide means the Antigravity managed agent, `antigravity-preview-09-2026`: one call starts a Google-hosted Linux sandbox where Argon writes code, runs tests, manages files, calls MCP tools, and searches the web. The event page names a “Best use of Managed Agents” prize and does not say this sandbox, or the split below, is what that prize scores.

Working agreement for the team, not a design spec:

- Hold the **course, the shaders, and the level spec in one context**, so a change to the course is visible to the code that draws it and the code that moves the marble. **Project intent:** that shared window is filled with those three, not with a general codebase dump.
- Split ownership across agents: **level, physics, camera, and rules**. One agent per surface. They meet in that shared context. The guide’s matching pattern is Argon as architect (`thinking_level` `medium` or `high`) reviewing diffs, with `gemini-3.8-flash` on parallel leaf modules and high-frequency checks.
- Keep each agent’s job to that surface. Do not grow this into an engine outline during the hack.

### Inspiration repo

Inspiration only: https://github.com/bourkefloyd/gamex

Do not vendor it and do not paste its source into this repo. None of its files are included here. This is a **clean-room** remake: use the ideas below, then write our own code. The notes are the public-safe summary of a direct read of that private repo (`SDF Marble`, v1.0.0) on 2026-10-25.

**What it is.** A browser marble-course game and procedural world sandbox. The course, terrain, volumetric fog, and marble bodies are signed distance fields, not triangle meshes. You roll and jump a marble along elevated tracks, slopes, and procedural terrain toward a goal pad. A node-graph editor and a session server support live authoring and multiplayer.

**License.** `package.json` declares **ISC** (`"license": "ISC"`). There is no root `LICENSE` file. The GitHub repo is private. Inspiration only.

**Stack.** Three.js `^0.183.2` with **`WebGPURenderer` and TSL** node shaders that sphere-trace the course (WebGPU/WGSL). Post uses Three.js `RenderPipeline`, ACES Filmic, and optional HDR bloom. UI is React 19, `@xyflow/react` for the graph editor, and Vite 8. The session server is Node.js HTTP, WebSocket (`ws`), and server-sent events, with `node:sqlite` in WAL mode and optional `@simplewebauthn` passkeys. Tests are Vitest, plus Playwright on headed Chromium with `--enable-unsafe-webgpu`.

Patterns worth using, without copying the implementation:

1. **Lockstep CPU/GPU SDF evaluation.** Each primitive (boxes, rounded boxes, spheres, cylinders, capsules, tori, cones, axial ramps, 8-corner boxes, baked 3D volume grids) and each CSG op (union, smooth union, subtract, intersect) exists twice: a GPU sphere-trace that returns distance and material id, and a CPU evaluation at the marble that returns distance, normal, and contact material. One scene specification feeds both, so rendering and collision do not drift the way a mesh and a separate collider do.
2. **Fullscreen sphere trace, then polish.** World, goal, local marble, and remote marbles are traced in one pass. Add soft shadows, a few ambient-occlusion taps, subsurface marble veins, and branch-scoped volumetric fog. **Occlusion reveal tunnel:** if the course blocks the camera, subtract a smooth capsule from the world field along the camera-to-marble line so the marble stays visible.
3. **Fixed 120 Hz SDF physics.** Step at 120 Hz and interpolate the pose for rendering. Cast the sphere along the velocity before integrating so it does not tunnel through thin ramps. Resolve penetration a few times per step. Surface materials carry restitution and friction (`track`, `wall`, `goalPad`, `ice`, `sticky`, `bouncePad`, `ground`). **Seam-biased normals** prefer an upward support at hard unions so modular track joints do not snag.
4. **Arcade follow camera.** Map WASD, pointer, and touch onto the camera’s ground axes. Use a few zoom stops from close follow to a full-course view, with velocity lead.
5. **Procedural graph and level compilation.** Author a DAG of shapes, CSG, repeats, modifiers, and noise terrain. Compile it either to a CSG tree or to a flat entity list. Bake heavy noise into a 3D volume in a worker.
6. **Headed WebGPU checks.** WebGPU needs a real GPU, so smoke tests run in headed Chromium. A perf-log query flag emits structured console lines, and resolution scales when the GPU falls behind.

Our agent split (level, physics, camera, rules) stays [project intent](#hard-problem-bet). It lines up with this factoring. It is not a layout copied from `gamex`.

## What it is

**Gemini 4 Argon SF Hackathon**, hosted on Cerebral Valley by co-hosts [Cerebral Valley](https://cerebralvalley.ai/u/cv) and [Google DeepMind](https://cerebralvalley.ai/u/deepmind).

The page frames it as an in-person hackathon to push **Gemini 4 Argon**: advanced reasoning, visual coding, robotics, and world models. The stated bar is an ambitious project that pushes Argon, and “something that wasn’t possible last week.”

- Fully in person. Schema.org attendance mode is offline.
- Listed price is **$0** (`priceCurrency: USD`). The same offer is marked **SoldOut**.
- Schema.org also marks the event `EventScheduled` and `isAccessibleForFree: true`.
- Platform flags on the details payload: `approvalRequired: true`, `waiverRequired: true`, `checkInEnabled: true`, `registrationClosed: false`, `capacity.isFull: true`.
- `theme` and `type` on the event record are null. There is no extra theme beyond the Argon brief above.

## When and where

| | |
| --- | --- |
| Place | **San Francisco, CA**, United States. No street address is on the page. `showLocationBeforeApproval` is false. |
| Event `timeZone` | `America/Los_Angeles` |
| Event `startDateTime` | `2026-10-25 16:00:00` |
| Event `endDateTime` | `2026-10-26 05:00:00` |
| Schema.org `startDate` | `2026-10-25T16:00:00.000Z` |
| Schema.org `endDate` | `2026-10-26T05:00:00.000Z` |
| Submission due | `2026-10-26 00:00:00` (`hackathonSubmissionDueDate`) |
| Submission grace | **1 hour** (`submissionDueDateGracePeriodHours`) |
| Record `updatedAt` | `2026-10-25 16:28:59` |

The details page prints those two start/end forms and does not say which clock wins. The event-record times carry `America/Los_Angeles`. The schema.org times use a `Z` (UTC) suffix with the same clock numbers. Confirm the live event page before you book travel or a submission cutoff.

There is **no hour-by-hour agenda** on the event page (no check-in time, opening, meals, workshops, or demo slots). The builder guide does not add clock times, a street address, or wifi. It says the Google team is onsite all day, mentors are onsite, and API credits are claimed from that team at kickoff. It does not say when kickoff is.

## What to build

Build something that was not possible last week, using Gemini 4 Argon at the frontier the page names:

- Advanced reasoning
- Visual coding
- Robotics
- World models

A separate prize calls out **best use of Managed Agents**. The event page does not define that phrase. The builder guide does: the Antigravity managed agent in [Gemini stack](#gemini-stack-and-official-resources).

Constraints the page does state:

- **Maximum team size is four.**
- Space is limited. **All attendees must apply and be approved.** An application does not guarantee a spot.
- The event is fully in person in San Francisco.

This repo’s answer to that brief is the [Marble Madness SDF remake](#the-hack-project-intent). That answer is project intent, not a requirement from the page.

## Gemini stack and official resources

The event page names **Gemini 4 Argon** and the prize category **Managed Agents**. It does not link model docs, an API reference, AI Studio, or a starter repo. Those links are in the builder guide, below.

The builder guide’s lead model is **`gemini-4-argon`**: frontier work in software engineering, complex knowledge work, cybersecurity defense, and multimodal creation. Input, thinking, and output share one **1M-token** window. It works longer on its own and retains context across large codebases and dense document sets. For 3D it calls out Three.js and WebGPU scenes. Pair Argon as the lead with one or two fast companions.

Several model IDs in the Doc’s table were split across lines. The IDs below join those breaks (a space in the middle of a token, or a space before a hyphen). `antigravity-preview-09-2026` also appears unbroken later in the Doc. The others are that join only.

| Job | Model or agent | ID |
| --- | --- | --- |
| Frontier reasoning, long-horizon coding, 3D, orchestration | Gemini 4 Argon | `gemini-4-argon` |
| Autonomous sandbox | Antigravity managed agent | `antigravity-preview-09-2026` |
| Fast parallel subagents and tool calls | Gemini 3.8 Flash | `gemini-3.8-flash` |
| High-frequency routing and checks | Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` |
| Deep web research with citations | Deep Research agent | `deep-research-preview-04-2026` |
| Real-time voice and camera | Gemini 3.8 Live | `gemini-3.8-live`; deeper while talking: `gemini-3.8-live-extended-thinking` |
| Live speech-to-text and translation | Gemini 3.5 Transcribe and Live Translate | Streaming captions: `gemini-3.5-transcribe-live`. Recorded audio with speaker labels: `gemini-3.5-transcribe`. Speech-to-speech across more than 70 languages: `gemini-3.5-live-translate-preview` |
| Expressive speech | Gemini 3.8 Flash TTS | `gemini-3.8-flash-tts` (130 languages). Faster: `gemini-3.8-flash-lite-tts` |
| UI assets, textures, sprites, 4K images | Nano Banana 2.1 | `gemini-nano-banana-2.1`. Sub-second: `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) |
| Video with native audio | Gemini Omni Flash | `gemini-omni-1.1-flash` (run in the background) |
| Songs, vocals, loops | Lyria 3.5 | `lyria-3.5` (44.1 kHz stereo). 30-second loops: `lyria-3-clip-preview` |
| Private or on-device open weights | Gemma 4 | `gemma-4-31b-it` on the Interactions API, Kaggle, and Hugging Face. The guide says the E2B and E4B sizes run locally on phones and laptops with native audio input. It does not give those size IDs. |

### Calling Argon

Use the **Interactions API** (`google-genai` or `@google/genai` **2.3.0 or later**). One API covers models and managed agents, server-side state via `previous_interaction_id`, and background execution.

- `thinking_level`: `low`, `medium` (default), or `high`. Medium for interactive coding and tool use. High for multi-file debugging, security patching, formal maths, and upfront design. Low for classification, routing, and extraction.
- Default output limit is **65,536** tokens. To go past that, up to 1M minus the input, set `background=True` and `max_output_tokens` above 65536. Poll `client.interactions.get` while status is `in_progress` or `queued`. The guide’s long-decode sample uses `max_output_tokens` 262144 and `thinking_level` `high`.
- On `gemini-4-argon`, drop legacy Gemini 2.5 / 3 settings: replace `thinking_budget` with `thinking_level`; remove `temperature`, `top_p`, and `top_k` (ignored, deprecation warning); remove explicit `cached_content` (implicit caching is automatic, **95% off** cached input tokens).
- Introductory pricing in the guide, through **30 November 2026**: **$2 per 1M input tokens** and **$10 per 1M output tokens**.
- For `high` thinking, set HTTP timeouts to **15–20 minutes**, or use `background=True`.
- Managed agent call: `agent="antigravity-preview-09-2026"`, `agent_config` type `antigravity` with `model` `gemini-4-argon`, `environment="remote"`.

### Credits and keys

The builder guide contains **no API key or token**. Claim a pre-provisioned account or Gemini API credits **from the Google team at kickoff**.

Do not commit keys, tokens, or `.env` files. The guide’s samples construct `genai.Client()` with no key in source, so the key stays in the environment or a secret manager.

If a managed agent needs a third-party token (the guide names GitHub or Stripe as examples), register it with `client.credentials.create` and restrict the sandbox with `environment={"type": "remote", "network": {"allowlist": [...]}}`. The guide says the secret is then injected at the proxy and does not enter the model context.

### First 15 minutes, from the builder guide

1. Claim the account or credits at kickoff.
2. Install the official skills, or prototype in [AI Studio Build](https://aistudio.google.com/build) or [Google Antigravity](https://antigravity.google).
3. Make one `gemini-4-argon` Interactions API call on `google-genai` / `@google/genai` 2.3.0+.
4. Ask the Google mentors onsite when blocked. The guide says the Google team is onsite all day. Feedback: what worked, what broke, what you wish existed, or email gemini-developer-feedback@google.com.

The Doc prints the skill installs as one wrapped line. These are the three commands in that line:

```sh
npx skills add google-gemini/gemini-skills --skill gemini-api-dev
npx skills add google-gemini/gemini-skills --skill gemini-live-api-dev
agy plugin install https://github.com/google-gemini/gemini-skills
```

### Patterns the builder guide says save hours

1. Agree on the plan, edge cases, and tool access before a long run, then let Argon finish the multi-file build.
2. Give it a pass/fail signal: tests, compiler output, runtime logs, or a headless Chrome script with a baseline score. Loop until the checks pass with no regressions.
3. For a 3D or UI scene, pass one or two reference images, or have Argon write typography, palette, and layout into `DESIGN.md` first. For a UI or timing bug, a short screen recording plus console logs is the input it describes.
4. Argon leads. `gemini-3.8-flash` does parallel leaves. Textures and sprites: `gemini-nano-banana-2.1`. Voice: `gemini-3.8-live` and `gemini-3.8-flash-tts`. Music: `lyria-3.5`.
5. When a setup quirk is solved, write it into `AGENTS.md` or a skill. Before the demo, ask Argon for an interactive HTML diagram of what you built.

### Builder-guide links

- Gemini 4 Argon developer guide: https://aistudio.google.com/learn/gemini-4-argon-developer-guide
- AI Studio: https://aistudio.google.com and https://aistudio.google.com/build
- Google Antigravity: https://antigravity.google
- Gemini API skills: https://github.com/google-gemini/gemini-skills
- Gemini API docs: https://ai.google.dev/gemini-api/docs
- Cookbook: https://github.com/google-gemini/cookbook
- Live API examples: https://github.com/google-gemini/gemini-live-api-examples

### Links on the event page

- Event: https://cerebralvalley.ai/e/gemini-4-argon-sf
- Details (this guide’s source): https://cerebralvalley.ai/e/gemini-4-argon-sf/details
- Markdown alternate: https://cerebralvalley.ai/e/gemini-4-argon-sf.md
- Cerebral Valley profile: https://cerebralvalley.ai/u/cv
- Google DeepMind profile: https://cerebralvalley.ai/u/deepmind
- Cerebral Valley site: https://cerebralvalley.ai/about and https://cv.inc/about
- Cerebral Valley events: https://cerebralvalley.ai/events
- Cerebral Valley on X: https://x.com/cerebral_valley
- Cerebral Valley on LinkedIn: https://www.linkedin.com/company/cerebralvalley
- Cerebral Valley on GitHub: https://github.com/cerebralvalley
- Speaker Ivan Leo on X: https://x.com/ivanleomk

## Timeline

Use this only as a reading of the timestamps above. The page has no schedule blocks inside the window.

1. **Apply** and wait for approval. Waiver is required (`waiverRequired: true`).
2. **Attend in person** in San Francisco for the published window (see the timezone note).
3. **Submit before** `2026-10-26 00:00:00`, plus the published **1-hour grace**.
4. **Judging** on the event page is in-house, with a final round. `hackathonJudgingOpen` is null, so the page does not say that judging is open or when it starts. The builder guide’s bar is in [Judging](#judging): a live working demo, real inputs, under 3 minutes.

Capacity at fetch time: `capacity.isFull` is **true**, and the schema.org offer availability is **SoldOut**, while `registrationClosed` is **false**. The page does not explain how those three fields interact. Treat a full or sold-out listing as “do not assume you can still walk in,” and recheck the event page.

## Submission checklist

The page does not list the artifact format (repo, demo URL, video, slides, or form fields for the project itself). It does state the following:

- [ ] Apply. Required questions on the page:
  - What’s your LinkedIn?
  - What’s your Github?
  - What are you going to build at this hackathon?
  - What AI project are you most proud of building?
  - How did you hear about this event?
- [ ] Optional question on the page: What’s your Twitter/X?
- [ ] Get **approved**. Approval is required, and applying does not guarantee attendance.
- [ ] Sign the **Liability & Information Release and Waiver Agreement**. It is required. The full text is on the details page; this guide does not replace it.
- [ ] Keep the team to **at most four** people.
- [ ] If anyone is **under 18**, a legal guardian must accompany them the whole time and must be the person registering them.
- [ ] Be there **in person** in San Francisco. This is not a public livestream (`liveStreamPublic: false`).
- [ ] Submit by `hackathonSubmissionDueDate` (`2026-10-26 00:00:00`) or within the **1-hour grace**.
- [ ] Know the IP terms before you submit: the entrant keeps ownership of the submission, and as a condition of submission grants the organizer, its subsidiaries, agents, and partner companies a perpetual, irrevocable, worldwide, royalty-free, non-exclusive license to use, reproduce, adapt, modify, publish, distribute, publicly perform, create derivative works from, and publicly display it.
- [ ] The waiver also says materials you share at the event are not confidential, and that you consent to photo, film, and audio recording. Read those sections on the source page before you demo.
- [ ] From the builder guide, not the event page: demo a **working build, not slides**, **live**, with **real inputs**, in **under 3 minutes**. Name a specific person the project is for. Keep a person in control of any action that touches external systems, money, or private data.
- [ ] Claim API credits from the Google team at kickoff. Keep keys out of git. See [Credits and keys](#credits-and-keys).

Public voting is off (`hackathonPublicVotingEnabled: false`). The hackathon gallery is not shown (`showHackathonGallery: false`).

## Judging

The page says the Google DeepMind team will be in-house for **judging and speaking**.

- **Speaker:** [Ivan Leo](https://x.com/ivanleomk)
- **Final-round judges (Google):** Joana Carrasqueira, Shudhatma Jain, Subhasmita Sahoo, and Oskar Yao

The event page has no score weights, demo length, or round structure beyond “final-round judges.” `hackathonJudgingOpen` is null.

The builder guide states a separate bar. It says judges score **working demos, not slide decks**, and that a strong 1-day project passes four tests:

1. It solves a specific problem for a real person you can name, not a generic audience.
2. It does work that needed Gemini 4 Argon: long-horizon coding, autonomous verification loops, multi-file synthesis, 3D and WebGPU generation, or multi-agent orchestration.
3. It keeps people in control when taking actions that affect external systems, money, or private data.
4. It runs live during judging with real inputs in **under 3 minutes**.

The guide does not give numeric weights, and the event page does not say these four tests are the Cerebral Valley final-round rubric.

## Prizes

The page says **$20,000** / **$20K in cash prizes** for winning teams:

| Place | Prize |
| --- | --- |
| First | $7,500 |
| Second | $5,000 |
| Third | $2,500 |
| Best use of Managed Agents | $5,000 |

Those four amounts add up to $20,000. The page does not say whether one team can win a placement prize and the Managed Agents prize, how ties work, or how prizes are paid.

## Rules that affect the build

Summaries only. The binding text is the waiver on the [details page](https://cerebralvalley.ai/e/gemini-4-argon-sf/details).

- All ages may attend. **Under 18:** legal guardian present the entire event.
- Conduct yourself professionally and respectfully. Organizers can remove or refuse someone for disruptive or disrespectful behavior, with no refund (the offer price on the page is $0).
- Seating, tables, power, and equipment may be limited. The organizers do not guarantee them.
- California law. Venue for disputes in the waiver is state or federal courts in San Francisco.
- Personal information submitted for the event (including name and email) may be shared with event partners. The waiver says organizers will not take confidentiality or non-disclosure duties for materials you share.
- Check-in is enabled on the platform (`checkInEnabled: true`). The page does not say how check-in works.

## What these sources do not say

Still absent after the event page and the builder guide. Do not fill these in from memory.

- Street address or venue name beyond **San Francisco, CA**. The event page hides location before approval. The builder guide does not name a building.
- Wifi, power guarantees beyond the waiver’s “may be limited,” or hardware.
- An agenda with clock times: check-in, opening, meals, workshops, demo order, or when kickoff is. The builder guide only says the Google team is onsite all day and that credits are claimed at kickoff.
- Whether event-record timestamps are Pacific local times, or whether the schema.org `Z` timestamps are the instants that count.
- How to form a team, or whether solo entries are allowed, beyond the maximum of four.
- The Cerebral Valley upload itself: what a submission must contain, where the submit button lives, or whether code must be public. The builder guide adds a live-demo bar, not that form.
- Numeric judging weights, and whether the builder guide’s four tests are the final-round rubric. `hackathonJudgingOpen` is still null on the event page.
- A code-of-conduct document separate from the waiver section titled “Code of Conduct and Right to Refuse Participation.”
- A grant to reuse `gamex` source. The private repo is inspiration only. `package.json` says ISC and there is no root `LICENSE` file. See [Inspiration repo](#inspiration-repo).

The builder guide does answer the earlier holes for Argon and Managed Agents docs, the 1M-token window, companion model IDs, the Interactions API, introductory pricing, and how credits are claimed (in person, no key printed in the Doc).
