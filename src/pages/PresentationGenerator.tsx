import { useState, useRef } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send, Presentation, Loader2, Paperclip, FileText, X,
  ChevronLeft, ChevronRight, Book, Lightbulb, Target,
  BarChart3, Users, Shield, Rocket, Star, Globe, Heart,
  ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const iconMap: Record<string, any> = {
  book: Book, lightbulb: Lightbulb, target: Target, chart: BarChart3,
  users: Users, shield: Shield, rocket: Rocket, star: Star, globe: Globe, heart: Heart,
};

type ThemeKey = "modern" | "corporate" | "creative" | "academic" | "minimal";

const themePalettes: Record<ThemeKey, string[]> = {
  modern: [
    "from-blue-500 to-cyan-500", "from-violet-500 to-purple-500",
    "from-emerald-500 to-teal-500", "from-orange-500 to-amber-500",
    "from-pink-500 to-rose-500", "from-indigo-500 to-blue-500",
  ],
  corporate: [
    "from-slate-700 to-slate-900", "from-blue-800 to-slate-900",
    "from-zinc-700 to-zinc-900", "from-blue-900 to-indigo-900",
    "from-gray-700 to-gray-900", "from-slate-800 to-blue-900",
  ],
  creative: [
    "from-fuchsia-500 to-pink-500", "from-amber-400 to-orange-500",
    "from-lime-400 to-emerald-500", "from-sky-400 to-violet-500",
    "from-rose-400 to-fuchsia-600", "from-yellow-400 to-red-500",
  ],
  academic: [
    "from-emerald-700 to-teal-900", "from-amber-700 to-amber-900",
    "from-blue-700 to-indigo-900", "from-stone-600 to-stone-800",
    "from-green-700 to-emerald-900", "from-red-800 to-rose-900",
  ],
  minimal: [
    "from-neutral-200 to-neutral-400", "from-stone-200 to-stone-400",
    "from-zinc-200 to-zinc-400", "from-slate-200 to-slate-400",
    "from-gray-200 to-gray-400", "from-neutral-300 to-stone-500",
  ],
};

type Slide = { title: string; points: string[]; note?: string; icon?: string; imagePrompt?: string; imageUrl?: string };
type PresentationData = { title: string; slides: Slide[] };

const PresentationGenerator = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [length, setLength] = useState<"brief" | "medium" | "high">("medium");
  const [theme, setTheme] = useState<ThemeKey>("modern");
  const [imageProgress, setImageProgress] = useState({ done: 0, total: 0 });
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
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
      const textExts = ['.txt', '.md', '.csv', '.json', '.xml'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (textExts.includes(ext)) {
        const text = await file.text();
        setUploadedFile({ name: file.name, content: text.slice(0, 50000) });
      } else {
        setUploadedFile({ name: file.name, content: `[Uploaded: ${file.name}] — File type: ${ext}, Size: ${(file.size/1024).toFixed(1)}KB. Please create a presentation based on this document.` });
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
    setImageProgress({ done: 0, total: 0 });

    try {
      const body: any = { length, theme };
      if (uploadedFile) body.content = `${topic ? topic + "\n\n" : ""}${uploadedFile.content}`;
      else body.topic = topic;

      setUploadedFile(null);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-presentation`,
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

      const data = await resp.json();
      if (data.slides?.length) {
        setPresentation(data);
        setCurrentSlide(0);

        // Generate one AI image per slide in parallel
        setImageProgress({ done: 0, total: data.slides.length });
        let done = 0;
        await Promise.all(
          data.slides.map(async (s: Slide, idx: number) => {
            try {
              const r = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
                  },
                  body: JSON.stringify({
                    prompt: `Editorial illustration for a slide titled "${s.title}". ${s.imagePrompt || s.points?.[0] || ""}. Theme: ${theme}. Clean composition, no text, no captions.`,
                  }),
                }
              );
              if (r.ok) {
                const d = await r.json();
                const img = d.images?.[0];
                const url = typeof img === "string" ? img : img?.image_url?.url || img?.url;
                if (url) {
                  setPresentation(prev => {
                    if (!prev) return prev;
                    const slides = [...prev.slides];
                    slides[idx] = { ...slides[idx], imageUrl: url };
                    return { ...prev, slides };
                  });
                }
              }
            } catch { /* ignore individual image failures */ }
            done += 1;
            setImageProgress({ done, total: data.slides.length });
          })
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setPresentation(prev => {
            if (prev) {
              supabase.from("chat_history").insert({
                user_id: user.id,
                module_name: "presentation-generator",
                search_query: topic || "Presentation",
                ai_response: JSON.stringify({ ...prev, theme }),
              });
            }
            return prev;
          });
        }
      } else {
        throw new Error("No slides generated");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const slide = presentation?.slides[currentSlide];
  const Icon = slide ? (iconMap[slide.icon || ""] || Star) : Star;
  const palette = themePalettes[theme];

  return (
    <FeaturePageLayout title="Presentation Generator" icon={<Presentation className="w-5 h-5 text-primary-foreground" />} gradient="from-sky-500 to-indigo-500">
      <div className="flex h-full relative">
        <div className="flex-1 flex flex-col">
          {presentation ? (
            <div className="flex-1 flex flex-col">
              {/* Slide viewer */}
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-3xl">
                  <p className="text-xs text-muted-foreground text-center mb-2 font-medium">
                    {presentation.title} — Slide {currentSlide + 1} of {presentation.slides.length}
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSlide}
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.3 }}
                      className={`relative rounded-2xl bg-gradient-to-br ${palette[currentSlide % palette.length]} p-8 md:p-12 shadow-elevated text-primary-foreground min-h-[360px] flex flex-col overflow-hidden`}
                    >
                      {slide?.imageUrl && (
                        <>
                          <img
                            src={slide.imageUrl}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover opacity-30"
                          />
                          <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-black/20" />
                        </>
                      )}
                      <div className="relative z-10 flex flex-col flex-1">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                          <Icon className="w-5 h-5" />
                        </div>
                        <h2 className="text-2xl font-bold font-display">{slide?.title}</h2>
                      </div>
                      <ul className="space-y-3 flex-1">
                        {slide?.points.map((point, i) => (
                          <motion.li
                            key={i}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-start gap-3 text-primary-foreground/90"
                          >
                            <span className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-sm md:text-base">{point}</span>
                          </motion.li>
                        ))}
                      </ul>
                      {slide?.note && (
                        <p className="text-xs mt-4 pt-4 border-t border-primary-foreground/20 text-primary-foreground/70 italic">
                          {slide.note}
                        </p>
                      )}
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation */}
                  <div className="flex items-center justify-between mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentSlide === 0}
                      onClick={() => setCurrentSlide(prev => prev - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <div className="flex gap-1.5">
                      {presentation.slides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlide(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? "bg-primary" : "bg-muted-foreground/30"}`}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentSlide === presentation.slides.length - 1}
                      onClick={() => setCurrentSlide(prev => prev + 1)}
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>

                  <div className="text-center mt-4">
                    <Button variant="ghost" size="sm" onClick={() => setPresentation(null)}>
                      Generate New Presentation
                    </Button>
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
                    <p className="text-muted-foreground">Creating your presentation...</p>
                    {imageProgress.total > 0 && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Images: {imageProgress.done}/{imageProgress.total}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Presentation className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium font-display">Create animated presentations</p>
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
                <form onSubmit={(e) => { e.preventDefault(); generate(); }} className="flex flex-col gap-2 max-w-3xl mx-auto">
                  <div className="flex gap-2">
                    <Select value={length} onValueChange={(v) => setLength(v as any)}>
                      <SelectTrigger className="h-9 text-xs flex-1"><SelectValue placeholder="Length" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brief">Brief (5-6 slides)</SelectItem>
                        <SelectItem value="medium">Medium (8-10 slides)</SelectItem>
                        <SelectItem value="high">High (12-15 slides)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={theme} onValueChange={(v) => setTheme(v as ThemeKey)}>
                      <SelectTrigger className="h-9 text-xs flex-1"><SelectValue placeholder="Theme" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modern">Modern</SelectItem>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="creative">Creative</SelectItem>
                        <SelectItem value="academic">Academic</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.txt,.md,.json,.xml" onChange={handleFileUpload} />
                  <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={loading} className="shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Enter a topic or upload a document..."
                    disabled={loading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={loading || (!input.trim() && !uploadedFile)} className="gradient-primary border-0">
                    <Send className="w-4 h-4" />
                  </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        <ChatHistorySidebar
          moduleName="presentation-generator"
          onLoadChat={(query, response) => {
            try {
              const data = JSON.parse(response);
              if (data.slides) { setPresentation(data); setCurrentSlide(0); if (data.theme) setTheme(data.theme); return; }
            } catch { /* not a presentation payload */ }
            setInput(query);
          }}
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      </div>
    </FeaturePageLayout>
  );
};

export default PresentationGenerator;
