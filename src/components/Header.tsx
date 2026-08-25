"use client";

import { Menu } from "lucide-react";

type HeaderProps = {
  onMenuClick: () => void;
};

const Header = ({ onMenuClick }: HeaderProps) => (
  <header className="flex items-center h-16 px-4 border-b border-border bg-white shadow-sm">
    {/* Mobile menu button */}
    <button
      className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={onMenuClick}
      aria-label="Open navigation menu"
    >
      <Menu className="w-5 h-5" />
    </button>

    {/* Title (will be replaced by page‑specific heading if needed) */}
    <h2 className="ml-4 text-lg font-semibold text-foreground">
      TableFlow AI
    </h2>
  </header>
);

export default Header;