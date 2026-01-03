import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Image, X, Sparkles, Send } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CreatePage = () => {
  const [searchParams] = useSearchParams();
  const defaultType = searchParams.get("type") === "story" ? "story" : "post";
  
  const [type, setType] = useState<"post" | "story">(defaultType);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        toast({
          title: "Invalid file type",
          description: "Please select an image or video file",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
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

  const handleSubmit = async () => {
    if (!selectedFile || !user) return;

    setIsUploading(true);

    try {
      // Upload to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(fileName);

      const mediaUrl = urlData.publicUrl;

      if (type === "post") {
        const { error: insertError } = await supabase.from("posts").insert({
          user_id: user.id,
          caption,
          media_url: mediaUrl,
        });

        if (insertError) throw insertError;

        toast({
          title: "Post created!",
          description: "Your post has been shared",
        });
      } else {
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
    setCaption("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <MainLayout>
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Create</h1>

        <Tabs value={type} onValueChange={(v) => setType(v as "post" | "story")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="post">Post</TabsTrigger>
            <TabsTrigger value="story">Story</TabsTrigger>
          </TabsList>

          <TabsContent value={type} className="mt-0">
            <div className="card-base p-6">
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
                    <p className="font-semibold text-foreground">
                      Select {type === "post" ? "photo" : "story"} to upload
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      JPG, PNG, GIF or MP4 (max 10MB)
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                    {selectedFile?.type.startsWith("video/") ? (
                      <video
                        src={preview}
                        className="h-full w-full object-cover"
                        controls
                      />
                    ) : (
                      <img
                        src={preview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <button
                      onClick={clearSelection}
                      className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {type === "post" && (
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

                  <Button
                    onClick={handleSubmit}
                    disabled={isUploading}
                    className="btn-primary w-full h-12"
                  >
                    {isUploading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Share {type === "post" ? "Post" : "Story"}
                      </>
                    )}
                  </Button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default CreatePage;
