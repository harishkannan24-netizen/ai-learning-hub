import { useState, useRef, useEffect, useCallback } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Video, Loader2, Paperclip, FileText, X, Play, Pause,
  SkipForward, SkipBack, RotateCcw,
  Book, Lightbulb, Target, BarChart3, Users, Shield, Rocket,
  Star, Globe, Heart, Code2, Brain, Zap, Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, any> = {
  book: Book, lightbulb: Lightbulb, target: Target, chart: BarChart3,
  users: Users, shield: Shield, rocket: Rocket, star: Star,
  globe: Globe, heart: Heart, code: Code2, brain: Brain, zap: Zap, layers: Layers,
};

const colorMap: Record<string, string> = {
  blue: "from-blue-500 to-blue-700", violet: "from-violet-500 to-purple-700",
  emerald: "from-emerald-500 to-teal-700", orange: "from-orange-500 to-red-600",
  pink: "from-pink-500 to-rose-700", indigo: "from-indigo-500 to-blue-800",
  fuchsia: "from-fuchsia-500 to-pink-700", sky: "from-sky-400 to-blue-600",
  lime: "from-lime-500 to-green-700", red: "from-red-500 to-rose-700",
  cyan: "from-cyan-400 to-teal-600", teal: "from-teal-500 to-emerald-700",
  amber: "from-amber-400 to-orange-600", rose: "from-rose-400 to-pink-600",
};

type Scene = { title: string; narration: string; visual: string; icon: string; bgColor: string };
type VideoData = { title: string; scenes: Scene[] };

const SCENE_DURATION = 5000;

const VideoGenerator = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [currentScene, setCurrentScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const stopPlayback = useCallback(() => {
    setPlaying(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (playing && videoData) {
      timerRef.current = setInterval(() => {
        setCurrentScene(prev => {
          if (prev >= videoData.scenes.length - 1) { stopPlayback(); return prev; }
          return prev + 1;
        });
      }, SCENE_DURATION);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, videoData, stopPlayback]);

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
        setUploadedFile({ name: file.name, content: `[Uploaded: ${file.name}] — Type: ${ext}, Size: ${(file.size / 1024).toFixed(1)}KB. Create an explainer video based on this document.` });
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
    const topic = input.trim();
    setInput("");
    stopPlayback();

    try {
      const body: any = {};
      if (uploadedFile) body.content = `${topic ? topic + "\n\n" : ""}${uploadedFile.content}`;
      else body.topic = topic;
      setUploadedFile(null);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data: VideoData = await resp.json();
      if (data.scenes?.length) {
        setVideoData(data);
        setCurrentScene(0);
        // Save to history
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("chat_history").insert({
            user_id: user.id,
            module_name: "video-generator",
            search_query: topic || uploadedFile?.name || "Video",
            ai_response: JSON.stringify(data),
          });
        }
      } else {
        throw new Error("No scenes generated");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadChat = (_query: string, response: string) => {
    try {
      const data = JSON.parse(response);
      if (data.scenes) { setVideoData(data); setCurrentScene(0); stopPlayback(); }
    } catch {
      setInput(_query);
    }
    setHistoryOpen(false);
  };

  const scene = videoData?.scenes[currentScene];
  const Icon = scene ? (iconMap[scene.icon] || Star) : Star;
  const bgGradient = scene ? (colorMap[scene.bgColor] || colorMap.blue) : colorMap.blue;
  const progress = videoData ? ((currentScene + 1) / videoData.scenes.length) * 100 : 0;

  return (
    <FeaturePageLayout title="Video Generator" icon={<Video className="w-5 h-5 text-primary-foreground" />} gradient="from-red-500 to-orange-500">
      <div className="flex h-full relative">
        <div className="flex-1 flex flex-col">
          {videoData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <p className="text-xs text-muted-foreground text-center mb-1 font-medium">{videoData.title}</p>
              <p className="text-[10px] text-muted-foreground mb-3">Scene {currentScene + 1} of {videoData.scenes.length}</p>

              {/* Video player area */}
              <div className="w-full max-w-3xl aspect-video relative rounded-2xl overflow-hidden shadow-elevated">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentScene}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.5 }}
                    className={`absolute inset-0 bg-gradient-to-br ${bgGradient} flex flex-col items-center justify-center p-8 md:p-12 text-primary-foreground`}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                      className="w-16 h-16 rounded-2xl bg-primary-foreground/20 flex items-center justify-center mb-6"
                    >
                      <Icon className="w-8 h-8" />
                    </motion.div>
                    <motion.h2
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-xl md:text-2xl font-bold font-display text-center mb-4"
                    >
                      {scene?.title}
                    </motion.h2>
                    <motion.p
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-sm md:text-base text-center max-w-lg leading-relaxed opacity-90"
                    >
                      {scene?.narration}
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.6 }}
                      transition={{ delay: 0.7 }}
                      className="text-xs text-center mt-4 italic max-w-md"
                    >
                      🎬 {scene?.visual}
                    </motion.p>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-3xl mt-3">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 mt-4">
                <Button variant="outline" size="icon" onClick={() => { stopPlayback(); setCurrentScene(0); }}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" disabled={currentScene === 0} onClick={() => { stopPlayback(); setCurrentScene(prev => prev - 1); }}>
                  <SkipBack className="w-4 h-4" />
                </Button>
                <Button
                  className="gradient-primary border-0 h-12 w-12 rounded-full"
                  onClick={() => {
                    if (playing) stopPlayback();
                    else { if (currentScene >= videoData.scenes.length - 1) setCurrentScene(0); setPlaying(true); }
                  }}
                >
                  {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </Button>
                <Button variant="outline" size="icon" disabled={currentScene >= videoData.scenes.length - 1} onClick={() => { stopPlayback(); setCurrentScene(prev => prev + 1); }}>
                  <SkipForward className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setVideoData(null); stopPlayback(); }}>
                  New Video
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center p-4">
                {loading ? (
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted-foreground">Creating your video...</p>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium font-display">Create explainer videos</p>
                    <p className="text-sm mt-1">Enter a topic or upload a PDF/document</p>
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
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.txt,.md,.json,.xml" onChange={handleFileUpload} />
                  <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={loading} className="shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Enter a topic or upload a document..." disabled={loading} className="flex-1" />
                  <Button type="submit" disabled={loading || (!input.trim() && !uploadedFile)} className="gradient-primary border-0">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>

        <ChatHistorySidebar
          moduleName="video-generator"
          onLoadChat={handleLoadChat}
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      </div>
    </FeaturePageLayout>
  );
};

export default VideoGenerator;
