import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Mail, Phone, MapPin, MoreVertical, Edit, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useVendors } from '../hooks/useVendors';
import Layout from '../components/Layout';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';

const CATEGORIES = ['Civil', 'Electrical', 'Plumbing', 'HVAC', 'Firefighting', 'Finishing', 'Structural', 'MEP'];

function VendorModal({ vendor, onClose, onSave }) {
  const isEdit = !!vendor?.id;
  const [form, setForm] = useState({
    company_name: vendor?.company_name || '',
    contact_name: vendor?.contact_name || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    location: vendor?.location || '',
    gst_number: vendor?.gst_number || '',
    categories: vendor?.categories || [],
    notes: vendor?.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleCat = (cat) => {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) return toast.error('Company name is required');
    setSaving(true);
    try {
      await onSave(form);
      toast.success(isEdit ? 'Vendor updated' : 'Vendor added');
      onClose();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">{isEdit ? 'Edit Vendor' : 'Add Vendor'}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input value={form.company_name} onChange={e => set('company_name', e.target.value)}
            placeholder="Company Name *" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
            placeholder="Contact Person" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="grid grid-cols-2 gap-3">
            <input value={form.email} onChange={e => set('email', e.target.value)} type="email"
              placeholder="Email" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="Phone" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.location} onChange={e => set('location', e.target.value)}
              placeholder="Location" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={form.gst_number} onChange={e => set('gst_number', e.target.value)}
              placeholder="GST Number" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Categories</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <button type="button" key={c} onClick={() => toggleCat(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    form.categories.includes(c) ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>{c}</button>
              ))}
            </div>
          </div>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
            placeholder="Notes" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Vendor'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

export default function VendorsPage() {
  const { vendors, loading, addVendor, updateVendor, deleteVendor } = useVendors();
  const [showModal, setShowModal] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState(null);

  const filtered = vendors.filter(v =>
    !search || v.company_name.toLowerCase().includes(search.toLowerCase()) ||
    v.contact_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Vendors</h1>
            <p className="text-sm text-slate-400">{vendors.length} vendors in database</p>
          </div>
          <button onClick={() => { setEditVendor(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition">
            <Plus size={16} /> Add Vendor
          </button>
        </div>

        <div className="relative mb-5 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..."
            className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm w-full focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No vendors added"
            description="Add vendors to send quote requests and manage procurement"
            action={() => setShowModal(true)} actionLabel="Add Vendor" />
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Company</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden md:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Categories</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden sm:table-cell">Location</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(v => (
                    <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{v.company_name}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          {v.email && <span className="flex items-center gap-1"><Mail size={11} />{v.email}</span>}
                          {v.phone && <span className="flex items-center gap-1"><Phone size={11} />{v.phone}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{v.contact_name || '-'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(v.categories || []).slice(0, 3).map(c => (
                            <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{c}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                        {v.location && <span className="flex items-center gap-1"><MapPin size={12} />{v.location}</span>}
                      </td>
                      <td className="px-2 py-3 relative">
                        <button onClick={() => setMenuId(menuId === v.id ? null : v.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                          <MoreVertical size={16} />
                        </button>
                        {menuId === v.id && (
                          <div className="absolute right-2 top-10 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-10">
                            <button onClick={() => { setEditVendor(v); setShowModal(true); setMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                              <Edit size={14} /> Edit
                            </button>
                            <button onClick={() => { setDeleteTarget(v); setMenuId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50">
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showModal && (
          <VendorModal vendor={editVendor} onClose={() => { setShowModal(false); setEditVendor(null); }}
            onSave={async (data) => editVendor?.id ? updateVendor(editVendor.id, data) : addVendor(data)} />
        )}
        {deleteTarget && (
          <ConfirmDialog title="Delete Vendor"
            message={`Delete "${deleteTarget.company_name}"? This cannot be undone.`}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={async () => { await deleteVendor(deleteTarget.id); setDeleteTarget(null); toast.success('Vendor deleted'); }} />
        )}
      </AnimatePresence>
    </Layout>
  );
}
