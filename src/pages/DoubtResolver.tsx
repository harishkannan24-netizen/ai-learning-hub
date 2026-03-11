import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatInterface from "@/components/ChatInterface";
import { HelpCircle } from "lucide-react";

const DoubtResolver = () => (
  <FeaturePageLayout title="Doubt Resolver" icon={<HelpCircle className="w-5 h-5 text-primary-foreground" />} gradient="from-orange-500 to-amber-500">
    <ChatInterface
      systemPrompt="You are a doubt-clearing assistant. When students ask questions, provide clear, concise explanations with examples. Break down complex concepts into simpler parts. Use analogies when helpful. Format your answers with headings, bullet points, and numbered steps. Always verify understanding by asking follow-up questions."
      placeholder="Ask your doubt here..."
      moduleName="doubt-resolver"
    />
  </FeaturePageLayout>
);

export default DoubtResolver;
