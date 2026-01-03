import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Image, X, Sparkles, Send, Type, Video, Mic } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ContentType = "text" | "image" | "video" | "audio";
type UploadType = "post" | "story";

const CreatePage = () => {
  const [searchParams] = useSearchParams();
  const defaultType = searchParams.get("type") === "story" ? "story" : "post";
  
  const [uploadType, setUploadType] = useState<UploadType>(defaultType);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type based on content type
      const isValidType = 
        (contentType === "image" && file.type.startsWith("image/")) ||
        (contentType === "video" && file.type.startsWith("video/")) ||
        (contentType === "audio" && file.type.startsWith("audio/"));

      if (!isValidType) {
        toast({
          title: "Invalid file type",
          description: `Please select a ${contentType} file`,
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 50MB for video, 10MB for others)
      const maxSize = contentType === "video" ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `Please select a file smaller than ${contentType === "video" ? "50MB" : "10MB"}`,
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setPreview(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Microphone access denied",
        description: "Please allow microphone access to record audio",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validate based on content type
    if (contentType === "text" && !textContent.trim()) {
      toast({
        title: "Content required",
        description: "Please enter some text",
        variant: "destructive",
      });
      return;
    }

    if ((contentType === "image" || contentType === "video") && !selectedFile) {
      toast({
        title: "File required",
        description: `Please select a ${contentType} file`,
        variant: "destructive",
      });
      return;
    }

    if (contentType === "audio" && !audioBlob && !selectedFile) {
      toast({
        title: "Audio required",
        description: "Please record or upload an audio file",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      let mediaUrl: string | null = null;

      // Upload media if present
      if (selectedFile || audioBlob) {
        const fileToUpload = audioBlob || selectedFile!;
        const ext = audioBlob ? "webm" : selectedFile!.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(fileName, fileToUpload);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("media")
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
      }

      if (uploadType === "post") {
        const { error: insertError } = await supabase.from("posts").insert({
          user_id: user.id,
          caption: caption || null,
          text_content: contentType === "text" ? textContent : null,
          media_url: mediaUrl || "",
          post_type: contentType,
        });

        if (insertError) throw insertError;

        toast({
          title: "Post created!",
          description: "Your post has been shared",
        });
      } else {
        if (!mediaUrl) {
          toast({
            title: "Media required",
            description: "Stories require an image or video",
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }

        const { error: insertError } = await supabase.from("stories").insert({
          user_id: user.id,
          media_url: mediaUrl,
        });

        if (insertError) throw insertError;

        toast({
          title: "Story posted!",
          description: "Your story is now visible to your followers",
        });
      }

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setAudioBlob(null);
    setTextContent("");
    setCaption("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getAcceptType = () => {
    switch (contentType) {
      case "image": return "image/*";
      case "video": return "video/mp4,video/mov,video/webm";
      case "audio": return "audio/mp3,audio/wav,audio/m4a,audio/*";
      default: return "";
    }
  };

  const contentTypes = [
    { id: "text", icon: Type, label: "Text" },
    { id: "image", icon: Image, label: "Image" },
    { id: "video", icon: Video, label: "Video" },
    { id: "audio", icon: Mic, label: "Audio" },
  ] as const;

  return (
    <MainLayout>
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Create</h1>

        <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as UploadType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="post">Post</TabsTrigger>
            <TabsTrigger value="story">Story</TabsTrigger>
          </TabsList>

          <TabsContent value={uploadType} className="mt-0">
            <div className="card-base p-6 space-y-6">
              {/* Content Type Selector */}
              {uploadType === "post" && (
                <div className="flex gap-2">
                  {contentTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setContentType(type.id);
                        clearSelection();
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all",
                        contentType === type.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <type.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Text Content */}
              {contentType === "text" && uploadType === "post" && (
                <div className="space-y-3">
                  <Textarea
                    placeholder="What's on your mind?"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    className="min-h-32 resize-none input-field text-lg"
                    maxLength={2200}
                  />
                  <div className="flex justify-end text-sm text-muted-foreground">
                    <span>{textContent.length}/2200</span>
                  </div>
                </div>
              )}

              {/* Media Content */}
              {(contentType !== "text" || uploadType === "story") && (
                <>
                  {!preview ? (
                    <div className="space-y-4">
                      {contentType === "audio" && uploadType === "post" && (
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={isRecording ? stopRecording : startRecording}
                          className={cn(
                            "w-full flex flex-col items-center justify-center gap-4 py-12 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                            isRecording
                              ? "border-destructive bg-destructive/10"
                              : "border-border hover:border-primary/50 hover:bg-muted/30"
                          )}
                        >
                          <div className={cn(
                            "h-16 w-16 rounded-full flex items-center justify-center",
                            isRecording ? "bg-destructive animate-pulse" : "gradient-primary"
                          )}>
                            <Mic className="h-8 w-8 text-primary-foreground" />
                          </div>
                          <p className="font-semibold text-foreground">
                            {isRecording ? "Recording... Tap to stop" : "Tap to record audio"}
                          </p>
                        </motion.button>
                      )}

                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-4 py-16 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                      >
                        <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center">
                          {contentType === "video" ? (
                            <Video className="h-8 w-8 text-primary-foreground" />
                          ) : contentType === "audio" ? (
                            <Mic className="h-8 w-8 text-primary-foreground" />
                          ) : (
                            <Image className="h-8 w-8 text-primary-foreground" />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-foreground">
                            {uploadType === "story" ? "Select media" : `Upload ${contentType}`}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {contentType === "video"
                              ? "MP4, MOV, WebM (max 50MB)"
                              : contentType === "audio"
                              ? "MP3, WAV, M4A (max 10MB)"
                              : "JPG, PNG, GIF (max 10MB)"}
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-xl overflow-hidden bg-muted">
                        {contentType === "video" || (selectedFile?.type.startsWith("video/")) ? (
                          <video
                            src={preview}
                            className="w-full max-h-96 object-contain"
                            controls
                          />
                        ) : contentType === "audio" || audioBlob ? (
                          <div className="p-8 flex items-center justify-center">
                            <audio src={preview} controls className="w-full" />
                          </div>
                        ) : (
                          <img
                            src={preview}
                            alt="Preview"
                            className="w-full max-h-96 object-contain"
                          />
                        )}
                        <button
                          onClick={clearSelection}
                          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Caption */}
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Write a caption..."
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          className="min-h-24 resize-none input-field"
                          maxLength={2200}
                        />
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <button className="flex items-center gap-2 text-primary hover:underline">
                            <Sparkles className="h-4 w-4" />
                            AI Caption (coming soon)
                          </button>
                          <span>{caption.length}/2200</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={isUploading || (contentType === "text" ? !textContent.trim() : !preview)}
                className="btn-primary w-full h-12"
              >
                {isUploading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Share {uploadType === "post" ? "Post" : "Story"}
                  </>
                )}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={uploadType === "story" ? "image/*,video/*" : getAcceptType()}
              onChange={handleFileSelect}
              className="hidden"
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default CreatePage;
