import { useState } from "react";
import { Copy, Check, Eye, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
  code: string;
  language?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const CodeBlock = ({ code, language }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setShowOutput(true);
    setOutput("");
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          systemPrompt:
            "You are a precise code execution simulator. Given a code snippet, return ONLY the exact stdout/console output the program would produce when executed, with no commentary, no markdown fences, no explanation. If the code has a compile/runtime error, return only the error message as it would appear. Keep it under 60 lines.",
          messages: [
            {
              role: "user",
              content: `Language: ${language || "auto-detect"}\n\nCode:\n${code}\n\nReturn only the output.`,
            },
          ],
        }),
      });
      if (!resp.ok || !resp.body) throw new Error(`Error ${resp.status}`);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            const chunk = parsed.choices?.[0]?.delta?.content;
            if (chunk) {
              acc += chunk;
              setOutput(acc);
            }
          } catch {
            /* ignore */
          }
        }
      }
      if (!acc) setOutput("(no output)");
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-border bg-[#0d1117] not-prose">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border">
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
          {language || "code"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={handleRun}
            disabled={running}
          >
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            Run
          </Button>
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-xs leading-relaxed text-slate-100 font-mono">
        <code>{code}</code>
      </pre>
      {showOutput && (
        <div className="border-t border-border bg-[#0a0e13]">
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#161b22]">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-mono">Output</span>
            <button
              onClick={() => setShowOutput(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close output"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <pre className="p-4 text-xs leading-relaxed text-emerald-200 font-mono whitespace-pre-wrap min-h-[40px]">
            {output || (running ? "Running..." : "")}
          </pre>
        </div>
      )}
    </div>
  );
};

export default CodeBlock;