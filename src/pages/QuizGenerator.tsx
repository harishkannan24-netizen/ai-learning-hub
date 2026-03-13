import { useState, useRef } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatHistorySidebar from "@/components/ChatHistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, Loader2, CheckCircle2, XCircle, Send, Paperclip, X,
  FileText, Download, Share2, QrCode,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const QuizGenerator = () => {
  const [topic, setTopic] = useState("");
  const [questionCount, setQuestionCount] = useState("5");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [sharing, setSharing] = useState(false);
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
      const textExts = ['.txt', '.md', '.csv', '.json', '.xml', '.js', '.ts', '.py', '.java', '.html', '.css'];
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (textExts.includes(ext)) {
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
          content: `[FILE_UPLOADED: ${file.name}]\nFile Type: ${file.type || ext}\nFile Size: ${(file.size / 1024).toFixed(1)} KB\nStorage Path: ${filePath}\n\nGenerate quiz questions based on this file.`,
        });
      }
      toast({ title: "File loaded", description: `${file.name} ready` });
    } catch {
      toast({ title: "Error reading file", variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const generateQuiz = async () => {
    if ((!topic.trim() && !uploadedFile) || loading) return;
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);

    const count = parseInt(questionCount);
    let userContent = uploadedFile
      ? `Based on this document (${uploadedFile.name}):\n${uploadedFile.content}\n\n${topic.trim() ? `Additional context: ${topic.trim()}\n\n` : ""}Generate exactly ${count} multiple choice quiz questions.`
      : `Generate exactly ${count} multiple choice quiz questions about "${topic}".`;

    userContent += ` Return ONLY a valid JSON array: [{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}] where "correct" is the 0-based index. No extra text, no markdown.`;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userContent }],
          systemPrompt: "You are a quiz generator. Return ONLY valid JSON arrays. No markdown, no extra text, no code fences.",
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

      const jsonMatch = fullContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setQuestions(parsed);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("chat_history").insert({
            user_id: user.id,
            module_name: "quiz-generator",
            search_query: topic.trim() || `Quiz from ${uploadedFile?.name}`,
            ai_response: JSON.stringify(parsed),
          });
        }
      }
      setUploadedFile(null);
    } catch (err) {
      console.error("Quiz generation error:", err);
      toast({ title: "Failed to generate quiz", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadChat = (_query: string, response: string) => {
    try {
      const data = JSON.parse(response);
      if (Array.isArray(data) && data[0]?.question) {
        setQuestions(data);
        setAnswers({});
        setSubmitted(false);
      }
    } catch {
      setTopic(_query);
    }
    setHistoryOpen(false);
  };

  const shareQuiz = async () => {
    if (!questions.length || sharing) return;
    setSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase.from("shared_quizzes").insert({
        created_by: user.id,
        quiz_title: topic.trim() || "Quiz",
        questions: questions as any,
      }).select("id").single();
      if (error) throw error;
      const url = `${window.location.origin}/shared-quiz/${data.id}`;
      setShareUrl(url);
      setQrDialogOpen(true);
    } catch (err: any) {
      toast({ title: "Error sharing quiz", description: err.message, variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  const downloadPDF = () => {
    const content = questions.map((q, i) => {
      const opts = q.options.map((o, j) => `   ${String.fromCharCode(65 + j)}. ${o}${submitted && q.correct === j ? " ✓" : ""}`).join("\n");
      const answer = submitted ? `\n   Answer: ${String.fromCharCode(65 + q.correct)} — ${q.explanation}` : "";
      return `${i + 1}. ${q.question}\n${opts}${answer}`;
    }).join("\n\n");

    const title = topic.trim() || "Quiz";
    const html = `<html><head><title>${title}</title><style>
      body{font-family:Arial,sans-serif;padding:40px;max-width:800px;margin:0 auto;color:#222}
      h1{color:#2563eb;border-bottom:2px solid #2563eb;padding-bottom:10px}
      pre{white-space:pre-wrap;font-size:14px;line-height:1.8}
      .footer{margin-top:40px;color:#888;font-size:12px;text-align:center}
    </style></head><body>
      <h1>📝 ${title}</h1>
      <p style="color:#666">${questions.length} Questions${submitted ? ` • Score: ${score}/${questions.length}` : ""}</p>
      <pre>${content}</pre>
      <div class="footer">Generated by Zyra AI</div>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url);
    if (printWindow) {
      printWindow.onload = () => { printWindow.print(); };
    }
  };

  const score = submitted
    ? Object.entries(answers).filter(([qi, ai]) => questions[Number(qi)]?.correct === ai).length
    : 0;

  return (
    <FeaturePageLayout title="Quiz Generator" icon={<Brain className="w-5 h-5 text-primary-foreground" />} gradient="from-indigo-500 to-blue-500">
      <div className="flex h-full relative">
        <div className="flex-1 flex flex-col overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto w-full">
            {/* Input area */}
            <div className="flex gap-2 mb-4">
              <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.txt,.md,.js,.ts,.py,.java,.html,.css,.json,.xml,.zip" onChange={handleFileUpload} />
              <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={loading} className="shrink-0">
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter a topic for quiz, e.g., 'JavaScript Promises'"
                onKeyDown={(e) => e.key === "Enter" && generateQuiz()}
              />
              <Select value={questionCount} onValueChange={setQuestionCount}>
                <SelectTrigger className="w-20 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={generateQuiz} disabled={loading || (!topic.trim() && !uploadedFile)} className="gradient-primary border-0 gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>

            {uploadedFile && (
              <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-secondary/50">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground truncate flex-1">{uploadedFile.name}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setUploadedFile(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}

            {/* Quiz content */}
            {questions.length > 0 && (
              <div className="space-y-4">
                {/* Action bar */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{questions.length} questions</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={downloadPDF} className="gap-1">
                      <Download className="w-3 h-3" /> PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={shareQuiz} disabled={sharing} className="gap-1">
                      {sharing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />} Share
                    </Button>
                  </div>
                </div>

                {questions.map((q, qi) => (
                  <Card key={qi} className="border-0 shadow-card">
                    <CardContent className="p-5">
                      <p className="font-medium text-card-foreground mb-3">
                        {qi + 1}. {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt, oi) => {
                          const selected = answers[qi] === oi;
                          const isCorrect = q.correct === oi;
                          let classes = "p-3 rounded-lg border cursor-pointer transition-all text-sm ";
                          if (submitted) {
                            if (isCorrect) classes += "bg-success/10 border-success text-success";
                            else if (selected) classes += "bg-destructive/10 border-destructive text-destructive";
                            else classes += "bg-muted/50 border-border text-muted-foreground";
                          } else {
                            classes += selected
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-card border-border text-card-foreground hover:bg-muted/50";
                          }
                          return (
                            <div key={oi} className={classes} onClick={() => !submitted && setAnswers({ ...answers, [qi]: oi })}>
                              <span className="font-medium mr-2">{String.fromCharCode(65 + oi)}.</span>
                              {opt}
                              {submitted && isCorrect && <CheckCircle2 className="inline w-4 h-4 ml-2" />}
                              {submitted && selected && !isCorrect && <XCircle className="inline w-4 h-4 ml-2" />}
                            </div>
                          );
                        })}
                      </div>
                      {submitted && (
                        <p className="mt-3 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                          💡 {q.explanation}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {!submitted ? (
                  <Button
                    onClick={() => setSubmitted(true)}
                    disabled={Object.keys(answers).length < questions.length}
                    className="w-full gradient-primary border-0"
                  >
                    Submit Answers
                  </Button>
                ) : (
                  <Card className="border-0 shadow-card gradient-primary">
                    <CardContent className="p-5 text-center text-primary-foreground">
                      <p className="text-2xl font-bold font-display">Score: {score}/{questions.length}</p>
                      <p className="text-sm opacity-80 mt-1">
                        {score === questions.length ? "🎉 Perfect!" : score >= questions.length * 0.6 ? "👍 Good job!" : "📚 Keep studying!"}
                      </p>
                      <div className="flex gap-2 justify-center mt-3">
                        <Button variant="secondary" onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); }}>
                          Try Again
                        </Button>
                        <Button variant="secondary" onClick={downloadPDF}>
                          <Download className="w-4 h-4 mr-1" /> Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
                <p className="text-muted-foreground">Generating {questionCount} quiz questions...</p>
              </div>
            )}

            {!questions.length && !loading && (
              <div className="text-center py-16 text-muted-foreground">
                <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium font-display">Generate quizzes from any topic</p>
                <p className="text-sm mt-1">Enter a topic or upload a document to get started</p>
              </div>
            )}
          </div>
        </div>

        <ChatHistorySidebar
          moduleName="quiz-generator"
          onLoadChat={handleLoadChat}
          isOpen={historyOpen}
          onToggle={() => setHistoryOpen(!historyOpen)}
        />
      </div>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-primary" /> Share Quiz
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={shareUrl} size={200} />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code to take the quiz — no login required!
            </p>
            <div className="flex gap-2 w-full">
              <Input value={shareUrl} readOnly className="flex-1 text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast({ title: "Link copied!" });
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageLayout>
  );
};

export default QuizGenerator;
