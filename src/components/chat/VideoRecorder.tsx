import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Video, X, SwitchCamera, Circle, Square, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

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
    if (hasPermission && open) {
      requestPermission();
    }
  }, [facingMode]);

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

  const confirmRecording = () => {
    if (recordedBlob) {
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
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

          {/* Controls */}
          {hasPermission && (
            <div className="p-6 bg-black/50">
              {recordedBlob ? (
                <div className="flex items-center justify-center gap-8">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={retake}
                    className="rounded-full"
                  >
                    Retake
                  </Button>
                  <Button
                    size="lg"
                    onClick={confirmRecording}
                    className="rounded-full"
                  >
                    <Check className="h-5 w-5 mr-2" />
                    Send
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
