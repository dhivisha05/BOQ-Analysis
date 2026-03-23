import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FolderKanban, Users, AlertTriangle, TrendingUp, Activity,
  Package, MessageSquare, CheckCircle, FolderPlus, Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useActivity } from '../hooks/useActivity';
import Layout from '../components/Layout';

const ACTIVITY_ICONS = {
  boq_complete: { icon: Package, color: 'text-blue-500 bg-blue-50' },
  vendor_quote: { icon: MessageSquare, color: 'text-emerald-500 bg-emerald-50' },
  comparison_issue: { icon: AlertTriangle, color: 'text-amber-500 bg-amber-50' },
  vendor_verified: { icon: CheckCircle, color: 'text-green-500 bg-green-50' },
  project_created: { icon: FolderPlus, color: 'text-indigo-500 bg-indigo-50' },
};

function StatCard({ icon: Icon, label, value, change, color }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        {change !== undefined && (
          <span className={`text-xs font-medium ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </motion.div>
  );
}

export default function NewDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { activities } = useActivity();
  const [stats, setStats] = useState({ projects: 0, active: 0, vendors: 0, budget: 0 });
  const [urgentActions, setUrgentActions] = useState([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [projRes, vendorRes] = await Promise.all([
        supabase.from('projects').select('id, status, budget, deadline', { count: 'exact' }),
        supabase.from('vendors').select('id', { count: 'exact' }),
      ]);
      const projects = projRes.data || [];
      const activeCount = projects.filter(p => p.status === 'active').length;
      const totalBudget = projects.reduce((s, p) => s + (Number(p.budget) || 0), 0);
      setStats({
        projects: projects.length,
        active: activeCount,
        vendors: vendorRes.count || 0,
        budget: totalBudget,
      });

      // Urgent: projects with deadline < 3 days
      const urgent = [];
      const now = new Date();
      projects.forEach(p => {
        if (p.deadline && p.status === 'active') {
          const days = Math.ceil((new Date(p.deadline) - now) / 86400000);
          if (days <= 3 && days >= 0) {
            urgent.push({ type: 'deadline', severity: 'high', text: `Deadline in ${days} day${days !== 1 ? 's' : ''}`, projectId: p.id });
          }
        }
      });
      setUrgentActions(urgent);
    })();
  }, [user]);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-400">Welcome back, {user?.full_name?.split(' ')[0] || 'Engineer'}</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
          <StatCard icon={FolderKanban} label="Total Projects" value={stats.projects} color="bg-blue-50 text-blue-600" />
          <StatCard icon={TrendingUp} label="Active Projects" value={stats.active} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Users} label="Total Vendors" value={stats.vendors} color="bg-purple-50 text-purple-600" />
          <StatCard icon={TrendingUp} label="Total Budget"
            value={stats.budget > 0 ? `${(stats.budget / 100000).toFixed(1)}L` : '0'}
            color="bg-amber-50 text-amber-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Urgent Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-700">Urgent Actions</h3>
              {urgentActions.length > 0 && (
                <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{urgentActions.length}</span>
              )}
            </div>
            {urgentActions.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle size={18} className="text-emerald-500" />
                </div>
                <p className="text-sm text-slate-500">All clear - no urgent actions</p>
              </div>
            ) : (
              <div className="space-y-2">
                {urgentActions.map((a, i) => (
                  <button key={i} onClick={() => navigate(`/projects/${a.projectId}`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-50 text-left hover:bg-red-100 transition">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm text-red-700">{a.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Project Pipeline */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-700">Project Pipeline</h3>
            </div>
            <div className="space-y-3">
              {stats.projects === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">No projects yet</p>
              ) : (
                <button onClick={() => navigate('/projects')}
                  className="w-full text-center py-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View all {stats.projects} projects
                </button>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={16} className="text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-700">Recent Activity</h3>
            </div>
            {activities.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No recent activity</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {activities.slice(0, 10).map(a => {
                  const config = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.project_created;
                  const Icon = config.icon;
                  return (
                    <div key={a.id} className="flex items-start gap-2.5 py-1.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                        <Icon size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-600 truncate">{a.title}</p>
                        <p className="text-[11px] text-slate-300 flex items-center gap-1">
                          <Clock size={10} />
                          {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
