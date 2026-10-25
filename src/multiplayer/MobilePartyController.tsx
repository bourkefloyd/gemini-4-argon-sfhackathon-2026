/**
 * Mobile Tactile Trackball, Crowd CSG Chaos Deck & Argon Twist Submitter (`src/multiplayer/MobilePartyController.tsx`)
 *
 * Mounted when a phone scans the stage QR code (`/?party=1&room=ARGON`).
 * Loads in <20 KB without compiling heavy WebGPU shaders on the phone:
 * - Role 1 (Arena Racers #1–#8): 60 Hz Virtual Arcade Trackball + Backspin Brake + Hop button
 * - Role 2 (All 100+ Phones): 5 Realtime SDF World-Mutator buttons (`smoothUnion` bridge/ramp,
 *   `smoothSubtract` crater, `materialOverride` cryo ice, `waveSurge` 2x wave floor) on a 4s cooldown
 * - Role 3 (Crowd Prompt Swarm): Submit or upvote a 5-word course twist for Gemini 4 Argon 1M
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPartyRoomClient, type PartyRoomClient } from './party-client';
import {
  CROWD_ACTION_COOLDOWN_MS,
  CROWD_MUTATOR_CATALOG,
  type CrowdMutatorKind,
  type PartyPlayerRecord,
  type PartyRoomSnapshot,
} from './party-types';

export interface MobilePartyControllerProps {
  readonly roomCode?: string;
  readonly initialHandle?: string;
  readonly client?: PartyRoomClient;
  readonly onExitPartyMode?: () => void;
}

const QUICK_TWIST_SUGGESTIONS = [
  'low gravity ice pinball',
  'triple portal abyss leap',
  'ferrofluid steelie bumper arena',
  'double wave neon chute',
];

export const MobilePartyController: React.FC<MobilePartyControllerProps> = ({
  roomCode = 'ARGON',
  initialHandle,
  client: externalClient,
  onExitPartyMode,
}) => {
  const clientRef = useRef<PartyRoomClient | null>(externalClient ?? null);
  if (!clientRef.current) {
    clientRef.current = createPartyRoomClient({ roomCode });
  }

  const [playerId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem('marble_party_player_id');
      if (saved) return saved;
      const fresh = `plr_${Math.random().toString(36).slice(2, 9)}`;
      window.sessionStorage.setItem('marble_party_player_id', fresh);
      return fresh;
    }
    return `plr_${Math.random().toString(36).slice(2, 9)}`;
  });

  const [handleInput, setHandleInput] = useState<string>(() => {
    if (initialHandle) return initialHandle;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem('marble_party_handle');
      if (saved) return saved;
    }
    return `roller_${Math.floor(100 + Math.random() * 899)}`;
  });

  const [snapshot, setSnapshot] = useState<PartyRoomSnapshot>(() =>
    clientRef.current!.getSnapshot(),
  );
  const [me, setMe] = useState<PartyPlayerRecord | null>(null);
  const [trackballVec, setTrackballVec] = useState<readonly [number, number]>([0, 0]);
  const [isDraggingPad, setIsDraggingPad] = useState<boolean>(false);
  const [backspinActive, setBackspinActive] = useState<boolean>(false);
  const [cooldownUntilMs, setCooldownUntilMs] = useState<number>(0);
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState<number>(0);
  const [lastFeedback, setLastFeedback] = useState<string>(
    'Connected to Stage Arena! Roll the trackball or fire a Crowd SDF Mutator.',
  );
  const [twistInput, setTwistInput] = useState<string>('');

  const padRef = useRef<HTMLDivElement | null>(null);
  const prevVecRef = useRef<readonly [number, number]>([0, 0]);

  useEffect(() => {
    const client = clientRef.current!;
    const unsub = client.subscribe((snap) => {
      setSnapshot(snap);
      const found = snap.players.find((p) => p.playerId === playerId) ?? null;
      if (found) {
        setMe(found);
      }
    });

    void client.join({
      roomCode,
      playerId,
      handle: handleInput,
    }).then((res) => {
      setMe(res.player);
    });

    return () => {
      unsub();
      if (!externalClient) {
        client.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, playerId]);

  // Update 4-second personal cooldown timer
  useEffect(() => {
    const timer = window.setInterval(() => {
      const remMs = Math.max(0, cooldownUntilMs - Date.now());
      setCooldownRemainingSec(Number((remMs / 1000).toFixed(1)));
    }, 100);
    return () => window.clearInterval(timer);
  }, [cooldownUntilMs]);

  const vibrate = useCallback((ms: number) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore on unsupported mobile browsers
      }
    }
  }, []);

  const handleRenameSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = handleInput.trim() || 'player';
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('marble_party_handle', trimmed);
      }
      void clientRef.current?.join({
        roomCode,
        playerId,
        handle: trimmed,
      });
      setLastFeedback(`Handle updated to @${trimmed}`);
    },
    [handleInput, playerId, roomCode],
  );

  const sendTrackballVector = useCallback(
    (nx: number, nz: number, jump = false) => {
      const clampedX = Math.max(-1, Math.min(1, nx));
      const clampedZ = Math.max(-1, Math.min(1, nz));
      const prev = prevVecRef.current;
      // Detect sharp reverse pull (backspin brake)
      const dot = prev[0] * clampedX + prev[1] * clampedZ;
      const isBackspin = dot < -0.25 && Math.hypot(clampedX, clampedZ) > 0.55;

      prevVecRef.current = [clampedX, clampedZ];
      setTrackballVec([clampedX, clampedZ]);
      setBackspinActive(isBackspin);

      if (isBackspin) {
        vibrate(14);
      }

      void clientRef.current?.sendInput({
        roomCode,
        playerId,
        moveXZ: [clampedX, clampedZ],
        jumpPressed: jump,
        backspinActive: isBackspin,
      });
    },
    [playerId, roomCode, vibrate],
  );

  const updateFromPointerEvent = useCallback(
    (clientX: number, clientY: number) => {
      const el = padRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const maxR = Math.max(24, rect.width * 0.44);
      const dx = (clientX - cx) / maxR;
      const dy = (clientY - cy) / maxR;
      const mag = Math.hypot(dx, dy);
      const nx = mag > 1 ? dx / mag : dx;
      const nz = mag > 1 ? dy / mag : dy;
      sendTrackballVector(nx, nz, false);
    },
    [sendTrackballVector],
  );

  const handleHopClick = useCallback(() => {
    vibrate(22);
    sendTrackballVector(trackballVec[0], trackballVec[1], true);
    setLastFeedback('🟢 HOP / BUMP impulse sent to Arena Marble!');
  }, [sendTrackballVector, trackballVec, vibrate]);

  const handleTriggerMutator = useCallback(
    async (kind: CrowdMutatorKind) => {
      if (Date.now() < cooldownUntilMs) return;
      vibrate(30);
      const res = await clientRef.current!.triggerAction(playerId, kind);
      if (res.ok) {
        setCooldownUntilMs(Date.now() + CROWD_ACTION_COOLDOWN_MS);
        setLastFeedback(res.toast?.text ?? `Triggered ${kind}!`);
      } else if (res.cooldownRemainingMs) {
        setCooldownUntilMs(Date.now() + res.cooldownRemainingMs);
        setLastFeedback(
          `Cooldown active (${(res.cooldownRemainingMs / 1000).toFixed(1)}s left)`,
        );
      }
    },
    [cooldownUntilMs, playerId, vibrate],
  );

  const handleSubmitTwist = useCallback(
    async (rawTwist: string) => {
      const cleaned = rawTwist.trim();
      if (!cleaned) return;
      vibrate(20);
      const res = await clientRef.current!.submitPrompt(playerId, cleaned);
      if (res.prompt) {
        setTwistInput('');
        setLastFeedback(
          `✨ Queued Argon 1M Twist: "${res.prompt.twist}" (${res.prompt.votes} votes)`,
        );
      }
    },
    [playerId, vibrate],
  );

  const twistWordCount = useMemo(() => {
    const trimmed = twistInput.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [twistInput]);

  const roleBadgeText =
    me?.role === 'racer' && me.racerSlot !== null
      ? `ARENA RACER • MARBLE #${me.racerSlot + 1}`
      : 'CROWD CHAOS & RESCUE ARCHITECT';

  return (
    <div
      className="mobile-party-controller"
      data-testid="mobile-party-controller"
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(circle at 50% 0%, #111c38 0%, #050811 75%)',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: '14px 16px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        userSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* Header & Handle Bar */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: `1px solid ${me?.colorHex ?? '#38bdf8'}`,
          borderRadius: '12px',
          padding: '10px 12px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: me?.colorHex ?? '#38bdf8',
              textTransform: 'uppercase',
            }}
          >
            ROOM {snapshot.roomCode} • {roleBadgeText}
          </div>
          <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '2px' }}>
            Score: <strong style={{ color: '#facc15' }}>{me?.score ?? 0} pts</strong> •{' '}
            {snapshot.players.length} in room
          </div>
        </div>

        <form onSubmit={handleRenameSubmit} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            aria-label="Player Handle"
            value={handleInput}
            maxLength={18}
            onChange={(e) => setHandleInput(e.target.value)}
            style={{
              background: '#090d16',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '6px 9px',
              fontSize: '13px',
              width: '122px',
            }}
          />
          <button
            type="submit"
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #475569',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Set @
          </button>
          {onExitPartyMode && (
            <button
              type="button"
              onClick={onExitPartyMode}
              style={{
                background: 'transparent',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '6px 8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              Stage View
            </button>
          )}
        </form>
      </header>

      {/* Live Feedback Ticker */}
      <div
        data-testid="party-controller-feedback"
        style={{
          background: 'rgba(30, 41, 59, 0.72)',
          borderLeft: `4px solid ${me?.colorHex ?? '#22d3ee'}`,
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '13px',
          color: '#e2e8f0',
        }}
      >
        {lastFeedback}
      </div>

      {/* Role 1: Tactile Virtual Arcade Trackball + Hop */}
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.78)',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#94a3b8',
          }}
        >
          <span>VIRTUAL ARCADE TRACKBALL (60 HZ)</span>
          <span
            style={{
              color: backspinActive ? '#f43f5e' : '#38bdf8',
              fontWeight: 700,
            }}
          >
            {backspinActive
              ? '🔥 BACKSPIN CLIFF-SAVE BRAKE!'
              : `VEC (${trackballVec[0].toFixed(2)}, ${trackballVec[1].toFixed(2)})`}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px',
            width: '100%',
            flexWrap: 'wrap',
          }}
        >
          {/* Circular Tactile Trackball Surface */}
          <div
            ref={padRef}
            data-testid="mobile-trackball-pad"
            role="slider"
            aria-label="Virtual Arcade Trackball"
            aria-valuenow={Math.round(trackballVec[0] * 100)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture?.(e.pointerId);
              setIsDraggingPad(true);
              updateFromPointerEvent(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => {
              if (!isDraggingPad) return;
              updateFromPointerEvent(e.clientX, e.clientY);
            }}
            onPointerUp={() => {
              setIsDraggingPad(false);
              sendTrackballVector(0, 0, false);
            }}
            onPointerCancel={() => {
              setIsDraggingPad(false);
              sendTrackballVector(0, 0, false);
            }}
            style={{
              width: '190px',
              height: '190px',
              borderRadius: '50%',
              position: 'relative',
              background:
                'radial-gradient(circle at 38% 32%, #334155 0%, #0f172a 62%, #020617 100%)',
              border: `3px solid ${
                backspinActive ? '#f43f5e' : me?.colorHex ?? '#38bdf8'
              }`,
              boxShadow: isDraggingPad
                ? `0 0 28px ${me?.colorHex ?? '#38bdf8'}66, inset 0 0 24px rgba(0,0,0,0.8)`
                : 'inset 0 0 24px rgba(0,0,0,0.85)',
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            {/* Isometric crosshair lines */}
            <div
              style={{
                position: 'absolute',
                inset: '18%',
                borderRadius: '50%',
                border: '1px dashed rgba(148, 163, 184, 0.25)',
                pointerEvents: 'none',
              }}
            />
            {/* Thumb Reticle Pucks */}
            <div
              style={{
                position: 'absolute',
                left: `${50 + trackballVec[0] * 38}%`,
                top: `${50 + trackballVec[1] * 38}%`,
                transform: 'translate(-50%, -50%)',
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: me?.colorHex ?? '#38bdf8',
                boxShadow: '0 0 16px rgba(255,255,255,0.65)',
                border: '2px solid #ffffff',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Dedicated HOP / BUMP Thumb Button */}
          <button
            type="button"
            data-testid="mobile-hop-button"
            onClick={handleHopClick}
            style={{
              width: '112px',
              height: '112px',
              borderRadius: '22px',
              background: 'linear-gradient(145deg, #10b981, #047857)',
              color: '#ffffff',
              border: '2px solid #6ee7b7',
              boxShadow: '0 8px 20px rgba(16, 185, 129, 0.35)',
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '24px' }}>⚡</span>
            <span>HOP / BUMP</span>
          </button>
        </div>
      </section>

      {/* Role 2: Crowd Chaos & Rescue SDF Mutator Deck (All 100+ Phones) */}
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.82)',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: '#38bdf8',
              textTransform: 'uppercase',
            }}
          >
            LIVE SDF WORLD-MUTATOR DECK (CSG)
          </span>
          <span
            data-testid="crowd-cooldown-badge"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: cooldownRemainingSec > 0 ? '#f97316' : '#4ade80',
            }}
          >
            {cooldownRemainingSec > 0
              ? `⏳ Cooldown ${cooldownRemainingSec.toFixed(1)}s`
              : '⚡ READY TO SCULPT'}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
            gap: '8px',
          }}
        >
          {CROWD_MUTATOR_CATALOG.map((item) => {
            const disabled = cooldownRemainingSec > 0;
            return (
              <button
                key={item.kind}
                type="button"
                data-testid={`crowd-mutator-${item.kind}`}
                disabled={disabled}
                onClick={() => void handleTriggerMutator(item.kind)}
                style={{
                  background: disabled
                    ? 'rgba(30, 41, 59, 0.5)'
                    : 'rgba(15, 23, 42, 0.95)',
                  border: `1.5px solid ${disabled ? '#334155' : item.accentColor}`,
                  borderRadius: '12px',
                  padding: '10px',
                  textAlign: 'left',
                  color: disabled ? '#64748b' : '#f8fafc',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  <span>
                    {item.icon} {item.shortLabel}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: item.accentColor,
                  }}
                >
                  {item.csgBadge}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.25 }}>
                  {item.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Role 3: Crowd Prompt Swarm for Gemini 4 Argon 1M Architect */}
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.82)',
          border: '1px solid rgba(192, 132, 252, 0.32)',
          borderRadius: '16px',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.06em',
              color: '#c084fc',
              textTransform: 'uppercase',
            }}
          >
            ✨ GEMINI 4 ARGON 1M — CROWD TWIST SWARM
          </span>
          <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
            {twistWordCount}/5 words
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmitTwist(twistInput);
          }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            type="text"
            data-testid="argon-twist-input"
            placeholder="5-word hazard twist (e.g. low gravity ice pinball)"
            value={twistInput}
            onChange={(e) => setTwistInput(e.target.value)}
            style={{
              flex: 1,
              background: '#090d16',
              color: '#f8fafc',
              border: '1px solid #475569',
              borderRadius: '10px',
              padding: '9px 12px',
              fontSize: '13px',
            }}
          />
          <button
            type="submit"
            data-testid="argon-twist-submit"
            style={{
              background: 'linear-gradient(135deg, #9333ea, #6366f1)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '9px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Queue Twist
          </button>
        </form>

        {/* Quick 1-Tap Crowd Twist Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {QUICK_TWIST_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void handleSubmitTwist(suggestion)}
              style={{
                background: 'rgba(147, 51, 234, 0.16)',
                color: '#e9d5ff',
                border: '1px solid rgba(192, 132, 252, 0.35)',
                borderRadius: '999px',
                padding: '4px 10px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              + {suggestion}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
