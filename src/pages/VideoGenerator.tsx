import { useState, useRef, useEffect, useCallback } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send, Video, Loader2, Paperclip, FileText, X, Play, Pause,
  SkipForward, SkipBack, RotateCcw, Download, ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Scene = {
  title: string;
  narration: string;
  visual: string;
  imagePrompt: string;
  icon: string;
  bgColor: string;
  imageUrl?: string;
};
type VideoData = { title: string; scenes: Scene[] };

const SCENE_DURATION = 6000;

// Six different Ken-Burns motions so consecutive scenes feel cinematic
const motions = [
  { from: { scale: 1, x: 0, y: 0 }, to: { scale: 1.18, x: -3, y: 2 } },
  { from: { scale: 1.15, x: 3, y: -2 }, to: { scale: 1, x: 0, y: 0 } },
  { from: { scale: 1.05, x: -5, y: 0 }, to: { scale: 1.2, x: 5, y: 0 } },
  { from: { scale: 1.2, x: 0, y: -4 }, to: { scale: 1, x: 0, y: 4 } },
  { from: { scale: 1, x: 4, y: 4 }, to: { scale: 1.15, x: -4, y: -4 } },
  { from: { scale: 1.1, x: 0, y: 0 }, to: { scale: 1.25, x: 0, y: 0 } },
];

const VideoGenerator = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [imageTotal, setImageTotal] = useState(0);
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
      const textExts = ['.txt', '.md', '.csv', '.json', '.xml', '.js', '.ts', '.py', '.html', '.css'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (textExts.includes(ext)) {
        const text = await file.text();
        setUploadedFile({ name: file.name, content: text.slice(0, 50000) });
      } else {
        setUploadedFile({ name: file.name, content: `[Uploaded: ${file.name}] — Create an explainer video based on this document.` });
      }
      toast({ title: "File loaded", description: `${file.name} ready` });
    } catch {
      toast({ title: "Error reading file", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generateImageForScene = async (imagePrompt: string): Promise<string | null> => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: `Cinematic high-detail photographic still: ${imagePrompt}. Dramatic lighting, depth of field, no text, no captions, no watermark.`,
          }),
        }
      );
      if (!resp.ok) return null;
      const data = await resp.json();
      const img = data.images?.[0];
      if (typeof img === "string") return img;
      if (img?.image_url?.url) return img.image_url.url;
      if (img?.url) return img.url;
      return null;
    } catch {
      return null;
    }
  };

  const generate = async () => {
    if ((!input.trim() && !uploadedFile) || loading) return;
    setLoading(true);
    const topicText = input.trim();
    setInput("");
    stopPlayback();
    setImageProgress(0);
    setImageTotal(0);

    try {
      const body: any = {};
      if (uploadedFile) body.content = `${topicText ? topicText + "\n\n" : ""}${uploadedFile.content}`;
      else body.topic = topicText;
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
      if (!data.scenes?.length) throw new Error("No scenes generated");

      // Show the video frame immediately (text only), then fill in images
      setVideoData(data);
      setCurrentScene(0);
      setImageTotal(data.scenes.length);

      // Generate images in parallel; update each scene as it arrives
      let done = 0;
      await Promise.all(
        data.scenes.map(async (scene, idx) => {
          const url = await generateImageForScene(scene.imagePrompt || scene.visual);
          done += 1;
          setImageProgress(done);
          if (url) {
            setVideoData(prev => {
              if (!prev) return prev;
              const scenes = [...prev.scenes];
              scenes[idx] = { ...scenes[idx], imageUrl: url };
              return { ...prev, scenes };
            });
          }
        })
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Save with generated image URLs so history reloads with visuals
        setVideoData(prev => {
          if (prev) {
            supabase.from("chat_history").insert({
              user_id: user.id,
              module_name: "video-generator",
              search_query: topicText || "Video",
              ai_response: JSON.stringify(prev),
            });
          }
          return prev;
        });
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

  const downloadVideo = () => {
    if (!videoData) return;
    const scenesHtml = videoData.scenes.map((s, i) => `
      <div class="scene">
        ${s.imageUrl ? `<img src="${s.imageUrl}" alt="" />` : ""}
        <div class="overlay">
          <div class="scene-num">Scene ${i + 1}</div>
          <h2>${s.title}</h2>
          <p>${s.narration}</p>
        </div>
      </div>`).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${videoData.title}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',sans-serif;background:#0a0a0a;color:#fff;padding:40px}
      h1{text-align:center;font-size:32px;margin-bottom:40px}
      .scene{position:relative;border-radius:16px;overflow:hidden;margin-bottom:24px;min-height:480px;background:#1a1a1a}
      .scene img{width:100%;height:100%;position:absolute;inset:0;object-fit:cover;animation:kb 8s ease-in-out infinite alternate}
      .overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.2) 60%,transparent);padding:40px;display:flex;flex-direction:column;justify-content:flex-end}
      .scene-num{font-size:11px;opacity:0.7;letter-spacing:2px;margin-bottom:8px;text-transform:uppercase}
      .scene h2{font-size:24px;margin-bottom:12px}
      .scene p{font-size:15px;line-height:1.7;opacity:0.95;max-width:700px}
      @keyframes kb{0%{transform:scale(1)}100%{transform:scale(1.15)}}
      .footer{text-align:center;margin-top:30px;color:#666;font-size:12px}
    </style></head><body>
    <h1>🎬 ${videoData.title}</h1>${scenesHtml}
    <div class="footer">Generated by Zyra AI</div></body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${videoData.title.replace(/\s+/g, "-").slice(0, 30)}-video.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "Open the HTML file to view the video" });
  };

  const scene = videoData?.scenes[currentScene];
  const motionPreset = motions[currentScene % motions.length];
  const progress = videoData ? ((currentScene + 1) / videoData.scenes.length) * 100 : 0;

  return (
    <FeaturePageLayout title="Video Generator" icon={<Video className="w-5 h-5 text-primary-foreground" />} gradient="from-red-500 to-orange-500">
      <div className="flex h-full relative">
        <div className="flex-1 flex flex-col">
          {videoData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <p className="text-xs text-muted-foreground text-center mb-1 font-medium">{videoData.title}</p>
              <p className="text-[10px] text-muted-foreground mb-3">Scene {currentScene + 1} of {videoData.scenes.length}</p>

              <div className="w-full max-w-3xl aspect-video relative rounded-2xl overflow-hidden shadow-elevated bg-black">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentScene}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0"
                  >
                    {scene?.imageUrl ? (
                      <motion.img
                        src={scene.imageUrl}
                        alt={scene.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        initial={{
                          scale: motionPreset.from.scale,
                          x: `${motionPreset.from.x}%`,
                          y: `${motionPreset.from.y}%`,
                        }}
                        animate={{
                          scale: motionPreset.to.scale,
                          x: `${motionPreset.to.x}%`,
                          y: `${motionPreset.to.y}%`,
                        }}
                        transition={{ duration: SCENE_DURATION / 1000, ease: "linear" }}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center">
                        <div className="text-center text-white/60">
                          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                          <p className="text-xs">Generating image...</p>
                        </div>
                      </div>
                    )}
                    {/* Cinematic overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <motion.div
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                      className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white"
                    >
                      <h2 className="text-xl md:text-3xl font-bold font-display mb-2 drop-shadow-lg">
                        {scene?.title}
                      </h2>
                      <p className="text-sm md:text-base leading-[1.75] opacity-95 max-w-2xl drop-shadow">
                        {scene?.narration}
                      </p>
                    </motion.div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="w-full max-w-3xl mt-3">
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>
                {imageTotal > 0 && imageProgress < imageTotal && (
                  <p className="text-[10px] text-muted-foreground text-center mt-1 flex items-center gap-1 justify-center">
                    <ImageIcon className="w-3 h-3" /> Generating images: {imageProgress}/{imageTotal}
                  </p>
                )}
              </div>

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
                <Button variant="outline" size="sm" className="gap-1" onClick={downloadVideo}>
                  <Download className="w-4 h-4" /> Download
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
                    <p className="text-muted-foreground">Writing your script & generating cinematic visuals...</p>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium font-display">Create AI cinematic videos</p>
                    <p className="text-sm mt-1">Describe a scene like "a boy throws a ball" or upload a document</p>
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
                  <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. a boy throws a ball into the sea at sunset" disabled={loading} className="flex-1" />
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