import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatInterface from "@/components/ChatInterface";
import { FileText } from "lucide-react";

const NotesGenerator = () => (
  <FeaturePageLayout title="Notes Generator" icon={<FileText className="w-5 h-5 text-primary-foreground" />} gradient="from-pink-500 to-rose-500">
    <ChatInterface
      systemPrompt="You are a notes generator and summarizer. When users share text, topics, or content (including uploaded files), create well-organized study notes. Use clear headings (##), bullet points, key takeaways, and mnemonics. Make notes concise yet comprehensive. If the user uploads a document, analyze its content thoroughly and generate structured notes with key concepts, summaries, and important points. If the user provides a topic name, generate complete study notes for that topic."
      placeholder="Enter a topic or upload a file to generate notes..."
      moduleName="notes-generator"
    />
  </FeaturePageLayout>
);

export default NotesGenerator;
