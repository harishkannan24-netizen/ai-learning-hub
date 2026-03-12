import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Clock, MessageSquare, ChevronRight, ChevronLeft, Trash2 } from "lucide-react";
import { format } from "date-fns";

type HistoryItem = {
  id: string;
  search_query: string;
  ai_response: string;
  created_at: string;
};

interface ChatHistorySidebarProps {
  moduleName: string;
  onLoadChat: (query: string, response: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const ChatHistorySidebar = ({ moduleName, onLoadChat, isOpen, onToggle }: ChatHistorySidebarProps) => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("chat_history")
        .select("id, search_query, ai_response, created_at")
        .eq("user_id", user.id)
        .eq("module_name", moduleName)
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen, moduleName]);

  const deleteItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("chat_history").delete().eq("id", id);
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-card border border-border hover:bg-secondary transition-colors"
        title={isOpen ? "Close history" : "Open history"}
      >
        {isOpen ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <Clock className="w-4 h-4 text-muted-foreground" />}
      </button>

      {/* Sidebar panel */}
      {isOpen && (
        <div className="w-72 border-l border-border bg-card flex flex-col shrink-0">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold font-display text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Chat History
            </h3>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loading && (
                <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
              )}
              {!loading && history.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No history yet</p>
              )}
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onLoadChat(item.search_query, item.ai_response)}
                  className="w-full text-left p-2.5 rounded-lg hover:bg-secondary/80 transition-colors group"
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {item.search_query.slice(0, 60)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {format(new Date(item.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteItem(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </>
  );
};

export default ChatHistorySidebar;
