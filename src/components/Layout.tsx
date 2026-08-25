"use client";

import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Menu, X, Home, List, PlusCircle, Settings, Bot, AlertCircle } from "lucide-react";

import Sidebar from "./Sidebar";
import Header from "./Header";

type LayoutProps = {
  children: React.ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <Sidebar className="hidden md:block w-64 flex-shrink-0" />

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 md:hidden ${
          mobileOpen ? "block" : "hidden"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <Sidebar
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white shadow-xl transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        <Header onMenuClick={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default Layout;