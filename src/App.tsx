import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import NewBooking from "./pages/NewBooking";
import Settings from "./pages/Settings";
import AIAdvisor from "./pages/AIAdvisor";
import Escalations from "./pages/Escalations";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

import { BookingProvider } from "@/context/BookingContext";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          {/* Temporary booking state is now globally available */}
          <BookingProvider>
            <Layout>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/login" element={<Login />} />

                {/* Protected routes – wrapped with RequireAuth */}
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <Dashboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/bookings"
                  element={
                    <RequireAuth>
                      <Bookings />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/bookings/new"
                  element={
                    <RequireAuth>
                      <NewBooking />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireAuth>
                      <Settings />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/ai-advisor"
                  element={
                    <RequireAuth>
                      <AIAdvisor />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/escalations"
                  element={
                    <RequireAuth>
                      <Escalations />
                    </RequireAuth>
                  }
                />

                {/* Catch‑all for unknown URLs */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </BookingProvider>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;