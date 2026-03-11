import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Bot,
  Code2,
  HelpCircle,
  Map,
  FileText,
  Brain,
  LogOut,
  Sparkles,
  Clock,
} from "lucide-react";

const features = [
  {
    title: "AI Tutor",
    description: "Chat with your personal AI mentor for guidance",
    icon: Bot,
    path: "/ai-tutor",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    title: "Code Reviewer",
    description: "Analyze and improve your code quality",
    icon: Code2,
    path: "/code-reviewer",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    title: "Doubt Resolver",
    description: "Get your questions answered clearly",
    icon: HelpCircle,
    path: "/doubt-resolver",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    title: "Road Builder",
    description: "Get step-by-step learning paths",
    icon: Map,
    path: "/road-builder",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    title: "Notes Generator",
    description: "Summarize files and generate study notes",
    icon: FileText,
    path: "/notes-generator",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    title: "Quiz Generator",
    description: "Test your knowledge with daily quizzes",
    icon: Brain,
    path: "/quiz-generator",
    gradient: "from-indigo-500 to-blue-500",
  },
];

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold font-display text-foreground">Zyra</h1>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" /> Logout
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="container mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" /> AI-Powered Learning
          </div>
          <h2 className="text-4xl font-bold font-display text-foreground mb-3">
            Your Learning Dashboard
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Choose a tool to supercharge your learning journey
          </p>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {features.map((feature, i) => (
            <motion.div
              key={feature.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card
                className="cursor-pointer shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1 border-0 bg-card"
                onClick={() => navigate(feature.path)}
              >
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4`}>
                    <feature.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold font-display text-card-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
