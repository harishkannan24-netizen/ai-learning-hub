import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, Paperclip, X, FileText, Pencil, Mic, MicOff } from "lucide-react";
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [recording, setRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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

      // Handle audio files
      const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.aac'];
      if (audioExts.includes(ext)) {
        setUploadedFile({
          name: file.name,
          content: `[AUDIO_FILE: ${file.name}]\nType: ${file.type || ext}\nSize: ${(file.size / 1024).toFixed(1)} KB\n\nThe user uploaded an audio file. Please acknowledge it and respond based on any context the user provides.`,
        });
      } else if (textExtensions.includes(ext)) {
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

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
        setUploadedFile({
          name: file.name,
          content: `[VOICE_RECORDING: ${file.name}]\nSize: ${(file.size / 1024).toFixed(1)} KB\n\nThe user recorded a voice message. Please acknowledge it and respond based on any text context provided.`,
        });
        toast({ title: "Recording saved", description: "Voice recording attached" });
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
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

  const streamMessage = async (allMessages: Message[], displayInput: string) => {
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
        body: JSON.stringify({ messages: allMessages, systemPrompt }),
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
        await saveToHistory(displayInput || "Message", assistantSoFar);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      if (err.message?.includes("Rate limit") || err.message?.includes("429")) {
        toast({ title: "Rate Limited", description: "Please wait a moment.", variant: "destructive" });
      } else if (err.message?.includes("402") || err.message?.includes("credits")) {
        toast({ title: "Credits Exhausted", description: "Please add funds.", variant: "destructive" });
      }
      setMessages(prev => [...prev, { role: "assistant", content: err.message || "Sorry, something went wrong." }]);
    } finally {
      setLoading(false);
    }
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
    const displayInput = input.trim() || "File upload";
    setInput("");
    setUploadedFile(null);
    await streamMessage(newMessages, displayInput);
  };

  const editAndResend = async (index: number) => {
    if (!editText.trim() || loading) return;
    const truncated = messages.slice(0, index);
    const editedMsg: Message = { role: "user", content: editText.trim() };
    const newMessages = [...truncated, editedMsg];
    setMessages(newMessages);
    setEditingIndex(null);
    setEditText("");
    await streamMessage(newMessages, editText.trim());
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
                  ) : editingIndex === i ? (
                    <div className="space-y-2">
                      <textarea
                        className="w-full bg-primary-foreground/10 text-primary-foreground rounded-lg p-2 text-sm resize-none border-0 focus:outline-none focus:ring-1 focus:ring-primary-foreground/30"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setEditingIndex(null)}>Cancel</Button>
                        <Button size="sm" className="h-7 text-xs bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0" onClick={() => editAndResend(i)}>Resend</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="group/msg relative">
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <button
                        onClick={() => { setEditingIndex(i); setEditText(msg.content); }}
                        className="absolute -bottom-2 -right-2 opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-md bg-primary-foreground/20 hover:bg-primary-foreground/30"
                        title="Edit & resend"
                      >
                        <Pencil className="w-3 h-3 text-primary-foreground" />
                      </button>
                    </div>
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
              accept=".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.txt,.md,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.html,.css,.json,.xml,.zip,.rar,.mp3,.mp4,.wav,.m4a,.ogg,.webm,.aac,.png,.jpg,.jpeg,.gif,.webp,.svg"
              onChange={handleFileUpload}
            />
            <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading || loading} className="shrink-0">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
            </Button>
            <Button
              type="button"
              variant={recording ? "destructive" : "outline"}
              size="icon"
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              className="shrink-0"
            >
              {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
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
