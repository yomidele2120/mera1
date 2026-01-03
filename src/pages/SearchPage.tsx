import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { UserAvatar } from "@/components/common/Avatar";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";

interface SearchUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  user_number: number | null;
}

const SearchPage = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (query.trim().length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        // Check if query is a number (user ID search)
        const isNumericQuery = /^\d+$/.test(query.replace(/-/g, ""));
        
        let data;
        let error;
        
        if (isNumericQuery) {
          // Search by user number
          const numericQuery = parseInt(query.replace(/-/g, ""), 10);
          ({ data, error } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, bio, user_number")
            .eq("user_number", numericQuery)
            .limit(20));
        } else {
          // Search by username
          ({ data, error } = await supabase
            .from("profiles")
            .select("id, username, avatar_url, bio, user_number")
            .ilike("username", `%${query}%`)
            .limit(20));
        }

        if (error) throw error;
        setResults((data as SearchUser[]) || []);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  return (
    <MainLayout>
      <div className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold text-foreground mb-6">Search</h1>

        {/* Search Input */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by username or ID number..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-10 input-field"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : query.length < 2 ? (
          <div className="card-base p-8 text-center">
            <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Search by username or user ID number
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="card-base p-8 text-center">
            <p className="text-muted-foreground">
              No users found for "{query}"
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/user/${user.username}`}
                  className="card-base p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <UserAvatar
                    src={user.avatar_url}
                    fallback={user.username}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{user.username}</p>
                    {user.user_number && (
                      <p className="text-xs text-muted-foreground font-mono">
                        ID: {user.user_number.toString().replace(/(\d{3})(\d{3})(\d{3})/, "$1-$2-$3")}
                      </p>
                    )}
                    {user.bio && (
                      <p className="text-sm text-muted-foreground truncate">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default SearchPage;
