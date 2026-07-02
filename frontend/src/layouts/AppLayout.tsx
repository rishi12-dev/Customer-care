import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArchiveRestore, BarChart3, History, LogOut, Moon, Search, Settings, Upload, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { cn } from "../utils/cn";

const customerLinks = [{ to: "/search", label: "Search", icon: Search }, { to: "/dashboard", label: "Dashboard", icon: BarChart3 }];
const adminLinks = [
  { to: "/upload", label: "Upload", icon: Upload },
  { to: "/users", label: "Users", icon: Users },
  { to: "/history", label: "History", icon: History },
  { to: "/backup", label: "Backup", icon: ArchiveRestore },
  { to: "/settings", label: "Settings", icon: Settings }
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("courierops.theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("courierops.theme", dark ? "dark" : "light");
  }, [dark]);

  const links = user?.role === "admin" ? [...customerLinks, ...adminLinks] : customerLinks;
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-r border-border bg-white/85 p-4 backdrop-blur dark:bg-black/20 lg:fixed lg:inset-y-0 lg:w-72">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-lg font-black text-white">C</div>
          <div>
            <div className="text-lg font-bold">CourierOps</div>
            <div className="text-xs text-slate-500">{user?.full_name}</div>
          </div>
        </div>
        <nav className="grid gap-1">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition", isActive ? "bg-primary text-white" : "hover:bg-muted")}>
              <link.icon size={18} /> {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 lg:pl-72">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-background/82 px-5 backdrop-blur">
          <div>
            <div className="text-sm text-slate-500">Customer Care Portal</div>
            <div className="font-semibold">{user?.role === "admin" ? "Admin workspace" : "Search workspace"}</div>
          </div>
          <div className="flex gap-2">
            <Button aria-label="Toggle theme" className="w-10 px-0 bg-accent" onClick={() => setDark((value) => !value)}><Moon size={18} /></Button>
            <Button className="bg-slate-900 dark:bg-white dark:text-slate-950" onClick={() => logout().then(() => navigate("/login"))}><LogOut size={18} /> Logout</Button>
          </div>
        </header>
        <main className="p-5 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
