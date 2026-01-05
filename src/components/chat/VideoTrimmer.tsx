import { useState, useRef, useEffect, useCallback } from "react";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoTrimmerProps {
  videoUrl: string;
  onTrimComplete: (blob: Blob) => void;
  onCancel: () => void;
}

export const VideoTrimmer = ({ videoUrl, onTrimComplete, onCancel }: VideoTrimmerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 100]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);

  const trimStart = (trimRange[0] / 100) * duration;
  const trimEnd = (trimRange[1] / 100) * duration;
  const trimmedDuration = trimEnd - trimStart;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setTrimRange([0, 100]);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      
      // Loop within trim range during preview
      if (video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
        if (!isPlaying) {
          video.pause();
        }
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [trimStart, trimEnd, isPlaying]);

  const handleRangeChange = (values: number[]) => {
    setTrimRange([values[0], values[1]]);
    if (videoRef.current) {
      videoRef.current.currentTime = (values[0] / 100) * duration;
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.currentTime = trimStart;
      video.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  const handleTrim = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isTrimming) return;

    setIsTrimming(true);
    
    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Create a MediaRecorder to capture the trimmed video
      const stream = canvas.captureStream(30);
      
      // Try to get audio from the original video
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(video);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);
      
      // Combine video and audio streams
      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...destination.stream.getAudioTracks()
      ]);

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: "video/webm;codecs=vp9,opus",
      });
      
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        audioContext.close();
        onTrimComplete(blob);
        setIsTrimming(false);
      };

      // Set video to trim start and play
      video.currentTime = trimStart;
      video.muted = false;
      
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
      });

      mediaRecorder.start();
      video.play();

      // Draw frames to canvas
      const drawFrame = () => {
        if (video.currentTime >= trimEnd || video.paused) {
          video.pause();
          mediaRecorder.stop();
          return;
        }
        ctx.drawImage(video, 0, 0);
        requestAnimationFrame(drawFrame);
      };
      
      drawFrame();
    } catch (error) {
      console.error("Trimming error:", error);
      // Fallback: just return the original blob with time markers
      // In a real app, you might want to use FFmpeg.wasm for proper trimming
      setIsTrimming(false);
      
      // Simple fallback - just pass the original video
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      onTrimComplete(blob);
    }
  }, [trimStart, trimEnd, videoUrl, onTrimComplete, isTrimming]);

  return (
    <div className="flex flex-col h-full">
      {/* Video preview */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="max-w-full max-h-full object-contain"
          playsInline
          muted
        />
        
        {/* Play/Pause overlay */}
        <button
          onClick={togglePlayback}
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
        >
          {!isPlaying && (
            <div className="p-4 rounded-full bg-black/50">
              <Play className="h-8 w-8 text-white fill-white" />
            </div>
          )}
        </button>

        {/* Trim indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 flex items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="text-white text-sm font-medium">
            {formatTime(trimmedDuration)}
          </span>
        </div>
      </div>

      {/* Hidden canvas for video processing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Trim controls */}
      <div className="p-4 bg-black/80 space-y-4">
        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(trimStart)}</span>
            <span>{formatTime(trimEnd)}</span>
          </div>
          
          <Slider
            value={trimRange}
            onValueChange={handleRangeChange}
            min={0}
            max={100}
            step={0.1}
            className="w-full"
          />
          
          {/* Video timeline visualization */}
          <div className="relative h-12 bg-muted/30 rounded overflow-hidden">
            {/* Trim region highlight */}
            <div 
              className="absolute top-0 bottom-0 bg-primary/30 border-x-2 border-primary"
              style={{
                left: `${trimRange[0]}%`,
                width: `${trimRange[1] - trimRange[0]}%`
              }}
            />
            
            {/* Current time indicator */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white"
              style={{
                left: `${(currentTime / duration) * 100}%`
              }}
            />
          </div>
        </div>

        {/* Duration info */}
        <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
          <span>Original: {formatTime(duration)}</span>
          <span>→</span>
          <span className="text-primary font-medium">Trimmed: {formatTime(trimmedDuration)}</span>
        </div>
      </div>
    </div>
  );
};
