import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Package, MessageSquare, AlertTriangle, CheckCircle, FolderPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const TYPE_ICONS = {
  boq_complete: Package,
  vendor_quote: MessageSquare,
  comparison_issue: AlertTriangle,
  vendor_verified: CheckCircle,
  project_created: FolderPlus,
};
const TYPE_COLORS = {
  boq_complete: 'text-blue-500 bg-blue-50',
  vendor_quote: 'text-emerald-500 bg-emerald-50',
  comparison_issue: 'text-amber-500 bg-amber-50',
  vendor_verified: 'text-green-500 bg-green-50',
  project_created: 'text-indigo-500 bg-indigo-50',
};

export default function NotificationCenter({ onClose }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Fetch notifications
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      setNotifications(data || []);
      setLoading(false);
    })();

    // Realtime
    const channel = supabase.channel('notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = async (notif) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }
    if (notif.link) navigate(notif.link);
    onClose();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div ref={ref} className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Notifications</h3>
          {unreadCount > 0 && (
            <span className="text-[11px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">{unreadCount}</span>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-[11px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            <Check size={12} /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {loading && <p className="text-sm text-slate-400 text-center py-8">Loading...</p>}
        {!loading && notifications.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">No notifications yet</p>
            <p className="text-xs text-slate-300 mt-1">You're all caught up!</p>
          </div>
        )}
        {notifications.map(n => {
          const Icon = TYPE_ICONS[n.type] || Package;
          const color = TYPE_COLORS[n.type] || 'text-slate-500 bg-slate-50';
          return (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition ${!n.is_read ? 'bg-blue-50/30' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!n.is_read ? 'font-semibold text-slate-800' : 'text-slate-600'} truncate`}>{n.title}</p>
                {n.message && <p className="text-xs text-slate-400 truncate mt-0.5">{n.message}</p>}
                <p className="text-[11px] text-slate-300 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
