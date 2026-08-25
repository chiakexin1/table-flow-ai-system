"use client";

import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/common/Button";

type HeaderProps = {
  onMenuClick: () => void;
};

const Header = ({ onMenuClick }: HeaderProps) => {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

  // Logout handler – signs out via Supabase and redirects to /login
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (err) {
      // For now we simply log; UI could be extended later
      console.error("[Header] logout error:", err);
    }
  };

  return (
    <header className="flex items-center h-16 px-4 border-b border-border bg-white shadow-sm">
      {/* Mobile menu button */}
      <button
        className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title (center‑left) */}
      <h2 className="ml-4 text-lg font-semibold text-foreground flex-1">
        TableFlow AI
      </h2>

      {/* Right‑side actions */}
      {authLoading ? (
        // Minimal loading indication while session restoration is in progress
        <span className="text-sm text-muted-foreground animate-pulse">
          Loading…
        </span>
      ) : user ? (
        // Show logout when a user is authenticated
        <Button
          onClick={handleLogout}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          Logout
        </Button>
      ) : null}
    </header>
  );
};

export default Header;