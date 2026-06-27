import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useRoomContext,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useEffect } from "react";

export type CallMode = "video" | "voice";

interface VideoCallProps {
  token: string;
  serverUrl: string;
  roomName: string;
  callMode?: CallMode;
  onDisconnected?: () => void;
  className?: string;
}

function CallUI({ callMode, onDisconnected }: { callMode: CallMode; onDisconnected?: () => void }) {
  const room = useRoomContext();

  useEffect(() => {
    const handler = () => onDisconnected?.();
    room.on("disconnected", handler);
    return () => {
      room.off("disconnected", handler);
    };
  }, [room, onDisconnected]);

  if (callMode === "voice") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-between bg-background p-6">
        <RoomAudioRenderer />
        <VoiceParticipants />
        <ControlBar
          controls={{
            microphone: true,
            camera: false,
            screenShare: false,
            leave: true,
            chat: false,
          }}
        />
      </div>
    );
  }

  return <VideoConference />;
}

function VoiceParticipants() {
  const tracks = useTracks([Track.Source.Microphone]);

  return (
    <div className="flex flex-1 flex-wrap items-center justify-center gap-6 py-12">
      {tracks.length === 0 && (
        <p className="text-muted-foreground">Waiting for participants…</p>
      )}
      {tracks.map((track) => {
        const name = track.participant.name ?? track.participant.identity;
        const initial = name?.[0]?.toUpperCase() ?? "?";
        return (
          <div key={track.participant.identity} className="flex flex-col items-center gap-3">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground">
              {initial}
            </div>
            <span className="text-sm text-foreground">{name}</span>
          </div>
        );
      })}
    </div>
  );
}

export function VideoCall({
  token,
  serverUrl,
  callMode = "video",
  onDisconnected,
  className = "",
}: VideoCallProps) {
  return (
    <div className={`h-full w-full ${className}`}>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        video={callMode === "video"}
        audio={true}
        onDisconnected={onDisconnected}
        data-lk-theme="default"
        style={{ height: "100%", width: "100%" }}
      >
        <CallUI callMode={callMode} onDisconnected={onDisconnected} />
      </LiveKitRoom>
    </div>
  );
}
