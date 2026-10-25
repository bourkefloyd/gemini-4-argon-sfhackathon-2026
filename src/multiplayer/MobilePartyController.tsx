/**
 * Pure, Dead-Simple Mobile Arcade Controller (`src/multiplayer/MobilePartyController.tsx`)
 *
 * Mounted when a phone scans the stage QR code (`/?party=1`).
 * - Big color-coded banner at the top matching the player's marble on the main screen:
 *   `PLAYER 2 • EMERALD MARBLE (LOOK AT MAIN SCREEN!)`
 * - Name input (`@name`), huge responsive Virtual Trackball Pad, HOP (`Space`) button,
 *   and quick Portal (`Q`) / Crater (`F`) / Bridge (`V`) trigger buttons.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPartyRoomClient, type PartyRoomClient } from './party-client';
import {
  CROWD_ACTION_COOLDOWN_MS,
  PHONE_INPUT_THROTTLE_MS,
  PLAYER_MARBLE_PALETTE,
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

const QUICK_CONTROLLER_POWERS: readonly {
  readonly kind: CrowdMutatorKind;
  readonly keyLabel: string;
  readonly title: string;
  readonly subtitle: string;
  readonly accentColor: string;
}[] = [
  {
    kind: 'tectonicRamp',
    keyLabel: 'Portal (Q)',
    title: 'PORTAL / RAMP (Q)',
    subtitle: 'Launch wedge & portal boost ahead',
    accentColor: '#00d8ff',
  },
  {
    kind: 'craterMortar',
    keyLabel: 'Crater (F)',
    title: 'CRATER (F)',
    subtitle: 'Carve smooth CSG crater ahead',
    accentColor: '#f59e0b',
  },
  {
    kind: 'rescueBridge',
    keyLabel: 'Bridge (V)',
    title: 'BRIDGE (V)',
    subtitle: 'Extrude hard-light bounce bridge',
    accentColor: '#10b981',
  },
];

export const MobilePartyController: React.FC<MobilePartyControllerProps> = ({
  roomCode = 'ARGON',
  initialHandle,
  client: externalClient,
  onExitPartyMode,
}) => {
  const clientRef = useRef<PartyRoomClient | null>(externalClient ?? null);

  const [playerId, setPlayerId] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem('marble_party_player_id');
      if (saved) return saved;
      const fresh = `plr_${Math.random().toString(36).slice(2, 9)}`;
      window.sessionStorage.setItem('marble_party_player_id', fresh);
      return fresh;
    }
    return `plr_${Math.random().toString(36).slice(2, 9)}`;
  });

  const [playerSecret, setPlayerSecret] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem('marble_party_player_secret') ?? undefined;
    }
    return undefined;
  });

  const playerIdRef = useRef<string>(playerId);
  playerIdRef.current = playerId;
  const playerSecretRef = useRef<string | undefined>(playerSecret);
  playerSecretRef.current = playerSecret;

  const [handleInput, setHandleInput] = useState<string>(() => {
    if (initialHandle) return initialHandle;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const saved = window.sessionStorage.getItem('marble_party_handle');
      if (saved) return saved;
    }
    return `roller_${Math.floor(100 + Math.random() * 899)}`;
  });

  const [snapshot, setSnapshot] = useState<PartyRoomSnapshot | null>(null);
  const [me, setMe] = useState<PartyPlayerRecord | null>(null);
  const [trackballVec, setTrackballVec] = useState<readonly [number, number]>([0, 0]);
  const [isDraggingPad, setIsDraggingPad] = useState<boolean>(false);
  const [backspinActive, setBackspinActive] = useState<boolean>(false);
  const [cooldownUntilMs, setCooldownUntilMs] = useState<number>(0);
  const [cooldownRemainingSec, setCooldownRemainingSec] = useState<number>(0);
  const [lastFeedback, setLastFeedback] = useState<string>(
    'Roll the trackball below — watch your colored marble on the main screen!',
  );

  const padRef = useRef<HTMLDivElement | null>(null);
  const prevVecRef = useRef<readonly [number, number]>([0, 0]);
  const lastMoveSentAtRef = useRef<number>(0);

  useEffect(() => {
    const client = externalClient ?? createPartyRoomClient({ roomCode });
    client.connect();
    clientRef.current = client;

    const unsub = client.subscribe((snap) => {
      setSnapshot(snap);
      const found =
        snap.players.find((p) => p.playerId === playerIdRef.current) ?? null;
      if (found) {
        setMe(found);
      }
    });

    void client
      .join({
        roomCode,
        playerId: playerIdRef.current,
        playerSecret: playerSecretRef.current,
        handle: handleInput,
      })
      .then((res) => {
        setMe(res.player);
        if (res.playerId && res.playerId !== playerIdRef.current) {
          playerIdRef.current = res.playerId;
          setPlayerId(res.playerId);
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem('marble_party_player_id', res.playerId);
          }
        }
        if (res.playerSecret) {
          playerSecretRef.current = res.playerSecret;
          setPlayerSecret(res.playerSecret);
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.setItem(
              'marble_party_player_secret',
              res.playerSecret,
            );
          }
        }
      });

    return () => {
      unsub();
      if (!externalClient) {
        client.dispose();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, externalClient]);

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
        playerId: playerIdRef.current,
        playerSecret: playerSecretRef.current,
        handle: trimmed,
      });
      setLastFeedback(`Name updated to @${trimmed}`);
    },
    [handleInput, roomCode],
  );

  const sendTrackballVector = useCallback(
    (nx: number, nz: number, jump = false) => {
      const clampedX = Math.max(-1, Math.min(1, nx));
      const clampedZ = Math.max(-1, Math.min(1, nz));
      const prev = prevVecRef.current;
      const dot = prev[0] * clampedX + prev[1] * clampedZ;
      const isBackspin = dot < -0.25 && Math.hypot(clampedX, clampedZ) > 0.55;

      prevVecRef.current = [clampedX, clampedZ];
      setTrackballVec([clampedX, clampedZ]);
      setBackspinActive(isBackspin);

      if (isBackspin) {
        vibrate(14);
      }

      const now = Date.now();
      const isZeroRelease = clampedX === 0 && clampedZ === 0;
      if (!jump && !isZeroRelease && now - lastMoveSentAtRef.current < PHONE_INPUT_THROTTLE_MS) {
        return;
      }
      lastMoveSentAtRef.current = now;

      void clientRef.current?.sendInput({
        roomCode,
        playerId: playerIdRef.current,
        playerSecret: playerSecretRef.current,
        moveXZ: [clampedX, clampedZ],
        jumpPressed: jump,
        backspinActive: isBackspin,
      });
    },
    [roomCode, vibrate],
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
    setLastFeedback('HOP (Space) impulse sent to your marble!');
  }, [sendTrackballVector, trackballVec, vibrate]);

  const handleTriggerMutator = useCallback(
    async (kind: CrowdMutatorKind) => {
      if (Date.now() < cooldownUntilMs) return;
      vibrate(30);
      const res = await clientRef.current!.triggerAction(
        playerIdRef.current,
        kind,
        playerSecretRef.current,
      );
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
    [cooldownUntilMs, vibrate],
  );

  if (!snapshot) return null;

  const slotIdx = Math.max(0, Math.min(5, me?.racerSlot ?? 0));
  const palette = PLAYER_MARBLE_PALETTE[slotIdx] ?? PLAYER_MARBLE_PALETTE[0];
  const playerNumber = slotIdx + 1;
  const marbleColor = me?.colorHex ?? palette.hex;

  const bannerText = `PLAYER ${playerNumber} • ${palette.marbleTitle} (LOOK AT MAIN SCREEN!)`;

  return (
    <div
      className="mobile-party-controller"
      data-testid="mobile-party-controller"
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(circle at 50% 0%, #111c38 0%, #050811 75%)',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        padding: '12px 14px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        userSelect: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* Big Color-Coded Player Banner Matching TV/Laptop Marble */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          background: 'rgba(15, 23, 42, 0.92)',
          border: `2px solid ${marbleColor}`,
          boxShadow: `0 0 24px ${marbleColor}33`,
          borderRadius: '14px',
          padding: '12px 14px',
        }}
      >
        <div
          data-testid="mobile-room-overflow-badge"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '15px',
            fontWeight: 900,
            letterSpacing: '0.06em',
            color: '#ffffff',
            textTransform: 'uppercase',
          }}
        >
          <span
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: marbleColor,
              boxShadow: `0 0 12px ${marbleColor}`,
              border: '2px solid #ffffff',
              flexShrink: 0,
            }}
          />
          <span style={{ color: marbleColor }}>{bannerText}</span>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <form onSubmit={handleRenameSubmit} style={{ display: 'flex', gap: '6px', flex: 1 }}>
            <input
              type="text"
              aria-label="Player Handle"
              placeholder="@name"
              value={handleInput}
              maxLength={18}
              onChange={(e) => setHandleInput(e.target.value)}
              style={{
                background: '#090d16',
                color: '#f8fafc',
                border: `1px solid ${marbleColor}88`,
                borderRadius: '8px',
                padding: '7px 10px',
                fontSize: '14px',
                fontWeight: 700,
                flex: 1,
                minWidth: '110px',
              }}
            />
            <button
              type="submit"
              style={{
                background: marbleColor,
                color: '#040812',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Set @Name
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
                Main Screen
              </button>
            )}
          </form>
        </div>
      </header>

      {/* Live Feedback Ticker */}
      <div
        data-testid="party-controller-feedback"
        style={{
          background: 'rgba(30, 41, 59, 0.72)',
          borderLeft: `4px solid ${marbleColor}`,
          borderRadius: '8px',
          padding: '7px 12px',
          fontSize: '12px',
          color: '#e2e8f0',
        }}
      >
        {lastFeedback}
      </div>

      {/* Huge Responsive Virtual Trackball Pad + HOP (Space) Button */}
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: `1.5px solid ${marbleColor}55`,
          borderRadius: '18px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px',
          flex: 1,
          justifyContent: 'center',
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
            fontWeight: 700,
          }}
        >
          <span>VIRTUAL TRACKBALL PAD ({palette.slotLabel} • {palette.name.toUpperCase()})</span>
          <span
            style={{
              color: backspinActive ? '#f43f5e' : marbleColor,
              fontWeight: 800,
            }}
          >
            {backspinActive
              ? 'BACKSPIN BRAKE!'
              : `VEC (${trackballVec[0].toFixed(2)}, ${trackballVec[1].toFixed(2)})`}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            width: '100%',
            flexWrap: 'wrap',
          }}
        >
          {/* Huge Circular Tactile Trackball Surface */}
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
              width: '230px',
              height: '230px',
              borderRadius: '50%',
              position: 'relative',
              background:
                'radial-gradient(circle at 38% 32%, #334155 0%, #0f172a 62%, #020617 100%)',
              border: `4px solid ${backspinActive ? '#f43f5e' : marbleColor}`,
              boxShadow: isDraggingPad
                ? `0 0 36px ${marbleColor}88, inset 0 0 28px rgba(0,0,0,0.85)`
                : `0 0 18px ${marbleColor}33, inset 0 0 28px rgba(0,0,0,0.88)`,
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '18%',
                borderRadius: '50%',
                border: `1px dashed ${marbleColor}55`,
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: `${50 + trackballVec[0] * 38}%`,
                top: `${50 + trackballVec[1] * 38}%`,
                transform: 'translate(-50%, -50%)',
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: marbleColor,
                boxShadow: `0 0 20px ${marbleColor}, 0 0 10px rgba(255,255,255,0.8)`,
                border: '2.5px solid #ffffff',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Dedicated HOP (Space) Button */}
          <button
            type="button"
            data-testid="mobile-hop-button"
            onClick={handleHopClick}
            style={{
              width: '132px',
              height: '132px',
              borderRadius: '24px',
              background: `linear-gradient(145deg, ${marbleColor}, #0f172a)`,
              color: '#ffffff',
              border: `2.5px solid ${marbleColor}`,
              boxShadow: `0 8px 24px ${marbleColor}44`,
              fontSize: '16px',
              fontWeight: 900,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '20px', fontWeight: 900 }}>HOP</span>
            <span style={{ fontSize: '12px', opacity: 0.9 }}>(SPACE)</span>
          </button>
        </div>
      </section>

      {/* Quick Portal (Q) / Crater (F) / Bridge (V) Trigger Buttons */}
      <section
        style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(148, 163, 184, 0.24)',
          borderRadius: '14px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
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
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.07em',
              color: '#cbd5e1',
              textTransform: 'uppercase',
            }}
          >
            QUICK TRACK POWERS: PORTAL (Q) · CRATER (F) · BRIDGE (V)
          </span>
          <span
            data-testid="crowd-cooldown-badge"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: cooldownRemainingSec > 0 ? '#f59e0b' : '#10b981',
            }}
          >
            {cooldownRemainingSec > 0
              ? `Cooldown ${cooldownRemainingSec.toFixed(1)}s`
              : 'READY'}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}
        >
          {QUICK_CONTROLLER_POWERS.map((item) => {
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
                    ? 'rgba(30, 41, 59, 0.45)'
                    : 'rgba(15, 23, 42, 0.96)',
                  border: `1.5px solid ${disabled ? '#334155' : item.accentColor}`,
                  borderRadius: '10px',
                  padding: '10px 8px',
                  textAlign: 'center',
                  color: disabled ? '#64748b' : '#f8fafc',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <strong style={{ fontSize: '13px', color: disabled ? '#64748b' : item.accentColor }}>
                  {item.title}
                </strong>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  {item.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
