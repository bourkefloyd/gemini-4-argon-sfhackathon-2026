/**
 * Live Arcade Announcer (`gemini-3.8-flash-tts`) with a zero-latency
 * `window.speechSynthesis` fallback so the cabinet always speaks on stage.
 */

export type ArcadeAnnounceEvent =
  | 'analyze-run'
  | 'mutate-course'
  | 'preset'
  | 'approved'
  | 'csg'
  | 'listening';

export interface ArcadeCalloutInput {
  readonly event: ArcadeAnnounceEvent;
  readonly courseName: string;
  readonly archetype?: string;
  readonly peakSpeed?: number;
  readonly title?: string;
}

export interface ArcadeAnnouncement {
  readonly text: string;
  readonly spoken: boolean;
  readonly source: 'gemini-3.8-flash-tts' | 'speech-synthesis' | 'silent';
}

export function composeArcadeCallout(input: ArcadeCalloutInput): string {
  const course = input.courseName.replace(/\s+/g, ' ').trim() || 'this race';
  const speed =
    typeof input.peakSpeed === 'number' && input.peakSpeed > 0
      ? `${input.peakSpeed.toFixed(0)} meters a second`
      : 'top speed';
  switch (input.event) {
    case 'analyze-run':
      return `High roller on ${course}, peaking at ${speed}, and Argon is carving a safer line from that death map!`;
    case 'mutate-course':
      return `Mutation locked for ${course}, with catch berms and a portal skybridge waiting on your approve button!`;
    case 'preset':
      return `${input.title ?? 'New course'} is on the glass, tourist line left and speedrun line right, so approve to hot-swap!`;
    case 'approved':
      return `Hot swap complete, ${course} is live, so roll it high roller!`;
    case 'csg':
      return `Field sculpt armed on ${course}, ${input.title ?? 'a new solid'} is staged, and it stays off the track until you approve!`;
    case 'listening':
      return 'Mic is live, so tell Argon the course you want while you roll!';
  }
}

function speakWithWebSpeech(text: string): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.08;
  utter.pitch = 0.9;
  utter.lang = 'en-US';
  window.speechSynthesis.speak(utter);
  return true;
}

async function playBase64Audio(audioBase64: string, mimeType: string): Promise<boolean> {
  if (typeof Audio === 'undefined') return false;
  const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
  try {
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask `/api/argon/tts` for `gemini-3.8-flash-tts` audio, then fall back to the
 * browser speech engine so a dead API key never silences the demo.
 */
export async function announceArcadeCallout(
  input: ArcadeCalloutInput,
  options?: { readonly apiKey?: string; readonly fetchFn?: typeof fetch },
): Promise<ArcadeAnnouncement> {
  const text = composeArcadeCallout(input);
  const fetchImpl = options?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  if (fetchImpl) {
    try {
      const res = await fetchImpl('/api/argon/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.apiKey ? { 'x-gemini-api-key': options.apiKey } : {}),
        },
        body: JSON.stringify({ text, apiKey: options?.apiKey }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          audioBase64?: string;
          mimeType?: string;
          source?: string;
        };
        if (data.ok && data.audioBase64 && data.mimeType) {
          const played = await playBase64Audio(data.audioBase64, data.mimeType);
          if (played) {
            return { text, spoken: true, source: 'gemini-3.8-flash-tts' };
          }
        }
      }
    } catch {
      // Speech synthesis fallback below.
    }
  }

  const spoken = speakWithWebSpeech(text);
  return {
    text,
    spoken,
    source: spoken ? 'speech-synthesis' : 'silent',
  };
}

interface SpeechRecognitionResultLike {
  readonly 0: { readonly transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const host = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function isArchitectVoiceInputSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

/**
 * Hands-free prompt capture for the Architect drawer. The transcript replaces
 * the prompt box so Bourke can call a mutation while the marble is still rolling.
 */
export function createArchitectVoiceInput(handlers: {
  readonly onTranscript: (text: string) => void;
  readonly onState?: (state: 'listening' | 'idle' | 'unsupported') => void;
}): { readonly supported: boolean; start: () => void; stop: () => void } {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    return {
      supported: false,
      start: () => handlers.onState?.('unsupported'),
      stop: () => handlers.onState?.('idle'),
    };
  }

  let active: SpeechRecognitionLike | null = null;
  return {
    supported: true,
    start: () => {
      active?.stop();
      const recognition = new Ctor();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript?.trim();
        if (transcript) handlers.onTranscript(transcript);
      };
      recognition.onerror = () => handlers.onState?.('idle');
      recognition.onend = () => handlers.onState?.('idle');
      active = recognition;
      handlers.onState?.('listening');
      recognition.start();
    },
    stop: () => {
      active?.stop();
      active = null;
      handlers.onState?.('idle');
    },
  };
}
