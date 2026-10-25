/**
 * Couch / Stage 6-Player QR Join Modal (`src/multiplayer/QrPartyHudModal.tsx`)
 *
 * Simple, single-room multiplayer lobby:
 * - Whoever runs the server owns THE room.
 * - Up to 6 players (P1–P6) scan the QR code on their phone to claim their own colored marble
 *   and play using their phone while viewing the game on the main screen (1x1 or 3x2 Split-Screen).
 * - Shows the big scannable QR code + the 6 Marble Slots (P1–P6) showing Connected Phone vs AI Bot vs Open Slot,
 *   plus individual "+ Add AI Bot" buttons and a 1-click "Fill Open Slots with AI Bots (6 Marbles)" button.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  createPartyRoomClient,
  detectBrowserTunnelOrigin,
  partyJoinUrlForViewer,
  resolvePartyApiBase,
  type PartyRoomClient,
} from './party-client';
import {
  MAX_PLAYERS,
  PLAYER_MARBLE_PALETTE,
  type PartyPlayerState,
  type PartyRoomSnapshot,
} from './party-types';
import { renderQrSvg } from './qr-svg';

export interface QrPartyHudModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly client?: PartyRoomClient;
  readonly roomCode?: string;
  readonly onSynthesizeCrowdTwist?: (combinedPrompt: string) => void;
}

const BOT_NAMES_BY_SLOT = [
  'bot_cobalt',
  'bot_maya',
  'bot_dan',
  'bot_alex',
  'bot_zoe',
  'bot_kai',
] as const;

export const QrPartyHudModal: React.FC<QrPartyHudModalProps> = ({
  isOpen,
  onClose,
  client: externalClient,
  roomCode = 'ARGON',
}) => {
  const [internalClient] = useState<PartyRoomClient>(() =>
    externalClient ?? createPartyRoomClient({ roomCode }),
  );
  const activeClient = externalClient ?? internalClient;

  const [snapshot, setSnapshot] = useState<PartyRoomSnapshot>(() =>
    activeClient.getSnapshot(),
  );
  const [tunnelInput, setTunnelInput] = useState<string>(
    () => activeClient.getSnapshot().customTunnelUrl ?? '',
  );
  const [simulatingBots, setSimulatingBots] = useState<boolean>(false);

  useEffect(() => {
    const unsub = activeClient.subscribe((snap) => {
      setSnapshot(snap);
    });
    return () => {
      unsub();
    };
  }, [activeClient]);

  useEffect(() => {
    const hasBots = snapshot.players.some((p) => p.isSimulated);
    if (!simulatingBots && !hasBots) return;
    const interval = window.setInterval(() => {
      void activeClient.simulateCrowdPhones(MAX_PLAYERS, true);
    }, 350);
    return () => window.clearInterval(interval);
  }, [activeClient, simulatingBots, snapshot.players]);

  const displayJoinUrl = partyJoinUrlForViewer({
    roomCode: snapshot.roomCode,
    serverJoinUrl: snapshot.joinUrl,
    tunnelOrigin:
      snapshot.customTunnelUrl || resolvePartyApiBase() || detectBrowserTunnelOrigin(),
  });
  const [qrSvgMarkup, setQrSvgMarkup] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void renderQrSvg(displayJoinUrl, {
      sizePx: 220,
      marginModules: 4,
      title: `Scan to Join 6-Player Marble Room`,
    }).then((svg) => {
      if (!cancelled) setQrSvgMarkup(svg);
    });
    return () => {
      cancelled = true;
    };
  }, [displayJoinUrl]);

  const handleApplyTunnelUrl = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const cleaned = tunnelInput.trim();
      await activeClient.setCustomTunnelUrl(cleaned.length > 0 ? cleaned : null);
    },
    [activeClient, tunnelInput],
  );

  const handleFillOpenSlotsWithBots = useCallback(async () => {
    await activeClient.simulateCrowdPhones(MAX_PLAYERS, false);
    setSimulatingBots(true);
  }, [activeClient]);

  const handleAddBotToSlot = useCallback(
    async (slotIndex: number) => {
      const botHandle = BOT_NAMES_BY_SLOT[slotIndex] ?? `bot_p${slotIndex + 1}`;
      await activeClient.join({
        roomCode: snapshot.roomCode,
        playerId: `sim_phone_${slotIndex + 1}`,
        handle: botHandle,
        preferredRole: 'racer',
        preferredSlot: slotIndex,
        isSimulated: true,
      });
      setSimulatingBots(true);
    },
    [activeClient, snapshot.roomCode],
  );

  if (!isOpen) return null;

  const racersBySlot = new Map<number, PartyPlayerState>();
  for (const p of snapshot.players) {
    if (p.role === 'racer' && p.racerSlot !== null && p.racerSlot >= 0 && p.racerSlot < MAX_PLAYERS) {
      racersBySlot.set(p.racerSlot, p);
    }
  }

  const connectedCount = racersBySlot.size;

  return (
    <aside
      className="qr-party-hud-modal"
      data-testid="qr-party-hud-modal"
      role="dialog"
      aria-label="6-Player QR Split-Screen Party Lobby"
      style={{
        position: 'fixed',
        inset: '24px',
        zIndex: 60,
        background: 'rgba(7, 11, 22, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(56, 189, 248, 0.45)',
        borderRadius: '18px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '16px 22px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
          background: 'rgba(15, 23, 42, 0.92)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.09em',
              color: '#38bdf8',
              textTransform: 'uppercase',
            }}
          >
            SERVER-OWNED COUCH / STAGE ROOM • UP TO {MAX_PLAYERS} MARBLES ({connectedCount}/{MAX_PLAYERS} ACTIVE)
          </div>
          <h2 style={{ margin: '3px 0 0', fontSize: '20px', fontWeight: 800 }}>
            Scan QR on Your Phone to Claim a Colored Marble &amp; Play on This Screen!
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            data-testid="simulate-crowd-phones-btn"
            onClick={() => void handleFillOpenSlotsWithBots()}
            style={{
              background: simulatingBots
                ? 'linear-gradient(135deg, #059669, #10b981)'
                : 'linear-gradient(135deg, #f59e0b, #ea580c)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
            }}
          >
            Fill Open Slots with AI Bots (6 Marbles)
          </button>

          <button
            type="button"
            data-testid="close-qr-party-modal"
            onClick={onClose}
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid #475569',
              borderRadius: '10px',
              padding: '9px 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Back to Game [ESC]
          </button>
        </div>
      </header>

      {/* Main 2-Column Layout: Left = Scannable QR Code, Right = 6 Marble Slots (P1..P6) */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '18px',
          padding: '18px 22px',
          overflowY: 'auto',
        }}
      >
        {/* Column 1: Big Scannable QR Code & Join URL */}
        <section
          style={{
            background: 'rgba(15, 23, 42, 0.78)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
            borderRadius: '14px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            data-testid="qr-svg-container"
            style={{
              background: '#ffffff',
              padding: '12px',
              borderRadius: '14px',
              boxShadow: '0 8px 24px rgba(56, 189, 248, 0.25)',
            }}
            dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
          />

          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
              PHONE CONTROLLER URL (PLAY ON PHONE, WATCH MAIN SCREEN)
            </div>
            <div
              data-testid="party-join-url"
              style={{
                marginTop: '5px',
                padding: '7px 9px',
                background: '#090d16',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#38bdf8',
                wordBreak: 'break-all',
              }}
            >
              {displayJoinUrl}
            </div>
          </div>

          <form
            onSubmit={(e) => void handleApplyTunnelUrl(e)}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginTop: 'auto',
            }}
          >
            <label
              htmlFor="party-tunnel-url-input"
              style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}
            >
              5G / Venue Tunnel Override (Optional):
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                id="party-tunnel-url-input"
                data-testid="party-tunnel-url-input"
                type="text"
                placeholder="https://your-tunnel.trycloudflare.com"
                value={tunnelInput}
                onChange={(e) => setTunnelInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#090d16',
                  color: '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  fontSize: '12px',
                }}
              />
              <button
                type="submit"
                data-testid="apply-tunnel-url-btn"
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Set URL
              </button>
            </div>
          </form>
        </section>

        {/* Column 2: 6 Marble Slots (P1 to P6) */}
        <section
          style={{
            background: 'rgba(15, 23, 42, 0.78)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            borderRadius: '14px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
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
                fontSize: '13px',
                fontWeight: 800,
                color: '#38bdf8',
                letterSpacing: '0.06em',
              }}
            >
              6 MARBLE SLOTS (P1–P6) • 3×2 SPLIT-SCREEN READY
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Press <strong>[Tab]</strong> for 6-Player Split-Screen Grid
            </span>
          </div>

          <div
            data-testid="party-racer-roster"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '12px',
              flex: 1,
            }}
          >
            {PLAYER_MARBLE_PALETTE.map((palette) => {
              const slotIndex = palette.slotIndex;
              const occupant = racersBySlot.get(slotIndex);
              const isHuman = Boolean(occupant && !occupant.isSimulated);
              const isBot = Boolean(occupant && occupant.isSimulated);

              return (
                <div
                  key={palette.slotId}
                  data-testid={`party-marble-slot-${slotIndex}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '14px',
                    background: occupant
                      ? 'rgba(30, 41, 59, 0.82)'
                      : 'rgba(15, 23, 42, 0.55)',
                    border: `2px solid ${occupant ? palette.hex : 'rgba(71, 85, 105, 0.45)'}`,
                    borderRadius: '12px',
                    boxShadow: occupant ? `0 0 20px ${palette.hex}25` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: `radial-gradient(circle at 32% 32%, #ffffff, ${palette.hex} 55%, #090d16)`,
                          boxShadow: `0 0 10px ${palette.hex}`,
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#f8fafc' }}>
                          {palette.slotId} • {palette.name}
                        </div>
                        <div style={{ fontSize: '11px', color: palette.hex, fontWeight: 700 }}>
                          {palette.marbleTitle}
                        </div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: isHuman
                          ? 'rgba(16, 185, 129, 0.2)'
                          : isBot
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(51, 65, 85, 0.45)',
                        color: isHuman
                          ? '#34d399'
                          : isBot
                            ? '#fbbf24'
                            : '#94a3b8',
                        border: `1px solid ${
                          isHuman ? '#10b981' : isBot ? '#f59e0b' : '#475569'
                        }`,
                      }}
                    >
                      {isHuman
                        ? 'Connected Phone'
                        : isBot
                          ? 'AI Bot'
                          : 'Open Slot — Scan QR'}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px solid rgba(148, 163, 184, 0.14)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    {occupant ? (
                      <>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>
                          @{occupant.handle}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          Tilt: ({occupant.input.moveXZ[0].toFixed(1)}, {occupant.input.moveXZ[1].toFixed(1)})
                        </div>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          Waiting for phone scan...
                        </span>
                        <button
                          type="button"
                          data-testid={`add-ai-bot-slot-${slotIndex}`}
                          onClick={() => void handleAddBotToSlot(slotIndex)}
                          style={{
                            background: 'rgba(56, 189, 248, 0.14)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            borderRadius: '8px',
                            padding: '5px 10px',
                            fontSize: '11px',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          + Add AI Bot
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );
};
