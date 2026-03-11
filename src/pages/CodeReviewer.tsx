import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatInterface from "@/components/ChatInterface";
import { Code2 } from "lucide-react";

const CodeReviewer = () => (
  <FeaturePageLayout title="Code Reviewer" icon={<Code2 className="w-5 h-5 text-primary-foreground" />} gradient="from-violet-500 to-purple-500">
    <ChatInterface
      systemPrompt="You are an expert code reviewer. When the user shares code, analyze it thoroughly: check for bugs, suggest improvements, explain best practices, optimize performance, and provide the corrected version. Format code blocks with proper syntax highlighting using markdown. Use headings for different sections of your review. Be detailed but clear."
      placeholder="Paste your code here for review..."
      moduleName="code-reviewer"
    />
  </FeaturePageLayout>
);

export default CodeReviewer;
