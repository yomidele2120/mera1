import { useEffect, useRef, useState } from "react";

/**
 * Adaptive video quality for Zego calls.
 *
 * Listens to the Zego Express quality callbacks (publisher/player stats:
 * bitrate, packet loss, RTT) and steps the outgoing video resolution +
 * bitrate up or down so the call stays smooth on slow connections.
 * Falls back to `applyConstraints` on the raw track when the Express
 * `setVideoConfig` API is unavailable.
 */

export type QualityLevel = "high" | "medium" | "low" | "minimal";

interface Level {
  name: QualityLevel;
  width: number;
  height: number;
  frameRate: number;
  bitrate: number; // kbps
  label: string;
}

const LEVELS: Level[] = [
  { name: "high", width: 1280, height: 720, frameRate: 30, bitrate: 1300, label: "HD" },
  { name: "medium", width: 854, height: 480, frameRate: 24, bitrate: 700, label: "Good" },
  { name: "low", width: 640, height: 360, frameRate: 20, bitrate: 380, label: "Low data" },
  { name: "minimal", width: 320, height: 240, frameRate: 15, bitrate: 180, label: "Weak network" },
];

interface Sample {
  packetLossPct: number;
  rttMs: number;
  videoKbps: number;
}

export type ZegoExpressLike = {
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
  off?: (event: string, cb?: (...args: unknown[]) => void) => void;
  setVideoConfig?: (
    stream: MediaStream,
    config: { width?: number; height?: number; frameRate?: number; maxBitrate?: number },
  ) => Promise<unknown> | unknown;
};

interface Options {
  /** Only adapt while the call is actually connected and sending video. */
  enabled: boolean;
  getExpress: () => ZegoExpressLike | null;
  getStream: () => MediaStream | null;
}

function readSample(stats: unknown): Sample | null {
  if (!stats || typeof stats !== "object") return null;
  const s = stats as Record<string, unknown>;
  const num = (...keys: string[]) => {
    for (const k of keys) {
      const v = s[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
    return undefined;
  };
  const packetLossPct = num("videoPacketLostRate", "packetLostRate", "videoLostRate");
  const rttMs = num("rtt", "networkRtt");
  const videoKbps = num("videoKBPS", "videoBitrate", "videoKbps");
  if (packetLossPct === undefined && rttMs === undefined && videoKbps === undefined) return null;
  return {
    // Zego reports loss as a fraction on some versions and a percent on others.
    packetLossPct:
      packetLossPct === undefined ? 0 : packetLossPct <= 1 ? packetLossPct * 100 : packetLossPct,
    rttMs: rttMs ?? 0,
    videoKbps: videoKbps ?? 0,
  };
}

export function useAdaptiveVideoQuality({ enabled, getExpress, getStream }: Options) {
  const [level, setLevel] = useState<QualityLevel>("high");
  const [degraded, setDegraded] = useState(false);
  const indexRef = useRef(0);
  const badRef = useRef(0);
  const goodRef = useRef(0);
  const lastChangeRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;

    const apply = async (idx: number) => {
      const target = LEVELS[idx];
      const stream = getStream();
      if (!stream) return;
      const express = getExpress();
      try {
        if (express?.setVideoConfig) {
          await express.setVideoConfig(stream, {
            width: target.width,
            height: target.height,
            frameRate: target.frameRate,
            maxBitrate: target.bitrate,
          });
        } else {
          const track = stream.getVideoTracks()[0];
          await track?.applyConstraints({
            width: { ideal: target.width },
            height: { ideal: target.height },
            frameRate: { ideal: target.frameRate },
          });
        }
        console.log("[adaptive-quality] ->", target.name, target.bitrate + "kbps");
      } catch (e) {
        console.warn("[adaptive-quality] failed to apply", target.name, e);
      }
      if (disposed) return;
      setLevel(target.name);
      setDegraded(idx > 0);
    };

    const step = (delta: number) => {
      const next = Math.min(LEVELS.length - 1, Math.max(0, indexRef.current + delta));
      if (next === indexRef.current) return;
      // Don't thrash: at most one change every 6 seconds.
      if (Date.now() - lastChangeRef.current < 6000) return;
      indexRef.current = next;
      lastChangeRef.current = Date.now();
      badRef.current = 0;
      goodRef.current = 0;
      void apply(next);
    };

    const evaluate = (sample: Sample) => {
      const bad = sample.packetLossPct > 8 || sample.rttMs > 400 || (sample.videoKbps > 0 && sample.videoKbps < 120);
      const good = sample.packetLossPct < 2 && (sample.rttMs === 0 || sample.rttMs < 200);
      if (bad) {
        badRef.current += 1;
        goodRef.current = 0;
        if (badRef.current >= 2) step(1);
      } else if (good) {
        goodRef.current += 1;
        badRef.current = 0;
        if (goodRef.current >= 6) step(-1);
      }
    };

    const onQuality = (...args: unknown[]) => {
      for (const arg of args) {
        const sample = readSample(arg);
        if (sample) {
          evaluate(sample);
          return;
        }
      }
    };

    const express = getExpress();
    express?.on?.("publisherQualityUpdate", onQuality);
    express?.on?.("playerQualityUpdate", onQuality);

    // Fallback: sample the raw WebRTC-ish signal via the Network Information
    // API when Zego stats never arrive (older SDK builds / voice-only).
    const conn = (navigator as Navigator & {
      connection?: { downlink?: number; rtt?: number; addEventListener?: (t: string, cb: () => void) => void; removeEventListener?: (t: string, cb: () => void) => void };
    }).connection;

    const onConnChange = () => {
      if (!conn) return;
      evaluate({
        packetLossPct: 0,
        rttMs: conn.rtt ?? 0,
        videoKbps: conn.downlink ? conn.downlink * 1000 : 0,
      });
    };
    conn?.addEventListener?.("change", onConnChange);

    // Start from the top quality tier.
    void apply(indexRef.current);

    return () => {
      disposed = true;
      const ex = getExpress();
      ex?.off?.("publisherQualityUpdate", onQuality);
      ex?.off?.("playerQualityUpdate", onQuality);
      conn?.removeEventListener?.("change", onConnChange);
    };
  }, [enabled, getExpress, getStream]);

  return { level, degraded, label: LEVELS.find((l) => l.name === level)?.label ?? "" };
}
