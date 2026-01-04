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
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className={`relative ${className}`}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          <Input
            type="text"
            placeholder="Ask AI anything..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-4 bg-card border-border focus:border-primary"
          />
        </div>
        <Button type="submit" size="icon" disabled={!query.trim()}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};
