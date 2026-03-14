import { useState, useRef } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Map, Send, Loader2, Paperclip, FileText, X, Download,
  BookOpen, Code2, Rocket, Target, CheckCircle2, Star, Zap, Brain,
} from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const phaseIcons = [Target, BookOpen, Code2, Brain, Rocket, Star, Zap, CheckCircle2];
const phaseColors = [
  "from-blue-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-amber-500",
  "from-pink-500 to-rose-500",
  "from-indigo-500 to-blue-500",
  "from-fuchsia-500 to-pink-500",
  "from-sky-500 to-blue-500",
];

type Phase = { title: string; description: string; topics: string[]; duration: string };
type RoadmapData = { title: string; phases: Phase[] };

const RoadBuilder = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 20MB", variant: "destructive" });
      return;
    }
    try {
      const textExts = ['.txt', '.md', '.csv', '.json', '.xml', '.js', '.ts', '.py'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (textExts.includes(ext)) {
        const text = await file.text();
        setUploadedFile({ name: file.name, content: text.slice(0, 50000) });
      } else {
        setUploadedFile({ name: file.name, content: `[Uploaded: ${file.name}] — Create a learning roadmap based on this document.` });
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
    const topicText = input.trim();
    setInput("");

    const fileContext = uploadedFile ? `\n\nDocument content (${uploadedFile.name}):\n${uploadedFile.content}` : "";
    setUploadedFile(null);

    const userContent = `Create a detailed learning roadmap for: "${topicText || "the uploaded document"}"${fileContext}

Return ONLY valid JSON with this structure:
{
  "title": "Learning Roadmap: Topic",
  "phases": [
    {
      "title": "Phase 1: Getting Started",
      "description": "Brief description of this phase",
      "topics": ["Topic 1", "Topic 2", "Topic 3"],
      "duration": "2-3 weeks"
    }
  ]
}
Create 5-8 phases covering beginner to advanced. No markdown, no extra text.`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userContent }],
          systemPrompt: "You are a learning roadmap generator. Return ONLY valid JSON. No markdown, no code fences, no extra text.",
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
            if (content) fullContent += content;
          } catch { /* partial */ }
        }
      }

      const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data: RoadmapData = JSON.parse(jsonMatch[0]);
        if (data.phases?.length) {
          setRoadmap(data);
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("chat_history").insert({
              user_id: user.id,
              module_name: "road-builder",
              search_query: topicText || "Roadmap",
              ai_response: JSON.stringify(data),
            });
          }
        } else throw new Error("No phases generated");
      } else throw new Error("Failed to parse roadmap");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadChat = (_query: string, response: string) => {
    try {
      const data = JSON.parse(response);
      if (data.phases) { setRoadmap(data); }
    } catch {
      setInput(_query);
    }
    setHistoryOpen(false);
  };

  const downloadRoadmap = () => {
    if (!roadmap) return;
    const phasesHtml = roadmap.phases.map((p, i) => `
      <div style="display:flex;gap:20px;margin-bottom:24px">
        <div style="display:flex;flex-direction:column;align-items:center;min-width:60px">
          <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px">${i + 1}</div>
          ${i < roadmap.phases.length - 1 ? '<div style="width:2px;flex:1;background:#e5e7eb;margin-top:8px"></div>' : ''}
        </div>
        <div style="flex:1;padding-bottom:16px">
          <h3 style="margin:0 0 4px;font-size:18px;color:#1e293b">${p.title}</h3>
          <p style="margin:0 0 8px;color:#64748b;font-size:13px">⏱ ${p.duration}</p>
          <p style="margin:0 0 10px;color:#475569;font-size:14px">${p.description}</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${p.topics.map(t => `<span style="background:#eff6ff;color:#2563eb;padding:4px 10px;border-radius:20px;font-size:12px">${t}</span>`).join("")}
          </div>
        </div>
      </div>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${roadmap.title}</title>
    <style>body{font-family:'Segoe UI',sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1e293b}
    h1{color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:10px}
    .footer{text-align:center;margin-top:40px;color:#94a3b8;font-size:12px}</style></head>
    <body><h1>🗺️ ${roadmap.title}</h1>${phasesHtml}<div class="footer">Generated by Zyra AI</div></body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${roadmap.title.replace(/\s+/g, "-").slice(0, 30)}-roadmap.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <FeaturePageLayout title="Road Builder" icon={<Map className="w-5 h-5 text-primary-foreground" />} gradient="from-emerald-500 to-teal-500">
      <div className="flex h-full relative">
        <div className="flex-1 flex flex-col">
          {roadmap ? (
            <ScrollArea className="flex-1 p-4 md:p-8">
              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold font-display text-foreground">{roadmap.title}</h2>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={downloadRoadmap}>
                      <Download className="w-3 h-3" /> Download
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRoadmap(null)}>New Roadmap</Button>
                  </div>
                </div>

                <div className="relative">
                  {roadmap.phases.map((phase, i) => {
                    const Icon = phaseIcons[i % phaseIcons.length];
                    const gradient = phaseColors[i % phaseColors.length];
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex gap-4 mb-2"
                      >
                        {/* Timeline */}
                        <div className="flex flex-col items-center">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-md`}>
                            <Icon className="w-6 h-6 text-primary-foreground" />
                          </div>
                          {i < roadmap.phases.length - 1 && (
                            <div className="w-0.5 flex-1 bg-border my-2 min-h-[24px]" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-6">
                          <div className="bg-card border border-border rounded-xl p-4 shadow-card">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="font-semibold font-display text-card-foreground">{phase.title}</h3>
                              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">⏱ {phase.duration}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">{phase.description}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {phase.topics.map((t, ti) => (
                                <span key={ti} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center p-4">
                {loading ? (
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Building your roadmap...</p>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Map className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium font-display">Build visual learning roadmaps</p>
                    <p className="text-sm mt-1">Enter a topic or upload a file to generate a step-by-step path</p>
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
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.txt,.md,.csv,.json,.xml,.doc,.docx" onChange={handleFileUpload} />
                  <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={loading} className="shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="What do you want to learn? e.g., 'React.js' or 'Machine Learning'" disabled={loading} className="flex-1" />
                  <Button type="submit" disabled={loading || (!input.trim() && !uploadedFile)} className="gradient-primary border-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>

        <ChatHistorySidebar
          moduleName="road-builder"
          onLoadChat={handleLoadChat}
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      </div>
    </FeaturePageLayout>
  );
};

export default RoadBuilder;
