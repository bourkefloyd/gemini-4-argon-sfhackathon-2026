# Gemini 4 Argon SF Hackathon — team guide

Practical notes for a team hacking at this event. Event facts come from the [official details page](https://cerebralvalley.ai/e/gemini-4-argon-sf/details) as fetched on 2026-10-25. Anything that page does not state is listed under [What the page does not say](#what-the-page-does-not-say). Do not treat those gaps as rules.

The [project section](#the-hack-project-intent) is Bourke’s concept for this repo. It is not an event rule. Sentences there that are not on the event page, and not taken from the inspiration repo, are marked as project intent.

**Source:** https://cerebralvalley.ai/e/gemini-4-argon-sf/details  
**Canonical event page:** https://cerebralvalley.ai/e/gemini-4-argon-sf  
**Markdown alternate linked from the details page:** https://cerebralvalley.ai/e/gemini-4-argon-sf.md

## The hack (project intent)

**Build a remake of Marble Madness using signed distance fields (SDFs).** That choice is this project’s intent. The event page does not name Marble Madness, SDFs, or this repo.

A marble-on-a-course game is a ball moving through one continuous solid: banks, gaps, tubes, rails. An SDF is a function from a point to the signed distance to that solid. **Project intent:** use that one description for both the picture and the motion. Raymarch the field to draw the course. Use the distance, and the gradient as a surface normal, to keep the marble from sinking through it. The level can stay a spec plus a shader-sized function instead of a mesh plus a separate collider. That is why an SDF fits this game. None of that rationale is stated on the event page, and it was not read out of the inspiration repo.

### Hard-problem bet

**Project intent:** spend the hack on two hard Gemini 4 Argon problems: a context on the order of a **million tokens**, and **parallel agents**. The event page names Gemini 4 Argon and a “Best use of Managed Agents” prize. It does not define million-token context, parallel agents, or Managed Agents, and it does not say this split counts for that prize.

Working agreement for the team, not a design spec:

- Hold the **course, the shaders, and the level spec in one context**, so a change to the course is visible to the code that draws it and the code that moves the marble.
- Split ownership across agents: **level, physics, camera, and rules**. One agent per surface. They meet in that shared context.
- Keep each agent’s job to that surface. Do not grow this into an engine outline during the hack.

### Inspiration repo

Inspiration only: https://github.com/bourkefloyd/gamex

Do not vendor it and do not paste its source into this repo. None of its files are included here.

Checked on 2026-10-25 from this environment: the GitHub page, the API, and `raw.githubusercontent.com` paths for `README.md` and `LICENSE` on `main` and `master` all returned **404**. The public repo list for `bourkefloyd` did not include `gamex`. So this guide cannot say what the repo renders, how it does physics, whether it uses SDFs, how the tree is laid out, or what the **license** is. Do not assume a license. Until the repo is readable, there is no specific file or technique in it to copy a pattern from. If it becomes readable, use it to see how a game is factored, then write this project fresh under that repo’s license.

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

There is **no hour-by-hour agenda** on this page (no check-in time, kickoff, workshops, or demo slots).

## What to build

Build something that was not possible last week, using Gemini 4 Argon at the frontier the page names:

- Advanced reasoning
- Visual coding
- Robotics
- World models

A separate prize calls out **best use of Managed Agents**. The page does not define that phrase or link a product doc for it.

Constraints the page does state:

- **Maximum team size is four.**
- Space is limited. **All attendees must apply and be approved.** An application does not guarantee a spot.
- The event is fully in person in San Francisco.

This repo’s answer to that brief is the [Marble Madness SDF remake](#the-hack-project-intent). That answer is project intent, not a requirement from the page.

## Gemini stack and official resources

The named stack on the page is **Gemini 4 Argon**, plus the prize category **Managed Agents**.

The details page does **not** link model docs, an API reference, AI Studio, a model card, a starter repo, sample code, or a key-request flow. Use only credentials and docs your team is allowed to use, and do not put keys in this repo.

Links that do appear on the page:

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
4. **Judging** is described as in-house with a final round. `hackathonJudgingOpen` is null, so the page does not say that judging is open or when it starts.

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

Public voting is off (`hackathonPublicVotingEnabled: false`). The hackathon gallery is not shown (`showHackathonGallery: false`).

## Judging

The page says the Google DeepMind team will be in-house for **judging and speaking**.

- **Speaker:** [Ivan Leo](https://x.com/ivanleomk)
- **Final-round judges (Google):** Joana Carrasqueira, Shudhatma Jain, Subhasmita Sahoo, and Oskar Yao

No rubric, score weights, demo length, or round structure appears on the page, other than the words “final-round judges.” `hackathonJudgingOpen` is null.

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

## What the page does not say

Confirmed absent from the details page at fetch time. Do not fill these in from memory.

- Street address or venue name beyond **San Francisco, CA** (location is hidden before approval).
- An agenda: check-in, opening, meals, workshops, quiet hours, or demo order.
- Whether event-record timestamps are Pacific local times, or whether the schema.org `Z` timestamps are the instants that count.
- How to form a team, or whether solo entries are allowed, beyond the maximum of four.
- What a submission must contain, where the submit button lives, or whether code must be public.
- Judging criteria, demo length, and whether judging was open (`hackathonJudgingOpen` is null).
- Official Gemini 4 Argon or Managed Agents documentation, API, SDK, or starter links.
- Wifi, power guarantees, hardware, or provided credits.
- A code-of-conduct document separate from the waiver section titled “Code of Conduct and Right to Refuse Participation.”
