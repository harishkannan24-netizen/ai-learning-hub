import FeaturePageLayout from "@/components/FeaturePageLayout";
import ChatInterface from "@/components/ChatInterface";
import { Map } from "lucide-react";

const RoadBuilder = () => (
  <FeaturePageLayout title="Road Builder" icon={<Map className="w-5 h-5 text-primary-foreground" />} gradient="from-emerald-500 to-teal-500">
    <ChatInterface
      systemPrompt="You are a learning roadmap builder. When users tell you a topic or skill they want to learn, create a detailed step-by-step learning path. Include: 1) Prerequisites, 2) Beginner topics, 3) Intermediate concepts, 4) Advanced topics, 5) Projects to build, 6) Resources and estimated time for each step. Format as a clear, numbered roadmap with headings and bullet points."
      placeholder="What do you want to learn? e.g., 'React.js' or 'Machine Learning'"
      moduleName="road-builder"
    />
  </FeaturePageLayout>
);

export default RoadBuilder;
