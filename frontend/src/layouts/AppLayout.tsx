import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArchiveRestore, BarChart3, History, LogOut, Moon, Search, Settings, Upload, Users, X } from "lucide-react";
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

function Avatar({ name, src, className = "h-10 w-10" }: { name?: string; src?: string | null; className?: string }) {
  const initials = (name || "C").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  if (src) return <img className={cn(className, "rounded-lg object-cover")} src={src} alt={name || "Profile"} />;
  return <div className={cn(className, "grid place-items-center rounded-lg bg-primary text-sm font-black text-white")}>{initials}</div>;
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("courierops.theme") === "dark");
  const [showWelcome, setShowWelcome] = useState(true);
  const [showTour, setShowTour] = useState(() => localStorage.getItem("courierops.tour.done") !== "true");
  const [previewAvatar, setPreviewAvatar] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("courierops.theme", dark ? "dark" : "light");
  }, [dark]);

  function closeTour() {
    localStorage.setItem("courierops.tour.done", "true");
    setShowTour(false);
  }

  const links = user?.role === "admin" ? [...customerLinks, ...adminLinks] : customerLinks;
  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-r border-border bg-white/85 p-4 backdrop-blur dark:bg-black/20 lg:fixed lg:inset-y-0 lg:w-72">
        <div className="mb-8 flex items-center gap-3">
          <button className="rounded-lg text-left" onClick={() => setPreviewAvatar(true)} title="View profile image">
            <Avatar name={user?.full_name} src={user?.avatar_data_url} />
          </button>
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
        <button className="mt-6 text-xs font-semibold text-primary" onClick={() => setShowTour(true)}>Open tour</button>
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
        <footer className="px-5 pb-6 text-center text-xs font-semibold tracking-wide text-slate-500 lg:px-8">MADE BY RISHI & MOMO ❤️</footer>
      </div>
      {showWelcome && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/35 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Welcome back, {user?.full_name?.split(" ")[0] || "there"}.</h2>
                <p className="mt-2 text-sm text-slate-500">Search orders, upload daily Excel data, and manage users from the sidebar.</p>
              </div>
              <button className="rounded-md p-1 hover:bg-muted" onClick={() => setShowWelcome(false)}><X size={18} /></button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => setShowWelcome(false)}>Continue</Button>
              <Button className="bg-accent" onClick={() => { setShowWelcome(false); setShowTour(true); }}>Take tour</Button>
            </div>
          </div>
        </div>
      )}
      {showTour && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg border border-border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Quick tour</h2>
                <p className="mt-1 text-sm text-slate-500">A short guide for new users.</p>
              </div>
              <button className="rounded-md p-1 hover:bg-muted" onClick={closeTour}><X size={18} /></button>
            </div>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="rounded-md border border-border p-3"><b>Search:</b> order number, docket number, phone, or alternate phone se customer details milenge.</div>
              <div className="rounded-md border border-border p-3"><b>Upload:</b> Step 1 preview checks the Excel. Step 2 old orders replace karke new data save karta hai.</div>
              <div className="rounded-md border border-border p-3"><b>Dashboard:</b> total orders, delivery status, courier wise summary yahan dikhta hai.</div>
              {user?.role === "admin" && <div className="rounded-md border border-border p-3"><b>Users:</b> new login IDs banao aur profile image add karo.</div>}
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={closeTour}>Got it</Button>
            </div>
          </div>
        </div>
      )}
      {previewAvatar && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onClick={() => setPreviewAvatar(false)}>
          <div className="rounded-lg border border-border bg-background p-4 shadow-xl" onClick={(event) => event.stopPropagation()} onMouseLeave={() => setPreviewAvatar(false)}>
            <Avatar name={user?.full_name} src={user?.avatar_data_url} className="h-56 w-56" />
            <p className="mt-3 text-center text-sm font-semibold">{user?.full_name}</p>
          </div>
        </div>
      )}
    </div>
  );
}
