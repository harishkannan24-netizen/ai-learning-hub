import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, Paperclip, X, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ChatHistorySidebar from "./ChatHistorySidebar";

type Message = { role: "user" | "assistant"; content: string };

interface ChatInterfaceProps {
  systemPrompt: string;
  placeholder?: string;
  functionName?: string;
  moduleName?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ChatInterface = ({
  systemPrompt,
  placeholder = "Type your message...",
  functionName = "chat",
  moduleName = "general",
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLoadChat = useCallback((query: string, response: string) => {
    setMessages([
      { role: "user", content: query },
      { role: "assistant", content: response },
    ]);
    setHistoryOpen(false);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max file size is 20MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const textExtensions = ['.txt', '.md', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.html', '.css', '.json', '.csv', '.xml'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (textExtensions.includes(ext)) {
        const text = await file.text();
        setUploadedFile({ name: file.name, content: text.slice(0, 50000) });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('uploads').upload(filePath, file);
        if (uploadError) throw uploadError;
        setUploadedFile({
          name: file.name,
          content: `[FILE_UPLOADED: ${file.name}]\nFile Type: ${file.type || ext}\nFile Size: ${(file.size / 1024).toFixed(1)} KB\nStorage Path: ${filePath}\n\nThe user has uploaded this file. Please analyze based on the filename and context provided by the user.`
        });
      }
      toast({ title: "File loaded", description: `${file.name} ready to analyze` });
    } catch {
      toast({ title: "Error reading file", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveToHistory = async (query: string, response: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("chat_history").insert({
        user_id: user.id, module_name: moduleName,
        search_query: query, ai_response: response,
      });
    } catch (err) { console.error("Failed to save history:", err); }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !uploadedFile) || loading) return;
    let userContent = input.trim();
    if (uploadedFile) {
      userContent = `${userContent ? userContent + "\n\n" : ""}[Uploaded file: ${uploadedFile.name}]\n\n${uploadedFile.content}`;
    }
    const userMsg: Message = { role: "user", content: userContent };
    const displayMsg: Message = {
      role: "user",
      content: uploadedFile ? `${input.trim() ? input.trim() + "\n\n" : ""}📎 ${uploadedFile.name}` : input.trim(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(prev => [...prev, displayMsg]);
    setInput("");
    setUploadedFile(null);
    setLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: newMessages, systemPrompt }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      if (assistantSoFar) {
        await saveToHistory(input.trim() || "File upload", assistantSoFar);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      const errorMsg = err.message || "Sorry, something went wrong.";
      if (err.message?.includes("Rate limit") || err.message?.includes("429")) {
        toast({ title: "Rate Limited", description: "Please wait a moment.", variant: "destructive" });
      } else if (err.message?.includes("402") || err.message?.includes("credits")) {
        toast({ title: "Credits Exhausted", description: "Please add funds.", variant: "destructive" });
      }
      setMessages(prev => [...prev, { role: "assistant", content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full relative">
      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-lg font-medium font-display">Start a conversation</p>
                <p className="text-sm">{placeholder}</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0 mt-1">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert
                      prose-headings:font-display prose-headings:text-foreground prose-headings:mt-4 prose-headings:mb-2
                      prose-p:text-secondary-foreground prose-p:leading-relaxed prose-p:my-2
                      prose-li:text-secondary-foreground prose-li:my-0.5
                      prose-strong:text-foreground
                      prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono prose-code:text-primary
                      prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:p-4 prose-pre:my-3 prose-pre:overflow-x-auto
                      prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4
                      prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:rounded-r-lg prose-blockquote:py-1 prose-blockquote:px-4
                      prose-hr:border-border prose-hr:my-4
                      prose-table:border prose-table:border-border prose-th:bg-muted prose-th:p-2 prose-td:p-2 prose-td:border prose-td:border-border">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && !messages.find((m, i) => i === messages.length - 1 && m.role === "assistant") && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="chat-bubble-ai">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {uploadedFile && (
          <div className="border-t bg-secondary/50 px-4 py-2">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm text-foreground truncate flex-1">{uploadedFile.name}</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setUploadedFile(null)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        <div className="border-t bg-card p-4">
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 max-w-3xl mx-auto">
            <input
              type="file" ref={fileInputRef} className="hidden"
              accept=".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.txt,.md,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.html,.css,.json,.xml,.zip,.rar,.mp3,.mp4,.wav,.png,.jpg,.jpeg,.gif,.webp,.svg,.ico,.woff,.woff2,.ttf,.otf,.eot"
              onChange={handleFileUpload}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading || loading} className="shrink-0">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder} disabled={loading} className="flex-1" />
            <Button type="submit" disabled={loading || (!input.trim() && !uploadedFile)} className="gradient-primary border-0">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      <ChatHistorySidebar
        moduleName={moduleName}
        onLoadChat={handleLoadChat}
        isOpen={historyOpen}
        onToggle={() => setHistoryOpen(!historyOpen)}
      />
    </div>
  );
};

export default ChatInterface;
