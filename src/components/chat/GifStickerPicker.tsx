import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Smile, Image as ImageIcon, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface GifStickerPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string, type: "gif" | "sticker") => void;
}

// Popular GIF categories for suggestions
const GIF_CATEGORIES = ["trending", "happy", "sad", "love", "funny", "reaction", "celebration"];

// Sticker sets (emoji-based stickers)
const STICKER_SETS = [
  { emoji: "😀", name: "happy" },
  { emoji: "😂", name: "laughing" },
  { emoji: "😍", name: "love" },
  { emoji: "😢", name: "sad" },
  { emoji: "😡", name: "angry" },
  { emoji: "🎉", name: "party" },
  { emoji: "👍", name: "thumbs-up" },
  { emoji: "👋", name: "wave" },
  { emoji: "❤️", name: "heart" },
  { emoji: "🔥", name: "fire" },
  { emoji: "✨", name: "sparkles" },
  { emoji: "🙏", name: "pray" },
  { emoji: "😎", name: "cool" },
  { emoji: "🤔", name: "thinking" },
  { emoji: "😴", name: "sleeping" },
  { emoji: "🥳", name: "celebrating" },
];

export const GifStickerPicker = ({ open, onClose, onSelect }: GifStickerPickerProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [gifs, setGifs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("trending");

  // Fetch GIFs from Tenor API (using a free endpoint)
  const fetchGifs = async (query: string) => {
    setLoading(true);
    try {
      // Using GIPHY's public beta key for demo purposes
      const apiKey = "dc6zaTOxFJmzC"; // Public beta key
      const url = query
        ? `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=20&rating=g`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`;

      const response = await fetch(url);
      const data = await response.json();
      
      const gifUrls = data.data?.map((gif: any) => gif.images.fixed_height.url) || [];
      setGifs(gifUrls);
    } catch (error) {
      console.error("Error fetching GIFs:", error);
      setGifs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchGifs(selectedCategory === "trending" ? "" : selectedCategory);
    }
  }, [open, selectedCategory]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      fetchGifs(searchQuery);
    }
  };

  const handleStickerSelect = (emoji: string) => {
    // Create a sticker-style image URL using emoji
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "80px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, 64, 64);
    }
    const dataUrl = canvas.toDataURL();
    onSelect(dataUrl, "sticker");
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
      >
        <div className="flex items-center justify-between p-2 border-b border-border">
          <span className="text-sm font-medium">GIFs & Stickers</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="gifs" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gifs" className="flex items-center gap-1">
              <ImageIcon className="h-4 w-4" />
              GIFs
            </TabsTrigger>
            <TabsTrigger value="stickers" className="flex items-center gap-1">
              <Smile className="h-4 w-4" />
              Stickers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gifs" className="m-0">
            <form onSubmit={handleSearch} className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search GIFs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </form>

            <div className="flex gap-1 px-2 pb-2 overflow-x-auto">
              {GIF_CATEGORIES.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  className="flex-shrink-0 text-xs"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSearchQuery("");
                  }}
                >
                  {cat}
                </Button>
              ))}
            </div>

            <ScrollArea className="h-48">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 p-2">
                  {gifs.map((gif, index) => (
                    <motion.img
                      key={index}
                      src={gif}
                      alt="GIF"
                      className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => {
                        onSelect(gif, "gif");
                        onClose();
                      }}
                      whileHover={{ scale: 1.05 }}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="stickers" className="m-0">
            <ScrollArea className="h-64">
              <div className="grid grid-cols-4 gap-2 p-4">
                {STICKER_SETS.map((sticker) => (
                  <motion.button
                    key={sticker.name}
                    className="text-4xl p-2 rounded-lg hover:bg-muted transition-colors"
                    onClick={() => handleStickerSelect(sticker.emoji)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {sticker.emoji}
                  </motion.button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AnimatePresence>
  );
};
