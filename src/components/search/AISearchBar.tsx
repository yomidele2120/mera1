import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AISearchBarProps {
  className?: string;
}

export const AISearchBar = ({ className }: AISearchBarProps) => {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={`relative ${className ?? ""}`}>
      <div className="flex gap-2">
        {/* Gradient-bordered AI input — permanent glow signals AI entry point */}
        <div
          className={`relative flex-1 rounded-xl transition-shadow duration-300 ${
            focused ? "gradient-glow" : ""
          }`}
        >
          {/* Gradient border */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl p-[1.5px]"
            style={{
              background: "var(--gradient-primary)",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
          <div className="relative rounded-[10px] bg-card">
            <Sparkles
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ stroke: "url(#ai-search-grad)" }}
            />
            <Input
              type="text"
              placeholder="Ask AI anything…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="pl-10 pr-4 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={!query.trim()}
          className="gradient-primary text-primary-foreground border-0 disabled:opacity-40"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Shared SVG gradient for stroked sparkles icon */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="ai-search-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(15, 95%, 55%)" />
            <stop offset="55%" stopColor="hsl(28, 100%, 58%)" />
            <stop offset="100%" stopColor="hsl(42, 100%, 60%)" />
          </linearGradient>
        </defs>
      </svg>
    </form>
  );
};
