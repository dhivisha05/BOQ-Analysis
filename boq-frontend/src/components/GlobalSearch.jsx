import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, FolderKanban, Users, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getMyVendors } from '../services/vendorService';

function normalizeProjectRecord(project = {}, index = 0) {
  return {
    ...project,
    id: project.id || project.project_id || project.uuid || `project-${index}`,
    project_name: project.project_name || project.name || project.title || 'Untitled Project',
    project_type: project.project_type || project.type || '',
    status: project.status || 'active',
  };
}

function normalizeVendorRecord(vendor = {}, index = 0) {
  return {
    ...vendor,
    id: vendor.id || vendor.vendor_id || vendor.uuid || `vendor-${index}`,
    company_name: vendor.company_name || vendor.name || vendor.company || 'Unnamed Vendor',
    categories: Array.isArray(vendor.categories)
      ? vendor.categories
      : String(vendor.categories || vendor.category || '')
          .split(/[;,/]/)
          .map((item) => item.trim())
          .filter(Boolean),
    status: vendor.status || 'active',
  };
}

export default function GlobalSearch({ onClose }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ projects: [], vendors: [], materials: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults({ projects: [], vendors: [], materials: [] }); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const [projectRes, vendorRes, boqRes] = await Promise.all([
        supabase.from('projects').select('*').limit(80),
        user?.id ? getMyVendors(user.id) : Promise.resolve([]),
        supabase.from('boq_items').select('id,description,project_id,category').ilike('description', `%${query}%`).limit(5),
      ]);

      if (projectRes.error) console.error('[GlobalSearch] Projects error:', projectRes.error.message);
      if (boqRes.error) console.error('[GlobalSearch] BOQ search error:', boqRes.error.message);

      const normalizedProjects = (projectRes.data || []).map((project, index) => normalizeProjectRecord(project, index));
      const normalizedVendors = (vendorRes || []).map((vendor, index) => normalizeVendorRecord(vendor, index));
      const q = query.toLowerCase();

      setResults({
        projects: normalizedProjects.filter((project) =>
          project.project_name.toLowerCase().includes(q)
        ).slice(0, 5),
        vendors: normalizedVendors.filter((vendor) =>
          vendor.company_name.toLowerCase().includes(q)
        ).slice(0, 5),
        materials: boqRes.data || [],
      });
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, user?.id]);

  const go = (path) => { navigate(path); onClose(); };
  const total = results.projects.length + results.vendors.length + results.materials.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search size={18} className="text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search projects, vendors, materials..."
            className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none bg-transparent"
          />
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.length < 2 && (
            <p className="text-sm text-slate-400 text-center py-8">Type at least 2 characters to search...</p>
          )}
          {query.length >= 2 && !loading && total === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No results for "{query}"</p>
          )}

          {results.projects.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">Projects</p>
              {results.projects.map((p, index) => (
                <button key={`${p.id}-${index}`} onClick={() => go(p.id ? `/projects/${p.id}` : '/projects')}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left">
                  <FolderKanban size={16} className="text-blue-500" />
                  <span className="text-sm text-slate-700">{p.project_name}</span>
                  <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{p.status}</span>
                </button>
              ))}
            </div>
          )}

          {results.vendors.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">Vendors</p>
              {results.vendors.map((v, index) => (
                <button key={`${v.id}-${index}`} onClick={() => go('/vendors')}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left">
                  <Users size={16} className="text-emerald-500" />
                  <span className="text-sm text-slate-700">{v.company_name}</span>
                </button>
              ))}
            </div>
          )}

          {results.materials.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">Materials</p>
              {results.materials.map(m => (
                <button key={m.id} onClick={() => go(`/projects/${m.project_id}`)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 text-left">
                  <Package size={16} className="text-amber-500" />
                  <span className="text-sm text-slate-700 truncate">{m.description}</span>
                  <span className="ml-auto text-[11px] text-slate-400">{m.category}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
          <span><kbd className="bg-slate-100 px-1 rounded">Esc</kbd> to close</span>
          <span><kbd className="bg-slate-100 px-1 rounded">Enter</kbd> to select</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
