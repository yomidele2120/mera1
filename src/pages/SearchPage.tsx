import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, Sparkles, User, ArrowLeft, Loader2, X } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StickyHeader } from "@/components/common/StickyHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/common/Avatar";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserNumber } from "@/components/user/UserNumber";

interface SearchUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  user_number: number | null;
}

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const { toast } = useToast();

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState(initialQuery ? "ai" : "users");
  
  // AI Search state
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState("");

  // User search state
  const [userResults, setUserResults] = useState<SearchUser[]>([]);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    if (initialQuery && activeTab === "ai") {
      performAISearch(initialQuery);
    }
  }, []);

  const performAISearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    setAiLoading(true);
    setSearchedQuery(searchQuery);
    setAiResponse("");

    try {
      const { data, error } = await supabase.functions.invoke("ai-search", {
        body: { query: searchQuery },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setAiResponse(data.response);
    } catch (error: any) {
      console.error("AI search error:", error);
      toast({
        title: "Search failed",
        description: error.message || "Could not complete AI search",
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const searchUsers = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setUserResults([]);
      return;
    }

    setUserLoading(true);
    try {
      const isNumeric = /^\d+$/.test(searchQuery.replace(/-/g, ""));
      
      let dbQuery = supabase.from("profiles").select("id, username, avatar_url, bio, user_number");
      
      if (isNumeric) {
        dbQuery = dbQuery.eq("user_number", parseInt(searchQuery.replace(/-/g, "")));
      } else {
        dbQuery = dbQuery.ilike("username", `%${searchQuery}%`);
      }

      const { data, error } = await dbQuery.limit(20);

      if (error) throw error;
      setUserResults(data || []);
    } catch (error) {
      console.error("User search error:", error);
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users") {
      const timer = setTimeout(() => searchUsers(query), 300);
      return () => clearTimeout(timer);
    }
  }, [query, activeTab]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "ai") {
      performAISearch(query);
    }
  };

  const formatAIResponse = (text: string) => {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("# ")) {
        return <h1 key={i} className="text-xl font-bold mt-4 mb-2 text-foreground">{line.slice(2)}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-lg font-semibold mt-3 mb-2 text-foreground">{line.slice(3)}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={i} className="text-base font-semibold mt-2 mb-1 text-foreground">{line.slice(4)}</h3>;
      }
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return <li key={i} className="ml-4 list-disc text-foreground">{line.slice(2)}</li>;
      }
      if (line.match(/^\d+\. /)) {
        return <li key={i} className="ml-4 list-decimal text-foreground">{line.replace(/^\d+\. /, "")}</li>;
      }
      if (line.trim() === "") {
        return <br key={i} />;
      }
      return <p key={i} className="mb-2 text-foreground">{line}</p>;
    });
  };

  return (
    <MainLayout>
      <div className="-mx-4 md:mx-0">
        <StickyHeader title="Search" />

        <div className="px-4 pt-4 space-y-4">
          <form onSubmit={handleSearch}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={activeTab === "ai" ? "Ask AI anything..." : "Search users..."}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button type="submit" disabled={!query.trim() || (activeTab === "ai" && aiLoading)}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
        </form>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Search
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-4">
            {aiLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-muted-foreground">Searching...</p>
              </div>
            ) : aiResponse ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-6"
              >
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">AI Response</span>
                  <span className="text-sm text-muted-foreground ml-auto">for "{searchedQuery}"</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {formatAIResponse(aiResponse)}
                </div>
              </motion.div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Ask anything and get AI-powered answers</p>
                <p className="text-sm mt-1">Try "What is React?" or "Explain machine learning"</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="users" className="mt-4 space-y-2">
            {userLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : query.length < 2 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Type at least 2 characters to search users</p>
              </div>
            ) : userResults.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No users found</p>
              </div>
            ) : (
              userResults.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Link
                    to={`/user/${user.username}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-accent/50 transition-colors"
                  >
                    <UserAvatar src={user.avatar_url} fallback={user.username} size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">@{user.username}</p>
                      {user.user_number && <UserNumber userNumber={user.user_number} />}
                      {user.bio && (
                        <p className="text-sm text-muted-foreground truncate">{user.bio}</p>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </MainLayout>
  );
};

export default SearchPage;
