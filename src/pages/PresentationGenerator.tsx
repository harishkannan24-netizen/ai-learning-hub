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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, any> = {
  book: Book, lightbulb: Lightbulb, target: Target, chart: BarChart3,
  users: Users, shield: Shield, rocket: Rocket, star: Star, globe: Globe, heart: Heart,
};

const slideColors = [
  "from-blue-500 to-cyan-500", "from-violet-500 to-purple-500", "from-emerald-500 to-teal-500",
  "from-orange-500 to-amber-500", "from-pink-500 to-rose-500", "from-indigo-500 to-blue-500",
  "from-fuchsia-500 to-pink-500", "from-sky-500 to-blue-500", "from-lime-500 to-green-500",
  "from-red-500 to-orange-500",
];

type Slide = { title: string; points: string[]; note?: string; icon?: string };
type PresentationData = { title: string; slides: Slide[] };

const PresentationGenerator = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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

    try {
      const body: any = {};
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
        // Save to history
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("chat_history").insert({
            user_id: user.id,
            module_name: "presentation-generator",
            search_query: topic || uploadedFile?.name || "Presentation",
            ai_response: JSON.stringify(data),
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
                      className={`rounded-2xl bg-gradient-to-br ${slideColors[currentSlide % slideColors.length]} p-8 md:p-12 shadow-elevated text-primary-foreground min-h-[320px] flex flex-col`}
                    >
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
                <form onSubmit={(e) => { e.preventDefault(); generate(); }} className="flex gap-2 max-w-3xl mx-auto">
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
                </form>
              </div>
            </div>
          )}
        </div>

        <ChatHistorySidebar
          moduleName="presentation-generator"
          onLoadChat={(query) => setInput(query)}
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      </div>
    </FeaturePageLayout>
  );
};

export default PresentationGenerator;
