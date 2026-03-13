import { useState, useRef } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Image as ImageIcon, Loader2, Download, Sparkles, Paperclip, FileText, X } from "lucide-react";
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
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
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
        setUploadedFile({ name: file.name, content: `[Uploaded: ${file.name}] — Type: ${ext}, Size: ${(file.size / 1024).toFixed(1)}KB. Generate an image based on this document.` });
      }
      toast({ title: "File loaded", description: `${file.name} ready` });
    } catch {
      toast({ title: "Error reading file", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generateImage = async () => {
    if ((!input.trim() && !uploadedFile) || loading) return;
    const prompt = uploadedFile
      ? `${input.trim() ? input.trim() + "\n\n" : ""}Based on this document (${uploadedFile.name}):\n${uploadedFile.content}`
      : input.trim();
    setInput("");
    setUploadedFile(null);
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
        setResults(prev => [{ prompt: input.trim() || uploadedFile?.name || prompt.slice(0, 60), imageUrl, text }, ...prev]);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("chat_history").insert({
            user_id: user.id,
            module_name: "image-generator",
            search_query: input.trim() || uploadedFile?.name || prompt.slice(0, 60),
            ai_response: JSON.stringify({ imageUrl, text }),
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

  const handleLoadChat = (_query: string, response: string) => {
    try {
      const data = JSON.parse(response);
      if (data.imageUrl) {
        setResults(prev => [{ prompt: _query, imageUrl: data.imageUrl, text: data.text || "" }, ...prev]);
      }
    } catch {
      setInput(_query);
    }
    setHistoryOpen(false);
  };

  const downloadImage = (url: string, prompt: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = `zyra-${prompt.slice(0, 20).replace(/\s+/g, "-")}.png`;
    link.target = "_blank";
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
                  <p className="text-sm mt-1">Describe what you want to see or upload a file</p>
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
            <form onSubmit={(e) => { e.preventDefault(); generateImage(); }} className="flex gap-2 max-w-3xl mx-auto">
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.txt,.md,.json,.xml" onChange={handleFileUpload} />
              <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={loading} className="shrink-0">
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the image you want to generate..."
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || (!input.trim() && !uploadedFile)} className="gradient-primary border-0">
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
