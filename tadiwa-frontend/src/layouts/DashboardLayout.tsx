import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, Calendar, Moon, Sun, Monitor, ChevronLeft, ChevronRight,
  Clock, User, HelpCircle, LogOut, MessageSquare, Settings, Target, TriangleAlert, User2Icon,
  Logs,
  Book,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useTheme, type Theme } from '../context/ThemeContext';
import { notificationsApi, ApiError, type NotificationItem } from '../lib/api';
import AIAssistant from '../components/AIAssistant';
import TicketSamples from '../pages/TicketSamples';

const SIDEBAR_COLLAPSED_KEY = 'omni_hd_sidebar_collapsed';
const NOTIFICATIONS_POLL_MS = 20000;

function formatNotificationTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={16} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
  { value: 'system', label: 'System', icon: <Monitor size={16} /> },
];

export default function DashboardLayout() {
  const { user, accessToken, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  const [notifOpen, setNotifOpen] = React.useState(false);
  const notifMenuRef = React.useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = React.useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [notifError, setNotifError] = React.useState<string | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // Storage unavailable — the choice just won't survive a refresh.
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const initials = (user?.name || 'Omni Agent')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Close on outside click or Escape — standard dropdown behavior. Covers
  // both the profile menu and the notifications menu; only one is ever open
  // at a time (opening one closes the other, see the toggle handlers below).
  React.useEffect(() => {
    if (!profileMenuOpen && !notifOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [profileMenuOpen, notifOpen]);

  const fetchUnreadCount = React.useCallback(async () => {
    if (!accessToken) return;
    try {
      const { unread } = await notificationsApi.count(accessToken);
      setUnreadCount(unread);
    } catch {
      // Silent — this is a background poll for a badge, not worth a banner.
    }
  }, [accessToken]);

  const fetchNotifications = React.useCallback(async () => {
    if (!accessToken) return;
    setNotifError(null);
    try {
      const list = await notificationsApi.list(accessToken);
      setNotifications(list);
    } catch (err) {
      setNotifError(err instanceof ApiError ? err.message : 'Could not load notifications.');
    }
  }, [accessToken]);

  // Poll the unread badge in the background regardless of whether the panel
  // is open — same pattern TeamComms uses for its conversation list.
  React.useEffect(() => {
    fetchUnreadCount();
    const id = setInterval(fetchUnreadCount, NOTIFICATIONS_POLL_MS);
    return () => clearInterval(id);
  }, [fetchUnreadCount]);

  const toggleNotifMenu = () => {
    setProfileMenuOpen(false);
    setNotifOpen((open) => {
      const next = !open;
      if (next) fetchNotifications();
      return next;
    });
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    setNotifOpen(false);
    if (item.kind === 'chat' && item.peerId != null) {
      navigate('/teamComms', { state: { peerId: item.peerId } });
      // The conversation view marks its own messages read on open; just
      // reflect that locally without waiting for the next poll tick.
      setTimeout(fetchUnreadCount, 500);
      return;
    }
    if (item.kind === 'escalation' && item.notificationId != null) {
      if (!item.isRead && accessToken) {
        try {
          await notificationsApi.markRead(accessToken, item.notificationId);
          setUnreadCount((c) => Math.max(0, c - 1));
        } catch {
          // Non-fatal — still navigate; the badge just stays stale until the next poll.
        }
      }
      navigate('/history');
    }
  };

  const handleMarkAllRead = async () => {
    if (!accessToken) return;
    try {
      await notificationsApi.markAllRead(accessToken);
      setUnreadCount(0);
      setNotifications((prev) => prev?.map((n) => ({ ...n, isRead: true, unreadCount: 0 })) ?? prev);
    } catch (err) {
      setNotifError(err instanceof ApiError ? err.message : 'Could not clear notifications.');
    }
  };

  return (
    <div className="flex h-screen bg-transparent text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar */}
      <aside
        className={cn(
          'relative shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-[width] duration-200',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className={cn('p-6', sidebarCollapsed && 'px-4')}>
          <NavLink to="/" className={cn('flex items-center gap-3 font-bold text-xl', sidebarCollapsed && 'justify-center')}>
            <div className="w-10 h-10 shrink-0 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">O</div>
            {!sidebarCollapsed && (
              <div className="leading-tight">
                <span className="text-slate-900 dark:text-slate-100">Omni</span>
                <p className="text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-medium">Contact Center</p>
              </div>
            )}
          </NavLink>
        </div>

        <nav className={cn('flex-1 space-y-2', sidebarCollapsed ? 'p-2' : 'p-4')}>
          <NavItem to="/" end icon={<BarChart3 size={18} />} label="Tech Hub" collapsed={sidebarCollapsed} />
          <NavItem to="/schedule" icon={<Calendar size={18} />} label="Schedule" collapsed={sidebarCollapsed} />
          <NavItem to="/teamComms" icon={<Clock size={18} />} label="Team Comms" collapsed={sidebarCollapsed} />
          <NavItem to="/productivity" icon={<Target size={18} />} label="Productivity" collapsed={sidebarCollapsed} />
          <NavItem to="/history" icon={<Clock size={18} />} label="History" collapsed={sidebarCollapsed} />
          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            <NavItem to="/auditLog" icon={<Logs size={18} />} label="AuditLogs" collapsed={sidebarCollapsed} />
            <NavItem to="/settings" icon={<Settings size={18} />} label="Settings" collapsed={sidebarCollapsed} />
            <NavItem to="/support" icon={<HelpCircle size={18} />} label="Help Center" collapsed={sidebarCollapsed} />
            <NavItem to="/ticketSamples" icon={<Book size={18} />} label="Ticket Samples" collapsed={sidebarCollapsed} />
          </div>
        </nav>

        {/* Collapse toggle — floats on the sidebar's edge, always reachable regardless of collapsed state */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute top-8 -right-3 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-colors z-10"
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white dark:bg-slate-900 dark:border-slate-800 border-b border-slate-200 px-8 flex flex-row items-center justify-end">
            <div className="flex items-center gap-1">
            <div className="relative" ref={notifMenuRef}>
              <button
                onClick={toggleNotifMenu}
                className={cn(
                  "relative p-2 text-blue-800 hover:bg-slate-100 hover:text-blue-500 dark:hover:bg-slate-800 dark:hover:text-blue-400 rounded-xl transition-colors",
                  notifOpen && "bg-blue-800/20"
                )}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-bold leading-none bg-red-500 text-white rounded-full border-2 border-white dark:border-slate-900">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</p>
                    {!!notifications?.length && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-bold uppercase tracking-widest text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notifError && (
                      <p className="px-4 py-4 text-xs text-red-600">{notifError}</p>
                    )}
                    {!notifError && notifications === null && (
                      <p className="px-4 py-6 text-sm text-slate-400 text-center">Loading…</p>
                    )}
                    {!notifError && notifications !== null && notifications.length === 0 && (
                      <p className="px-4 py-6 text-sm text-slate-400 text-center">You're all caught up.</p>
                    )}
                    {notifications?.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={cn(
                          "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-50 dark:border-slate-700/50 last:border-b-0 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50",
                          !item.isRead && "bg-blue-50/50 dark:bg-blue-500/5"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          item.kind === 'chat' ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" : "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400"
                        )}>
                          {item.kind === 'chat' ? <MessageSquare size={15} /> : <TriangleAlert size={15} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">{item.title}</p>
                            <span className="text-[10px] text-slate-400 shrink-0">{formatNotificationTime(item.createdAt)}</span>
                          </div>
                          {item.body && <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.body}</p>}
                        </div>
                        {!item.isRead && <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Theme segmented control — all 3 options always visible, no open/close panel */}
            <div className="flex items-center gap-0.5 bg-blue-300 dark:bg-slate-800/60 rounded-xl p-1 mr-1">
              {THEME_OPTIONS.map((option) => {
                const selected = option.value === theme;
                return (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    title={`Theme: ${option.label}`}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      selected
                        ? "bg-blue-800 text-white dark:bg-slate-700 dark:text-blue-400 shadow-sm"
                        : "text-blue-800 hover:text-blue-500 hover:bg-blue-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700/50"
                    )}
                  >
                    {option.icon}
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => { setNotifOpen(false); setProfileMenuOpen((open) => !open); }}
                className={cn(
                  "relative p-2 text-blue-800 hover:bg-slate-100 hover:text-blue-500 dark:hover:bg-slate-800 dark:hover:text-blue-400 rounded-xl transition-colors",
                  profileMenuOpen && "bg-blue-800/20"
                )}
              >
                <User2Icon size={20} />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center gap-3 p-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-500/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-medium shrink-0">
                      {initials || 'OM'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-slate-900 dark:text-slate-100">{user?.name || 'Omni Agent'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user?.email || 'agent@econet.co.zw'}</p>
                    </div>
                  </div>

                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate('/settings', { state: { tab: 'profile' } });
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition-colors text-left"
                    >
                      <User size={16} />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors text-left"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Routed page content */}
        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <Outlet />
        </div>
      </main>

      <AIAssistant />
    </div>
  );
}

function NavItem({
  to, end, icon, label, collapsed,
}: { to: string, end?: boolean, icon: React.ReactNode, label: string, collapsed?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={collapsed ? label : undefined}
      className={({ isActive }) => cn(
        "flex items-center px-4 py-3 rounded-2xl transition-all",
        collapsed ? "justify-center px-0" : "justify-between",
        isActive
          ? "bg-blue-800 dark:bg-blue-500/10 text-white dark:text-blue-400 font-semibold border border-blue-100 dark:border-blue-500/20 shadow-sm"
          : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
      )}
    >
      <div className={cn("flex items-center gap-3", collapsed && "gap-0")}>
        {icon}
        {!collapsed && <span className="text-sm">{label}</span>}
      </div>
    </NavLink>
  );
}
