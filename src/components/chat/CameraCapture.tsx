import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, X, SwitchCamera, Video, Circle, Square, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob, type: "photo" | "video") => void;
}

export const CameraCapture = ({ open, onClose, onCapture }: CameraCaptureProps) => {
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturedMedia, setCapturedMedia] = useState<{ blob: Blob; type: "photo" | "video"; url: string } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: { facingMode },
        audio: mode === "video",
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  }, [facingMode, mode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, []);

  const switchCamera = async () => {
    stopCamera();
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedMedia({ blob, type: "photo", url });
        }
      }, "image/jpeg", 0.9);
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setCapturedMedia({ blob, type: "video", url });
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
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

  const confirmCapture = () => {
    if (capturedMedia) {
      onCapture(capturedMedia.blob, capturedMedia.type);
      handleClose();
    }
  };

  const retake = () => {
    if (capturedMedia) {
      URL.revokeObjectURL(capturedMedia.url);
    }
    setCapturedMedia(null);
    startCamera();
  };

  const handleClose = () => {
    stopCamera();
    if (capturedMedia) {
      URL.revokeObjectURL(capturedMedia.url);
    }
    setCapturedMedia(null);
    setRecordingTime(0);
    onClose();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Start camera when opened
  useState(() => {
    if (open) {
      startCamera();
    }
    return () => stopCamera();
  });

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
          {!capturedMedia && (
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

          {/* Video preview / captured media */}
          <div className="flex-1 relative">
            {capturedMedia ? (
              capturedMedia.type === "photo" ? (
                <img
                  src={capturedMedia.url}
                  alt="Captured"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  src={capturedMedia.url}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                  loop
                />
              )
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                onLoadedMetadata={() => startCamera()}
              />
            )}
          </div>

          {/* Controls */}
          <div className="p-6 bg-black/50">
            {capturedMedia ? (
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
                  onClick={confirmCapture}
                  className="rounded-full"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Send
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-8">
                {/* Mode toggle */}
                <button
                  onClick={() => setMode("photo")}
                  className={`p-2 rounded-full ${mode === "photo" ? "text-white" : "text-white/50"}`}
                >
                  <Camera className="h-6 w-6" />
                </button>

                {/* Capture button */}
                {mode === "photo" ? (
                  <button
                    onClick={takePhoto}
                    className="h-16 w-16 rounded-full border-4 border-white flex items-center justify-center"
                  >
                    <div className="h-12 w-12 rounded-full bg-white" />
                  </button>
                ) : (
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
                )}

                <button
                  onClick={() => setMode("video")}
                  className={`p-2 rounded-full ${mode === "video" ? "text-white" : "text-white/50"}`}
                >
                  <Video className="h-6 w-6" />
                </button>
              </div>
            )}
          </div>

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
