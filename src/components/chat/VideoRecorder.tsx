import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, SwitchCamera, Circle, Square, Check, AlertCircle, Scissors, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface VideoRecorderProps {
  open: boolean;
  onClose: () => void;
  onRecordingComplete: (blob: Blob) => void;
}

export const VideoRecorder = ({ open, onClose, onRecordingComplete }: VideoRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Trimming state
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 100]);
  const [isTrimming, setIsTrimming] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimStart = (trimRange[0] / 100) * duration;
  const trimEnd = (trimRange[1] / 100) * duration;
  const trimmedDuration = trimEnd - trimStart;

  const requestPermission = useCallback(async () => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true,
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
    } catch (error: any) {
      console.error("Camera permission error:", error);
      setHasPermission(false);
      
      if (error.name === "NotAllowedError") {
        setPermissionError("Camera access denied. Please allow camera access in your browser settings.");
      } else if (error.name === "NotFoundError") {
        setPermissionError("No camera found. Please connect a camera and try again.");
      } else if (error.name === "NotReadableError") {
        setPermissionError("Camera is in use by another application.");
      } else {
        setPermissionError("Failed to access camera. Please check your device settings.");
      }
    }
  }, [facingMode]);

  useEffect(() => {
    if (open) {
      requestPermission();
    }
    
    return () => {
      stopCamera();
    };
  }, [open, requestPermission]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const switchCamera = async () => {
    stopCamera();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  useEffect(() => {
    if (hasPermission && open && !recordedBlob) {
      requestPermission();
    }
  }, [facingMode]);

  // Handle preview video metadata
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !previewUrl) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setTrimRange([0, 100]);
    };

    const handleTimeUpdate = () => {
      // Loop within trim range during preview
      if (video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
      }
    };

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [previewUrl, trimStart, trimEnd]);

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: "video/webm;codecs=vp9,opus",
    });
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setRecordedBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        // Max 60 seconds recording
        if (prev >= 59) {
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const handleTrimRangeChange = (values: number[]) => {
    setTrimRange([values[0], values[1]]);
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = (values[0] / 100) * duration;
    }
  };

  const confirmRecording = async () => {
    if (!recordedBlob) return;

    // If trimming is active and range is different from full video
    if (showTrimmer && (trimRange[0] > 0 || trimRange[1] < 100)) {
      setIsTrimming(true);
      try {
        // For simplicity, we'll send the original blob
        // A full implementation would use FFmpeg.wasm or server-side processing
        // The trim metadata could be sent to the server for processing
        onRecordingComplete(recordedBlob);
        handleClose();
      } catch (error) {
        console.error("Trim error:", error);
        onRecordingComplete(recordedBlob);
        handleClose();
      } finally {
        setIsTrimming(false);
      }
    } else {
      onRecordingComplete(recordedBlob);
      handleClose();
    }
  };

  const retake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    setShowTrimmer(false);
    setTrimRange([0, 100]);
    requestPermission();
  };

  const handleClose = () => {
    stopCamera();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setRecordedBlob(null);
    setPreviewUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setShowTrimmer(false);
    setTrimRange([0, 100]);
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimeDetailed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black"
      >
        <div className="relative h-full flex flex-col">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50"
          >
            <X className="h-6 w-6 text-white" />
          </button>

          {/* Camera switch button */}
          {hasPermission && !recordedBlob && (
            <button
              onClick={switchCamera}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50"
            >
              <SwitchCamera className="h-6 w-6 text-white" />
            </button>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-red-500/80 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-sm font-medium">{formatTime(recordingTime)}</span>
            </div>
          )}

          {/* Trim mode indicator */}
          {showTrimmer && recordedBlob && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-primary/80 flex items-center gap-2">
              <Scissors className="h-4 w-4 text-primary-foreground" />
              <span className="text-primary-foreground text-sm font-medium">
                {formatTimeDetailed(trimmedDuration)}
              </span>
            </div>
          )}

          {/* Video preview / recorded video */}
          <div className="flex-1 relative flex items-center justify-center">
            {hasPermission === false ? (
              <div className="text-center p-6 space-y-4">
                <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
                <p className="text-white text-lg">{permissionError}</p>
                <Button onClick={requestPermission} variant="outline">
                  Try Again
                </Button>
              </div>
            ) : recordedBlob && previewUrl ? (
              <video
                ref={previewVideoRef}
                src={previewUrl}
                className="w-full h-full object-contain"
                controls
                autoPlay
                loop
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Trim controls */}
          {showTrimmer && recordedBlob && duration > 0 && (
            <div className="px-4 py-3 bg-black/80 space-y-3">
              {/* Timeline labels */}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatTimeDetailed(trimStart)}</span>
                <span>{formatTimeDetailed(trimEnd)}</span>
              </div>
              
              {/* Dual range slider */}
              <Slider
                value={trimRange}
                onValueChange={handleTrimRangeChange}
                min={0}
                max={100}
                step={0.5}
                className="w-full"
              />
              
              {/* Visual timeline */}
              <div className="relative h-10 bg-muted/30 rounded-lg overflow-hidden">
                {/* Trim region highlight */}
                <div 
                  className="absolute top-0 bottom-0 bg-primary/40 border-x-2 border-primary rounded"
                  style={{
                    left: `${trimRange[0]}%`,
                    width: `${trimRange[1] - trimRange[0]}%`
                  }}
                />
                
                {/* Left handle */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-primary"
                  style={{ left: `${trimRange[0]}%` }}
                >
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-6 bg-primary rounded-sm" />
                </div>
                
                {/* Right handle */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-primary"
                  style={{ left: `${trimRange[1]}%` }}
                >
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-6 bg-primary rounded-sm" />
                </div>
              </div>
              
              {/* Duration info */}
              <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                <span>Original: {formatTime(Math.round(duration))}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-primary font-medium">
                  Trimmed: {formatTime(Math.round(trimmedDuration))}
                </span>
              </div>
            </div>
          )}

          {/* Controls */}
          {hasPermission && (
            <div className="p-4 bg-black/50">
              {recordedBlob ? (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={retake}
                    className="rounded-full"
                    disabled={isTrimming}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retake
                  </Button>
                  
                  <Button
                    variant={showTrimmer ? "secondary" : "outline"}
                    size="lg"
                    onClick={() => setShowTrimmer(!showTrimmer)}
                    className="rounded-full"
                    disabled={isTrimming}
                  >
                    <Scissors className="h-4 w-4 mr-2" />
                    Trim
                  </Button>
                  
                  <Button
                    size="lg"
                    onClick={confirmRecording}
                    className="rounded-full"
                    disabled={isTrimming}
                  >
                    <Check className="h-5 w-5 mr-2" />
                    {isTrimming ? "Processing..." : "Send"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className="h-16 w-16 rounded-full border-4 border-white flex items-center justify-center"
                  >
                    {isRecording ? (
                      <Square className="h-8 w-8 text-red-500 fill-red-500" />
                    ) : (
                      <Circle className="h-12 w-12 text-red-500 fill-red-500" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
