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
type StoryContentType = "media" | "text";

const STORY_BACKGROUNDS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  "linear-gradient(135deg, #fc5c7d 0%, #6a82fb 100%)",
  "linear-gradient(135deg, #f12711 0%, #f5af19 100%)",
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
];

const CreatePage = () => {
  const [searchParams] = useSearchParams();
  const defaultType = searchParams.get("type") === "story" ? "story" : "post";
  
  const [uploadType, setUploadType] = useState<UploadType>(defaultType);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [storyContentType, setStoryContentType] = useState<StoryContentType>("media");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [storyText, setStoryText] = useState("");
  const [selectedBackground, setSelectedBackground] = useState(STORY_BACKGROUNDS[0]);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const isAudio = file.type.startsWith("audio/");

      // For stories, accept both image and video
      if (uploadType === "story") {
        if (!isImage && !isVideo) {
          toast({
            title: "Invalid file type",
            description: "Please select an image or video file",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Validate file type based on content type for posts
        const isValidType = 
          (contentType === "image" && isImage) ||
          (contentType === "video" && isVideo) ||
          (contentType === "audio" && isAudio);

        if (!isValidType) {
          toast({
            title: "Invalid file type",
            description: `Please select a ${contentType} file`,
            variant: "destructive",
          });
          return;
        }
      }

      // Validate file size (max 50MB for video, 10MB for others)
      const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `Please select a file smaller than ${isVideo ? "50MB" : "10MB"}`,
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

  const generateTextStoryImage = async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Parse gradient
      const gradientMatch = selectedBackground.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);
      if (gradientMatch) {
        const angle = parseInt(gradientMatch[1]);
        const colors = gradientMatch[2].split(",").map(c => c.trim());
        
        const angleRad = (angle - 90) * Math.PI / 180;
        const x1 = canvas.width / 2 - Math.cos(angleRad) * canvas.width;
        const y1 = canvas.height / 2 - Math.sin(angleRad) * canvas.height;
        const x2 = canvas.width / 2 + Math.cos(angleRad) * canvas.width;
        const y2 = canvas.height / 2 + Math.sin(angleRad) * canvas.height;
        
        const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
        colors.forEach((color, i) => {
          const colorMatch = color.match(/(#[a-fA-F0-9]+)\s*(\d+)?%?/);
          if (colorMatch) {
            gradient.addColorStop(i / (colors.length - 1), colorMatch[1]);
          }
        });
        ctx.fillStyle = gradient;
      } else {
        ctx.fillStyle = selectedBackground;
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw text
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      const maxWidth = canvas.width - 120;
      const lineHeight = 72;
      const fontSize = 56;
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

      const words = storyText.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine + (currentLine ? " " : "") + word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }

      const totalHeight = lines.length * lineHeight;
      const startY = (canvas.height - totalHeight) / 2;

      lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, startY + i * lineHeight + lineHeight / 2);
      });

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to generate image"));
        }
      }, "image/jpeg", 0.9);
    });
  };

  const handleSubmit = async () => {
    if (!user) return;

    // Validate based on content type
    if (contentType === "text" && uploadType === "post" && !textContent.trim()) {
      toast({
        title: "Content required",
        description: "Please enter some text",
        variant: "destructive",
      });
      return;
    }

    if (uploadType === "story" && storyContentType === "text" && !storyText.trim()) {
      toast({
        title: "Content required",
        description: "Please enter some text for your story",
        variant: "destructive",
      });
      return;
    }

    if ((contentType === "image" || contentType === "video") && uploadType === "post" && !selectedFile) {
      toast({
        title: "File required",
        description: `Please select a ${contentType} file`,
        variant: "destructive",
      });
      return;
    }

    if (uploadType === "story" && storyContentType === "media" && !selectedFile) {
      toast({
        title: "File required",
        description: "Please select an image or video",
        variant: "destructive",
      });
      return;
    }

    if (contentType === "audio" && uploadType === "post" && !audioBlob && !selectedFile) {
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

      // Handle text story - generate image from canvas
      if (uploadType === "story" && storyContentType === "text") {
        const imageBlob = await generateTextStoryImage();
        const fileName = `${user.id}/${Date.now()}.jpg`;
        
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(fileName, imageBlob);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("media")
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
      }
      // Upload media if present
      else if (selectedFile || audioBlob) {
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
            description: "Stories require media content",
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
    setStoryText("");
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

  const storyContentTypes = [
    { id: "media", icon: Image, label: "Photo/Video" },
    { id: "text", icon: Type, label: "Text" },
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
              {/* Content Type Selector for Posts */}
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

              {/* Content Type Selector for Stories */}
              {uploadType === "story" && (
                <div className="flex gap-2">
                  {storyContentTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setStoryContentType(type.id as StoryContentType);
                        clearSelection();
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 transition-all",
                        storyContentType === type.id
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

              {/* Text Content for Posts */}
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

              {/* Text Story with Background */}
              {uploadType === "story" && storyContentType === "text" && (
                <div className="space-y-4">
                  {/* Background Preview */}
                  <div
                    className="relative aspect-[9/16] max-h-80 mx-auto rounded-xl overflow-hidden flex items-center justify-center p-6"
                    style={{ background: selectedBackground }}
                  >
                    <p className="text-white text-center text-xl font-bold leading-relaxed break-words">
                      {storyText || "Your text here..."}
                    </p>
                  </div>

                  {/* Text Input */}
                  <Textarea
                    placeholder="Write your story text..."
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    className="min-h-24 resize-none input-field"
                    maxLength={500}
                  />
                  <div className="flex justify-end text-sm text-muted-foreground">
                    <span>{storyText.length}/500</span>
                  </div>

                  {/* Background Selector */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Choose background</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {STORY_BACKGROUNDS.map((bg, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedBackground(bg)}
                          className={cn(
                            "w-12 h-12 rounded-lg flex-shrink-0 transition-all",
                            selectedBackground === bg
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              : "hover:opacity-80"
                          )}
                          style={{ background: bg }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Media Content for Posts or Stories */}
              {((contentType !== "text" && uploadType === "post") || (uploadType === "story" && storyContentType === "media")) && (
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
                          {uploadType === "story" ? (
                            <Image className="h-8 w-8 text-primary-foreground" />
                          ) : contentType === "video" ? (
                            <Video className="h-8 w-8 text-primary-foreground" />
                          ) : contentType === "audio" ? (
                            <Mic className="h-8 w-8 text-primary-foreground" />
                          ) : (
                            <Image className="h-8 w-8 text-primary-foreground" />
                          )}
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-foreground">
                            {uploadType === "story" ? "Select photo or video" : `Upload ${contentType}`}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {uploadType === "story"
                              ? "JPG, PNG, GIF, MP4, MOV (max 50MB)"
                              : contentType === "video"
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
                        {selectedFile?.type.startsWith("video/") ? (
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

                      {/* Caption for posts only */}
                      {uploadType === "post" && (
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
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={
                  isUploading || 
                  (uploadType === "post" && contentType === "text" && !textContent.trim()) ||
                  (uploadType === "post" && contentType !== "text" && !preview) ||
                  (uploadType === "story" && storyContentType === "text" && !storyText.trim()) ||
                  (uploadType === "story" && storyContentType === "media" && !preview)
                }
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
