import { useState, useRef, useCallback } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Headphones, Upload, Loader2, Play, Pause, Square, FileText, X,
  Volume2, Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const PDFtoAudio = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [audioText, setAudioText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);
  const [voiceIdx, setVoiceIdx] = useState("0");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { toast } = useToast();

  const voices = typeof window !== "undefined" ? window.speechSynthesis?.getVoices() || [] : [];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 20MB", variant: "destructive" });
      return;
    }
    try {
      const textExts = ['.txt', '.md', '.csv', '.json', '.xml', '.js', '.ts', '.py', '.java', '.html', '.css'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (textExts.includes(ext)) {
        const text = await file.text();
        setUploadedFile({ name: file.name, content: text.slice(0, 50000) });
      } else {
        setUploadedFile({ name: file.name, content: `[Uploaded: ${file.name}] — Convert this document to a clear audio narration script.` });
      }
      toast({ title: "File loaded", description: `${file.name} ready` });
    } catch {
      toast({ title: "Error reading file", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generate = async () => {
    if ((!input.trim() && !uploadedFile) || loading) return;
    setLoading(true);
    stopSpeech();
    const topicText = input.trim();
    setInput("");

    const fileContext = uploadedFile ? `\n\nDocument (${uploadedFile.name}):\n${uploadedFile.content}` : "";
    setUploadedFile(null);

    const userContent = `Convert the following into a clear, well-structured narration script suitable for audio listening. 
Make it engaging and easy to follow when listened to. Use natural transitions between sections. 
Do NOT use markdown, bullet points, or formatting — write it as flowing paragraphs that sound natural when read aloud.

Topic/Content: ${topicText || "the uploaded document"}${fileContext}`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userContent }],
          systemPrompt: "You are an audio script writer. Convert content into clear, engaging narration suitable for text-to-speech. Write in flowing paragraphs without any markdown formatting.",
        }),
      });

      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, idx);
          textBuffer = textBuffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setAudioText(fullContent);
            }
          } catch { /* partial */ }
        }
      }

      if (fullContent) {
        setAudioText(fullContent);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("chat_history").insert({
            user_id: user.id,
            module_name: "pdf-to-audio",
            search_query: topicText || "Audio conversion",
            ai_response: fullContent,
          });
        }
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const playSpeech = useCallback(() => {
    if (!audioText) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      setSpeaking(true);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(audioText);
    utterance.rate = rate;
    const availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices[parseInt(voiceIdx)]) {
      utterance.voice = availableVoices[parseInt(voiceIdx)];
    }
    utterance.onend = () => { setSpeaking(false); setPaused(false); };
    utterance.onerror = () => { setSpeaking(false); setPaused(false); };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
    setPaused(false);
  }, [audioText, rate, voiceIdx, paused]);

  const pauseSpeech = () => {
    window.speechSynthesis.pause();
    setPaused(true);
    setSpeaking(false);
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  const handleLoadChat = (_query: string, response: string) => {
    setAudioText(response);
    setHistoryOpen(false);
  };

  return (
    <FeaturePageLayout title="PDF to Audio" icon={<Headphones className="w-5 h-5 text-primary-foreground" />} gradient="from-teal-500 to-cyan-500">
      <div className="flex h-full relative">
        <div className="flex-1 flex flex-col">
          {audioText ? (
            <div className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 p-4 md:p-8">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold font-display text-foreground">Audio Script</h2>
                    <Button variant="ghost" size="sm" onClick={() => { setAudioText(""); stopSpeech(); }}>New</Button>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-6 shadow-card">
                    <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">{audioText}</p>
                  </div>
                </div>
              </ScrollArea>

              {/* Audio controls */}
              <div className="border-t bg-card p-4">
                <div className="max-w-3xl mx-auto space-y-3">
                  <div className="flex items-center gap-3">
                    {!speaking && !paused ? (
                      <Button onClick={playSpeech} className="gradient-primary border-0 gap-2">
                        <Play className="w-4 h-4" /> Play Audio
                      </Button>
                    ) : speaking ? (
                      <Button onClick={pauseSpeech} variant="outline" className="gap-2">
                        <Pause className="w-4 h-4" /> Pause
                      </Button>
                    ) : (
                      <Button onClick={playSpeech} className="gradient-primary border-0 gap-2">
                        <Play className="w-4 h-4" /> Resume
                      </Button>
                    )}
                    {(speaking || paused) && (
                      <Button onClick={stopSpeech} variant="outline" size="icon">
                        <Square className="w-4 h-4" />
                      </Button>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                      <Volume2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Speed: {rate}x</span>
                      <Slider
                        value={[rate]}
                        onValueChange={([v]) => setRate(v)}
                        min={0.5}
                        max={2}
                        step={0.25}
                        className="w-24"
                      />
                    </div>

                    {voices.length > 0 && (
                      <Select value={voiceIdx} onValueChange={setVoiceIdx}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.slice(0, 10).map((v, i) => (
                            <SelectItem key={i} value={String(i)}>{v.name.slice(0, 25)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center p-4">
                {loading ? (
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Converting to audio script...</p>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Headphones className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium font-display">Convert PDFs & text to audio</p>
                    <p className="text-sm mt-1">Upload a document or enter text to listen to</p>
                  </div>
                )}
              </div>

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
                <form onSubmit={(e) => { e.preventDefault(); generate(); }} className="flex gap-2 max-w-3xl mx-auto">
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.ppt,.pptx" onChange={handleFileUpload} />
                  <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={loading} className="shrink-0">
                    <Upload className="w-4 h-4" />
                  </Button>
                  <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter text or topic to convert to audio..." disabled={loading} className="flex-1" />
                  <Button type="submit" disabled={loading || (!input.trim() && !uploadedFile)} className="gradient-primary border-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>

        <ChatHistorySidebar
          moduleName="pdf-to-audio"
          onLoadChat={handleLoadChat}
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      </div>
    </FeaturePageLayout>
  );
};

export default PDFtoAudio;
