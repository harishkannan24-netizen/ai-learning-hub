import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, GraduationCap, Clock, Bot, Code2, HelpCircle, Map, FileText, Brain, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Input } from "@/components/ui/input";

type HistoryItem = {
  id: string;
  module_name: string;
  search_query: string;
  ai_response: string;
  created_at: string;
};

const moduleIcons: Record<string, any> = {
  "ai-tutor": Bot,
  "code-reviewer": Code2,
  "doubt-resolver": HelpCircle,
  "road-builder": Map,
  "notes-generator": FileText,
  "quiz-generator": Brain,
};

const moduleColors: Record<string, string> = {
  "ai-tutor": "from-blue-500 to-cyan-500",
  "code-reviewer": "from-violet-500 to-purple-500",
  "doubt-resolver": "from-orange-500 to-amber-500",
  "road-builder": "from-emerald-500 to-teal-500",
  "notes-generator": "from-pink-500 to-rose-500",
  "quiz-generator": "from-indigo-500 to-blue-500",
};

const SearchHistory = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("chat_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data) setHistory(data as HistoryItem[]);
      setLoading(false);
    };
    fetchHistory();
  }, []);

  const filtered = history.filter((item) => {
    const matchesSearch = !filter || item.search_query.toLowerCase().includes(filter.toLowerCase());
    const matchesModule = !moduleFilter || item.module_name === moduleFilter;
    return matchesSearch && matchesModule;
  });

  const modules = [...new Set(history.map((h) => h.module_name))];

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold font-display text-foreground">Search History</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search your history..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant={moduleFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setModuleFilter(null)}
            >
              All
            </Button>
            {modules.map((mod) => {
              const Icon = moduleIcons[mod] || Clock;
              return (
                <Button
                  key={mod}
                  variant={moduleFilter === mod ? "default" : "outline"}
                  size="sm"
                  onClick={() => setModuleFilter(mod)}
                  className="gap-1.5"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mod.replace("-", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Button>
              );
            })}
          </div>

          {/* History List */}
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-3 pr-4">
              {loading && <p className="text-center text-muted-foreground py-8">Loading history...</p>}
              {!loading && filtered.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No history found</p>
              )}
              {filtered.map((item) => {
                const Icon = moduleIcons[item.module_name] || Clock;
                const gradient = moduleColors[item.module_name] || "from-gray-500 to-gray-600";
                const isExpanded = expanded === item.id;

                return (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-card-hover transition-all border-border"
                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                          <Icon className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-medium text-primary capitalize">
                              {item.module_name.replace("-", " ")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">{item.search_query}</p>
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border">
                              <div className="prose prose-sm max-w-none prose-headings:font-display prose-headings:text-foreground prose-p:text-secondary-foreground prose-li:text-secondary-foreground prose-strong:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4">
                                <ReactMarkdown>{item.ai_response}</ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default SearchHistory;
