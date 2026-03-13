import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, CheckCircle2, XCircle, Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

const SharedQuiz = () => {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<{ quiz_title: string; questions: QuizQuestion[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchQuiz = async () => {
      if (!id) { setError("Invalid quiz link"); setLoading(false); return; }
      const { data, error: fetchError } = await supabase
        .from("shared_quizzes")
        .select("quiz_title, questions")
        .eq("id", id)
        .single();
      if (fetchError || !data) {
        setError("Quiz not found or expired");
      } else {
        setQuiz({ quiz_title: data.quiz_title, questions: data.questions as unknown as QuizQuestion[] });
      }
      setLoading(false);
    };
    fetchQuiz();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">{error || "Quiz not found"}</p>
            <p className="text-sm text-muted-foreground mt-2">This quiz may have expired or the link is invalid.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const questions = quiz.questions;
  const score = submitted
    ? Object.entries(answers).filter(([qi, ai]) => questions[Number(qi)]?.correct === ai).length
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-bold font-display text-foreground">Zyra Quiz</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h2 className="text-2xl font-bold font-display text-foreground mb-1">{quiz.quiz_title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{questions.length} questions</p>

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
                      if (isCorrect) classes += "bg-green-50 border-green-500 text-green-700";
                      else if (selected) classes += "bg-red-50 border-red-500 text-red-700";
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
                <Button variant="secondary" className="mt-3" onClick={() => { setAnswers({}); setSubmitted(false); }}>
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default SharedQuiz;
