import { useState } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Image as ImageIcon, Loader2, Download, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ImageResult = {
  prompt: string;
  imageUrl: string;
  text: string;
};

const ImageGenerator = () => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImageResult[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { toast } = useToast();

  const generateImage = async () => {
    if (!input.trim() || loading) return;
    const prompt = input.trim();
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      const imageUrl = data.images?.[0]?.image_url?.url || "";
      const text = data.text || "";

      if (imageUrl) {
        setResults(prev => [{ prompt, imageUrl, text }, ...prev]);
        // Save to history
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("chat_history").insert({
            user_id: user.id,
            module_name: "image-generator",
            search_query: prompt,
            ai_response: text || "Image generated successfully",
          });
        }
      } else {
        toast({ title: "No image generated", description: text || "Try a different prompt", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadChat = (query: string) => {
    setInput(query);
  };

  const downloadImage = (url: string, prompt: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `zyra-${prompt.slice(0, 20).replace(/\s+/g, "-")}.png`;
    link.click();
  };

  return (
    <FeaturePageLayout title="Image Generator" icon={<ImageIcon className="w-5 h-5 text-primary-foreground" />} gradient="from-fuchsia-500 to-pink-500">
      <div className="flex h-full relative">
        <div className="flex-1 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-4xl mx-auto">
              {results.length === 0 && !loading && (
                <div className="text-center py-16 text-muted-foreground">
                  <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium font-display">Create stunning AI images</p>
                  <p className="text-sm mt-1">Describe what you want to see</p>
                </div>
              )}

              {loading && (
                <div className="text-center py-12">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Generating your image...</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {results.map((result, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-border bg-card shadow-card group">
                    <div className="aspect-square relative">
                      <img src={result.imageUrl} alt={result.prompt} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/30 transition-colors flex items-end justify-between p-3 opacity-0 group-hover:opacity-100">
                        <p className="text-xs text-primary-foreground bg-foreground/60 rounded-lg px-2 py-1 truncate max-w-[70%]">{result.prompt}</p>
                        <Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => downloadImage(result.imageUrl, result.prompt)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {result.text && (
                      <div className="p-3">
                        <p className="text-xs text-muted-foreground">{result.text}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>

          <div className="border-t bg-card p-4">
            <form onSubmit={(e) => { e.preventDefault(); generateImage(); }} className="flex gap-2 max-w-3xl mx-auto">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the image you want to generate..."
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !input.trim()} className="gradient-primary border-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>

        <ChatHistorySidebar
          moduleName="image-generator"
          onLoadChat={handleLoadChat}
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      </div>
    </FeaturePageLayout>
  );
};

export default ImageGenerator;
