import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap } from "lucide-react";

interface FeaturePageLayoutProps {
  title: string;
  icon: ReactNode;
  gradient: string;
  children: ReactNode;
}

const FeaturePageLayout = ({ title, icon, gradient, children }: FeaturePageLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              {icon}
            </div>
            <h1 className="text-lg font-bold font-display text-foreground">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
};

export default FeaturePageLayout;
