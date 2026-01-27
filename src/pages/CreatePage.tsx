import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Image, X, Sparkles, Send, Type, Video, Mic, Minus, Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { StickyHeader } from "@/components/common/StickyHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { PersonaSwitcher, Persona } from "@/components/persona/PersonaSwitcher";
import { usePersonas } from "@/hooks/usePersonas";
type ContentType = "text" | "image" | "video" | "audio";
type UploadType = "post" | "story";
type StoryContentType = "media" | "text";
type BackgroundType = "gradient" | "solid" | "image";

interface FontStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: string;
}

interface MediaFile {
  file: File;
  preview: string;
  type: "image" | "video";
}

const FONT_STYLES: FontStyle[] = [
  { id: "classic", name: "Classic", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontWeight: "bold" },
  { id: "elegant", name: "Elegant", fontFamily: "'Georgia', 'Times New Roman', serif", fontWeight: "normal" },
  { id: "modern", name: "Modern", fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: "300" },
  { id: "playful", name: "Playful", fontFamily: "'Comic Sans MS', 'Chalkboard', cursive", fontWeight: "bold" },
  { id: "typewriter", name: "Typewriter", fontFamily: "'Courier New', 'Courier', monospace", fontWeight: "normal" },
  { id: "bold", name: "Bold", fontFamily: "'Impact', 'Haettenschweiler', sans-serif", fontWeight: "bold" },
];

const GRADIENT_BACKGROUNDS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  "linear-gradient(135deg, #fc5c7d 0%, #6a82fb 100%)",
  "linear-gradient(135deg, #f12711 0%, #f5af19 100%)",
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  "linear-gradient(135deg, #232526 0%, #414345 100%)",
  "linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
  "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)",
  "linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)",
];

const SOLID_BACKGROUNDS = [
  "#1a1a2e", "#16213e", "#0f3460", "#e94560",
  "#000000", "#ffffff", "#ff6b6b", "#4ecdc4",
  "#45b7d1", "#96ceb4", "#ffeaa7", "#dfe6e9",
  "#6c5ce7", "#a29bfe", "#fd79a8", "#00b894",
  "#e17055", "#74b9ff", "#55efc4", "#fab1a0",
];

const IMAGE_BACKGROUNDS = [
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=800&q=80",
  "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=800&q=80",
  "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800&q=80",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&q=80",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
  "https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=800&q=80",
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800&q=80",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80",
];

const CreatePage = () => {
  const [searchParams] = useSearchParams();
  const defaultType = searchParams.get("type") === "story" ? "story" : "post";
  
  const [uploadType, setUploadType] = useState<UploadType>(defaultType);
  const [contentType, setContentType] = useState<ContentType>("image");
  const [storyContentType, setStoryContentType] = useState<StoryContentType>("media");
  
  // Multi-media support for posts
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  
  // Single file for stories
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  const [textContent, setTextContent] = useState("");
  const [storyText, setStoryText] = useState("");
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("gradient");
  const [selectedBackground, setSelectedBackground] = useState(GRADIENT_BACKGROUNDS[0]);
  const [selectedFont, setSelectedFont] = useState<FontStyle>(FONT_STYLES[0]);
  const [fontSize, setFontSize] = useState(56);
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
  const { personas, activePersona, selectPersona, createPersona } = usePersonas();

  const handleMultiFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newMediaFiles: MediaFile[] = [];
    let validFiles = true;

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");

      if (!isImage && !isVideo) {
        toast({
          title: "Invalid file type",
          description: "Please select only image or video files",
          variant: "destructive",
        });
        validFiles = false;
        break;
      }

      // Validate file size
      const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} is too large. Max size is ${isVideo ? "50MB" : "10MB"}`,
          variant: "destructive",
        });
        validFiles = false;
        break;
      }

      newMediaFiles.push({
        file,
        preview: URL.createObjectURL(file),
        type: isVideo ? "video" : "image",
      });
    }

    if (validFiles && newMediaFiles.length > 0) {
      // Limit to 10 files max
      const totalFiles = [...mediaFiles, ...newMediaFiles].slice(0, 10);
      setMediaFiles(totalFiles);
      
      if (totalFiles.length >= 10) {
        toast({
          title: "Maximum files reached",
          description: "You can upload up to 10 media files per post",
        });
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSingleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const isAudio = file.type.startsWith("audio/");

    // For stories
    if (uploadType === "story") {
      if (!isImage && !isVideo) {
        toast({
          title: "Invalid file type",
          description: "Please select an image or video file",
          variant: "destructive",
        });
        return;
      }
    } else if (contentType === "audio") {
      if (!isAudio) {
        toast({
          title: "Invalid file type",
          description: "Please select an audio file",
          variant: "destructive",
        });
        return;
      }
    }

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
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
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
    return new Promise(async (resolve, reject) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Handle different background types
      if (backgroundType === "image") {
        try {
          const img = new window.Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((imgResolve, imgReject) => {
            img.onload = () => imgResolve();
            img.onerror = () => imgReject(new Error("Failed to load background image"));
            img.src = selectedBackground;
          });
          
          const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
          const x = (canvas.width - img.width * scale) / 2;
          const y = (canvas.height - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } catch (error) {
          ctx.fillStyle = "#1a1a2e";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      } else if (backgroundType === "solid") {
        ctx.fillStyle = selectedBackground;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
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
      }

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      const maxWidth = canvas.width - 120;
      const scaledFontSize = fontSize * 1.5;
      const lineHeight = scaledFontSize * 1.3;
      ctx.font = `${selectedFont.fontWeight} ${scaledFontSize}px ${selectedFont.fontFamily}`;

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

    // Validation
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

    // For image/video posts, check if we have media files
    if ((contentType === "image" || contentType === "video") && uploadType === "post" && mediaFiles.length === 0) {
      toast({
        title: "Media required",
        description: "Please select at least one image or video",
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
      let mediaUrls: string[] = [];

      // Handle text story
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
      // Handle multi-media posts
      else if (uploadType === "post" && (contentType === "image" || contentType === "video") && mediaFiles.length > 0) {
        for (const mediaFile of mediaFiles) {
          const ext = mediaFile.file.name.split(".").pop();
          const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
          
          const { error: uploadError } = await supabase.storage
            .from("media")
            .upload(fileName, mediaFile.file);

          if (uploadError) throw uploadError;

          const { data: urlData } = supabase.storage
            .from("media")
            .getPublicUrl(fileName);

          mediaUrls.push(urlData.publicUrl);
        }
        
        // Set the first URL as media_url for backwards compatibility
        mediaUrl = mediaUrls[0] || "";
      }
      // Handle single file uploads (audio, story media)
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
        const postData: any = {
          user_id: user.id,
          caption: caption || null,
          text_content: contentType === "text" ? textContent : null,
          media_url: mediaUrl || "",
          post_type: contentType,
        };

        // Add media_urls if we have multiple files
        if (mediaUrls.length > 0) {
          postData.media_urls = mediaUrls;
        }

        const { error: insertError } = await supabase.from("posts").insert(postData);

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
    // Clean up object URLs
    mediaFiles.forEach((mf) => URL.revokeObjectURL(mf.preview));
    setMediaFiles([]);
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
    if (uploadType === "story") {
      return "image/*,video/mp4,video/mov,video/webm";
    }
    switch (contentType) {
      case "image": return "image/*,video/mp4,video/mov,video/webm";
      case "video": return "video/mp4,video/mov,video/webm,image/*";
      case "audio": return "audio/mp3,audio/wav,audio/m4a,audio/*";
      default: return "";
    }
  };

  const contentTypes = [
    { id: "text", icon: Type, label: "Text" },
    { id: "image", icon: Image, label: "Media" },
    { id: "audio", icon: Mic, label: "Audio" },
  ] as const;

  const storyContentTypes = [
    { id: "media", icon: Image, label: "Photo/Video" },
    { id: "text", icon: Type, label: "Text" },
  ] as const;

  return (
    <MainLayout>
      <div className="-mx-4 md:mx-0">
        <StickyHeader title="Create" />

        <div className="px-4 pt-4 animate-fade-up">
          {/* Persona Selector */}
          {personas.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Posting as:</span>
              <PersonaSwitcher
                personas={personas}
                activePersona={activePersona}
                onSelectPersona={selectPersona}
                onCreatePersona={createPersona}
              />
            </div>
          )}

          <Tabs value={uploadType} onValueChange={(v) => {
            setUploadType(v as UploadType);
            clearSelection();
          }} className="w-full">
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
                  <div
                    className="relative aspect-[9/16] max-h-80 mx-auto rounded-xl overflow-hidden flex items-center justify-center p-6"
                    style={
                      backgroundType === "image"
                        ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url(${selectedBackground})`, backgroundSize: "cover", backgroundPosition: "center" }
                        : { background: selectedBackground }
                    }
                  >
                    <p 
                      className="text-white text-center leading-relaxed break-words drop-shadow-lg"
                      style={{ 
                        fontFamily: selectedFont.fontFamily, 
                        fontWeight: selectedFont.fontWeight,
                        fontSize: `${fontSize * 0.4}px`
                      }}
                    >
                      {storyText || "Your text here..."}
                    </p>
                  </div>

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

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Font style</p>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {FONT_STYLES.map((font) => (
                        <button
                          key={font.id}
                          onClick={() => setSelectedFont(font)}
                          className={cn(
                            "px-4 py-2 rounded-lg flex-shrink-0 transition-all border-2 text-sm",
                            selectedFont.id === font.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          )}
                          style={{ fontFamily: font.fontFamily, fontWeight: font.fontWeight }}
                        >
                          {font.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">Font size</p>
                      <span className="text-sm text-muted-foreground">{fontSize}px</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setFontSize(Math.max(24, fontSize - 4))}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <Slider
                        value={[fontSize]}
                        onValueChange={(v) => setFontSize(v[0])}
                        min={24}
                        max={96}
                        step={4}
                        className="flex-1"
                      />
                      <button 
                        onClick={() => setFontSize(Math.min(96, fontSize + 4))}
                        className="p-1 rounded hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Background</p>
                    <div className="flex gap-2 mb-3">
                      {(["gradient", "solid", "image"] as BackgroundType[]).map((type) => (
                        <button
                          key={type}
                          onClick={() => {
                            setBackgroundType(type);
                            if (type === "gradient") setSelectedBackground(GRADIENT_BACKGROUNDS[0]);
                            else if (type === "solid") setSelectedBackground(SOLID_BACKGROUNDS[0]);
                            else setSelectedBackground(IMAGE_BACKGROUNDS[0]);
                          }}
                          className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 capitalize",
                            backgroundType === type
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {backgroundType === "gradient" && GRADIENT_BACKGROUNDS.map((bg, index) => (
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
                      {backgroundType === "solid" && SOLID_BACKGROUNDS.map((bg, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedBackground(bg)}
                          className={cn(
                            "w-12 h-12 rounded-lg flex-shrink-0 transition-all border",
                            selectedBackground === bg
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              : "hover:opacity-80",
                            bg === "#ffffff" ? "border-border" : "border-transparent"
                          )}
                          style={{ background: bg }}
                        />
                      ))}
                      {backgroundType === "image" && IMAGE_BACKGROUNDS.map((bg, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedBackground(bg)}
                          className={cn(
                            "w-12 h-12 rounded-lg flex-shrink-0 transition-all bg-cover bg-center",
                            selectedBackground === bg
                              ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                              : "hover:opacity-80"
                          )}
                          style={{ backgroundImage: `url(${bg})` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Multi-Media Content for Posts */}
              {(contentType === "image" || contentType === "video") && uploadType === "post" && (
                <>
                  {mediaFiles.length === 0 ? (
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-4 py-16 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                    >
                      <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center">
                        <Image className="h-8 w-8 text-primary-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">
                          Upload photos or videos
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Select multiple files for a carousel (max 10)
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="space-y-4">
                      {/* Media preview grid */}
                      <div className="grid grid-cols-3 gap-2">
                        {mediaFiles.map((mf, index) => (
                          <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                            {mf.type === "video" ? (
                              <video
                                src={mf.preview}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <img
                                src={mf.preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <button
                              onClick={() => removeMediaFile(index)}
                              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            {mf.type === "video" && (
                              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-background/80 text-xs">
                                <Video className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        ))}
                        
                        {/* Add more button */}
                        {mediaFiles.length < 10 && (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 hover:bg-muted/30 transition-all"
                          >
                            <Plus className="h-6 w-6 text-muted-foreground" />
                          </button>
                        )}
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
                          <span>{mediaFiles.length} file{mediaFiles.length !== 1 ? "s" : ""} selected</span>
                          <span>{caption.length}/2200</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Audio Content for Posts */}
              {contentType === "audio" && uploadType === "post" && (
                <>
                  {!preview ? (
                    <div className="space-y-4">
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

                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center gap-4 py-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                      >
                        <p className="text-sm text-muted-foreground">
                          Or upload an audio file
                        </p>
                      </motion.div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative p-8 flex items-center justify-center bg-muted rounded-xl">
                        <audio src={preview} controls className="w-full" />
                        <button
                          onClick={clearSelection}
                          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-3">
                        <Textarea
                          placeholder="Write a caption..."
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          className="min-h-24 resize-none input-field"
                          maxLength={2200}
                        />
                        <div className="flex justify-end text-sm text-muted-foreground">
                          <span>{caption.length}/2200</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Story Media Content */}
              {uploadType === "story" && storyContentType === "media" && (
                <>
                  {!preview ? (
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-4 py-16 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all"
                    >
                      <div className="h-16 w-16 rounded-full gradient-primary flex items-center justify-center">
                        <Image className="h-8 w-8 text-primary-foreground" />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">Select photo or video</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          JPG, PNG, GIF, MP4, MOV (max 50MB)
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden bg-muted">
                      {selectedFile?.type.startsWith("video/") ? (
                        <video
                          src={preview}
                          className="w-full max-h-96 object-contain"
                          controls
                        />
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
                  )}
                </>
              )}

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={getAcceptType()}
                multiple={uploadType === "post" && (contentType === "image" || contentType === "video")}
                onChange={
                  uploadType === "post" && (contentType === "image" || contentType === "video")
                    ? handleMultiFileSelect
                    : handleSingleFileSelect
                }
                className="hidden"
              />

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={
                  isUploading || 
                  (uploadType === "post" && contentType === "text" && !textContent.trim()) ||
                  (uploadType === "post" && (contentType === "image" || contentType === "video") && mediaFiles.length === 0) ||
                  (uploadType === "post" && contentType === "audio" && !preview) ||
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
          </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreatePage;
