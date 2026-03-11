import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatInterface from "@/components/ChatInterface";
import { Bot } from "lucide-react";

const AITutor = () => (
  <FeaturePageLayout title="AI Tutor" icon={<Bot className="w-5 h-5 text-primary-foreground" />} gradient="from-blue-500 to-cyan-500">
    <ChatInterface
      systemPrompt="You are a friendly and knowledgeable AI tutor. Help students understand concepts, guide them through problems, and explain topics in simple terms. Be encouraging, patient, and provide examples. Act as a mentor who cares about the student's learning journey. Format your responses with clear headings, bullet points, and code blocks when relevant."
      placeholder="Ask your tutor anything..."
      moduleName="ai-tutor"
    />
  </FeaturePageLayout>
);

export default AITutor;
