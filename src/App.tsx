import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AITutor from "./pages/AITutor";
import CodeReviewer from "./pages/CodeReviewer";
import DoubtResolver from "./pages/DoubtResolver";
import RoadBuilder from "./pages/RoadBuilder";
import NotesGenerator from "./pages/NotesGenerator";
import QuizGenerator from "./pages/QuizGenerator";
import ImageGenerator from "./pages/ImageGenerator";
import PresentationGenerator from "./pages/PresentationGenerator";
import VideoGenerator from "./pages/VideoGenerator";
import PDFtoAudio from "./pages/PDFtoAudio";
import SearchHistory from "./pages/SearchHistory";
import SharedQuiz from "./pages/SharedQuiz";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/ai-tutor" element={<ProtectedRoute><AITutor /></ProtectedRoute>} />
          <Route path="/code-reviewer" element={<ProtectedRoute><CodeReviewer /></ProtectedRoute>} />
          <Route path="/doubt-resolver" element={<ProtectedRoute><DoubtResolver /></ProtectedRoute>} />
          <Route path="/road-builder" element={<ProtectedRoute><RoadBuilder /></ProtectedRoute>} />
          <Route path="/notes-generator" element={<ProtectedRoute><NotesGenerator /></ProtectedRoute>} />
          <Route path="/quiz-generator" element={<ProtectedRoute><QuizGenerator /></ProtectedRoute>} />
          <Route path="/image-generator" element={<ProtectedRoute><ImageGenerator /></ProtectedRoute>} />
          <Route path="/presentation-generator" element={<ProtectedRoute><PresentationGenerator /></ProtectedRoute>} />
          <Route path="/video-generator" element={<ProtectedRoute><VideoGenerator /></ProtectedRoute>} />
          <Route path="/pdf-to-audio" element={<ProtectedRoute><PDFtoAudio /></ProtectedRoute>} />
          <Route path="/search-history" element={<ProtectedRoute><SearchHistory /></ProtectedRoute>} />
          <Route path="/shared-quiz/:id" element={<SharedQuiz />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
