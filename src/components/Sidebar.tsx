"use client";

import { NavLink } from "react-router-dom";
import {
  Home,
  List,
  PlusCircle,
  Settings,
  Bot,
  AlertCircle,
} from "lucide-react";

type SidebarProps = {
  className?: string;
};

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/bookings", label: "Bookings", icon: List },
  { to: "/bookings/new", label: "New Booking", icon: PlusCircle },
  { to: "/settings", label: "Restaurant Settings", icon: Settings },
  { to: "/ai-advisor", label: "AI Advisor", icon: Bot },
  { to: "/escalations", label: "Escalations", icon: AlertCircle },
];

const Sidebar = ({ className = "" }: SidebarProps) => (
  <nav
    className={`flex flex-col h-full bg-white border-r border-border ${className}`}
    aria-label="Primary"
  >
    <div className="flex items-center justify-center h-16 px-4 border-b border-border">
      <h1 className="text-xl font-bold text-primary">TableFlow AI</h1>
    </div>
    <ul className="flex-1 py-2 space-y-1">
      {navItems.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <NavLink
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center px-4 py-2 mx-2 rounded-md text-sm font-medium transition-colors
               ${
                 isActive
                   ? "bg-primary text-primary-foreground"
                   : "text-muted-foreground hover:bg-muted"
               } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`
            }
          >
            <Icon className="w-5 h-5 mr-3" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
    <div className="p-4 border-t border-border text-xs text-muted-foreground">
      © {new Date().getFullYear()} TableFlow AI
    </div>
  </nav>
);

export default Sidebar;