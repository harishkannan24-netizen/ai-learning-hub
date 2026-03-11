import { useState } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, Loader2, CheckCircle2, XCircle, Send, Paperclip, X, FileText } from "lucide-react";
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
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const text = await file.text();
      setUploadedFile({ name: file.name, content: text.slice(0, 50000) });
      toast({ title: "File loaded", description: `${file.name} ready` });
    } catch {
      toast({ title: "Error reading file", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const generateQuiz = async () => {
    if ((!topic.trim() && !uploadedFile) || loading) return;
    setLoading(true);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);

    let userContent = `Generate exactly 5 multiple choice quiz questions about "${topic}". Return ONLY a valid JSON array with this format:
[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]
where "correct" is the 0-based index of the correct option. No extra text, no markdown.`;

    if (uploadedFile) {
      userContent = `Based on the following document content, generate exactly 5 multiple choice quiz questions. Return ONLY a valid JSON array with this format:
[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]
where "correct" is the 0-based index of the correct option. No extra text, no markdown.

Document (${uploadedFile.name}):
${uploadedFile.content}`;
    }

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: userContent }],
          systemPrompt: "You are a quiz generator. Return ONLY valid JSON arrays of quiz questions. No markdown, no extra text, no code fences.",
        }),
      });

      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      if (!resp.body) throw new Error("No body");

      // Collect streamed response
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

        // Save to history
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("chat_history").insert({
            user_id: user.id,
            module_name: "quiz-generator",
            search_query: topic.trim() || `Quiz from ${uploadedFile?.name}`,
            ai_response: `Generated ${parsed.length} quiz questions`,
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

  const score = submitted
    ? Object.entries(answers).filter(([qi, ai]) => questions[Number(qi)]?.correct === ai).length
    : 0;

  return (
    <FeaturePageLayout title="Quiz Generator" icon={<Brain className="w-5 h-5 text-primary-foreground" />} gradient="from-indigo-500 to-blue-500">
      <div className="p-4 max-w-3xl mx-auto h-full overflow-y-auto">
        <div className="flex gap-2 mb-6">
          <input
            type="file"
            className="hidden"
            id="quiz-file-input"
            accept=".pdf,.txt,.md,.js,.ts,.py,.java,.html,.css,.json,.csv"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => document.getElementById("quiz-file-input")?.click()}
            disabled={uploading || loading}
            className="shrink-0"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </Button>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter a topic for quiz, e.g., 'JavaScript Promises'"
            onKeyDown={(e) => e.key === "Enter" && generateQuiz()}
          />
          <Button onClick={generateQuiz} disabled={loading || (!topic.trim() && !uploadedFile)} className="gradient-primary border-0 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Generate
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

        {questions.length > 0 && (
          <div className="space-y-4">
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
                        <div
                          key={oi}
                          className={classes}
                          onClick={() => !submitted && setAnswers({ ...answers, [qi]: oi })}
                        >
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
                    {score === questions.length ? "🎉 Perfect!" : score >= 3 ? "👍 Good job!" : "📚 Keep studying!"}
                  </p>
                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={() => { setQuestions([]); setAnswers({}); setSubmitted(false); }}
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-muted-foreground">Generating quiz questions...</p>
          </div>
        )}
      </div>
    </FeaturePageLayout>
  );
};

export default QuizGenerator;
