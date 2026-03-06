import { useState } from "react";
import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatInterface from "@/components/ChatInterface";
import { FileText } from "lucide-react";

const NotesGenerator = () => (
  <FeaturePageLayout title="Notes Generator" icon={<FileText className="w-5 h-5 text-primary-foreground" />} gradient="from-pink-500 to-rose-500">
    <ChatInterface
      systemPrompt="You are a notes generator and summarizer. When users share text, topics, or content, create well-organized study notes. Use bullet points, headings, key takeaways, and mnemonics. Make notes concise yet comprehensive. If the user provides a topic name, generate complete study notes for that topic."
      placeholder="Enter a topic or paste text to generate notes..."
    />
  </FeaturePageLayout>
);

export default NotesGenerator;
