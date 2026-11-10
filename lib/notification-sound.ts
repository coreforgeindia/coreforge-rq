let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

/**
 * Unlocks the Web Audio API context during a user gesture so subsequent
 * notifications can chime reliably.
 */
export function unlockAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
  } catch {
    // Ignore audio context restriction errors in non-interactive environments.
  }
}

export type SoundVariant = "mention" | "alert" | "success";

function scheduleTone(
  ctx: AudioContext,
  frequency: number,
  startOffsetSec: number,
  durationSec: number,
  peakGain: number,
  type: OscillatorType = "sine"
): void {
  const startTime = ctx.currentTime + startOffsetSec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.02);
}

/**
 * Plays a synthesized notification chime using the Web Audio API.
 * Safe no-op when muted or unsupported.
 */
export function playNotificationSound(
  variant: SoundVariant = "mention",
  enabled = true
): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    if (variant === "mention") {
      // Crisp two-tone bell chime (D5 -> A5) with soft harmonic overtone
      scheduleTone(ctx, 587.33, 0, 0.22, 0.14, "sine");
      scheduleTone(ctx, 880.0, 0.09, 0.34, 0.16, "sine");
      scheduleTone(ctx, 1760.0, 0.09, 0.22, 0.035, "triangle");
    } else if (variant === "success") {
      // Warm ascending confirmation chime (C5 -> E5 -> G5)
      scheduleTone(ctx, 523.25, 0, 0.18, 0.1, "sine");
      scheduleTone(ctx, 659.25, 0.07, 0.22, 0.11, "sine");
      scheduleTone(ctx, 783.99, 0.14, 0.3, 0.12, "sine");
    } else {
      // Clean single-pulse alert chime (E5 -> B5)
      scheduleTone(ctx, 659.25, 0, 0.2, 0.13, "sine");
      scheduleTone(ctx, 987.77, 0.08, 0.28, 0.12, "sine");
    }
  } catch {
    // Ignore audio synthesis errors in restricted contexts.
  }
}

