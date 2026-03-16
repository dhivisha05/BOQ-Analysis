import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Mail, Users, Package, ChevronDown, ChevronUp,
    CheckSquare, Square, Star, Send, Plus, X, Check
} from 'lucide-react';
import { boqService } from '../services/BoqService';

// ── Category color helper ──────────────────────────────────────────────────────
function getCategoryBadgeColor(category) {
    const map = {
        'Electrical':             '#3B82F6',
        'Plumbing & Drainage':    '#10B981',
        'Civil & Structural':     '#8B5CF6',
        'Mechanical & HVAC':      '#06B6D4',
        'Fire Protection':        '#EF4444',
        'Finishing & Interiors':  '#F97316',
        'External Development':   '#F59E0B',
        'IT & Communication':     '#EC4899',
    };
    for (const [key, color] of Object.entries(map)) {
        if (category?.includes(key.split(' ')[0])) return color;
    }
    return '#64748B';
}

// ── Vendor type badge ──────────────────────────────────────────────────────────
function VendorTypeBadge({ type }) {
    const styles = {
        recommended: { bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6', label: 'RECOMMENDED' },
        past:        { bg: 'rgba(16,185,129,0.15)',  color: '#10B981', label: 'PAST VENDOR'  },
        new:         { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B', label: 'NEW'           },
    };
    const s = styles[type] || styles.new;
    return (
        <span
            style={{ background: s.bg, color: s.color }}
            className="text-[9px] font-mono font-bold px-2 py-0.5 rounded"
        >
            {s.label}
        </span>
    );
}

// ── Star rating display ────────────────────────────────────────────────────────
function StarRating({ rating }) {
    return (
        <span className="flex items-center gap-0.5">
            <Star size={10} className="text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-mono text-slate-400">{rating}</span>
        </span>
    );
}

// ── Step header (collapsible) ──────────────────────────────────────────────────
function StepHeader({ number, title, icon: Icon, count, isOpen, onToggle }) {
    return (
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between px-4 py-3
                       hover:bg-slate-50 transition-colors rounded-t-lg"
        >
            <div className="flex items-center gap-3">
                <span
                    className="w-6 h-6 rounded-full flex items-center justify-center
                               text-xs font-mono font-bold"
                    style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}
                >
                    {number}
                </span>
                <Icon size={14} style={{ color: '#F59E0B' }} />
                <span className="text-sm font-medium text-slate-700">{title}</span>
                {count !== undefined && (
                    <span className="text-[10px] font-mono text-slate-400">
                        ({count} selected)
                    </span>
                )}
            </div>
            {isOpen
                ? <ChevronUp size={14} className="text-slate-400" />
                : <ChevronDown size={14} className="text-slate-400" />
            }
        </button>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function VendorMailPanel({ items = [], projectName = 'Construction Project' }) {
    const [selectedMaterials, setSelectedMaterials] = useState(new Set());
    const [vendors, setVendors]                     = useState([]);
    const [selectedVendors, setSelectedVendors]     = useState(new Set());
    const [vendorFilter, setVendorFilter]           = useState('all');
    const [manualEmail, setManualEmail]             = useState('');
    const [manualEmails, setManualEmails]           = useState([]);
    const [emailBody, setEmailBody]                 = useState('');
    const [editingEmail, setEditingEmail]           = useState(false);
    const [openStep, setOpenStep]                   = useState(1);
    const [sending, setSending]                     = useState(false);
    const [result, setResult]                       = useState(null);
    const [error, setError]                         = useState('');
    const [loadingVendors, setLoadingVendors]       = useState(false);

    // Select all materials by default on mount / when items change
    useEffect(() => {
        setSelectedMaterials(new Set(items.map((_, i) => i)));
    }, [items]);

    // Load vendors when filter changes
    useEffect(() => {
        setLoadingVendors(true);
        const filterType = vendorFilter === 'all' ? null : vendorFilter;
        boqService.getVendors(null, filterType)
            .then(data => setVendors(data.vendors || []))
            .catch(() => setVendors([]))
            .finally(() => setLoadingVendors(false));
    }, [vendorFilter]);

    // Recompute email body whenever selections change (unless user is editing)
    useEffect(() => {
        if (!editingEmail) {
            const selected = items.filter((_, i) => selectedMaterials.has(i));
            setEmailBody(buildEmailBody(selected, projectName));
        }
    }, [selectedMaterials, selectedVendors, manualEmails, items, projectName, editingEmail]);

    function buildEmailBody(selectedItems, projName) {
        const header = 'No.  Material Description                              Qty        Unit     Category';
        const divider = '-'.repeat(90);
        const rows = selectedItems.map((item, i) => {
            const qty  = item.quantity != null ? String(item.quantity) : 'TBD';
            const desc = (item.description || '').slice(0, 44).padEnd(44);
            const unit = (item.unit || '-').padEnd(8);
            const cat  = item.category || '';
            return `${String(i + 1).padEnd(4)} ${desc} ${qty.padStart(10)} ${unit} ${cat}`;
        });

        const today   = new Date();
        const replyBy = new Date(today.setDate(today.getDate() + 7))
            .toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

        return `Dear Vendor,

Greetings. We require the following materials for our project.

Project : ${projName}
Quote By: ${replyBy}

MATERIAL REQUIREMENTS:
${[header, divider, ...rows].join('\n')}

Please provide:
  \u2022 Unit rate (INR) with GST breakup
  \u2022 Delivery lead time
  \u2022 Quote validity

Reply to this email with your quotation.

Regards,
Project Manager
${projName}`;
    }

    // Toggle helpers
    const toggleMaterial = (i) => {
        setSelectedMaterials(prev => {
            const s = new Set(prev);
            s.has(i) ? s.delete(i) : s.add(i);
            return s;
        });
    };

    const toggleVendor = (id) => {
        setSelectedVendors(prev => {
            const s = new Set(prev);
            s.has(id) ? s.delete(id) : s.add(id);
            return s;
        });
    };

    const addManualEmail = () => {
        const email = manualEmail.trim();
        if (email && email.includes('@') && !manualEmails.includes(email)) {
            setManualEmails(prev => [...prev, email]);
            setManualEmail('');
        }
    };

    const allVendorEmails = [
        ...vendors.filter(v => selectedVendors.has(v.id)).map(v => v.email),
        ...manualEmails,
    ];

    const handleSend = async () => {
        if (allVendorEmails.length === 0) {
            setError('Please select at least one vendor.');
            return;
        }
        const selectedItems = items.filter((_, i) => selectedMaterials.has(i));
        if (selectedItems.length === 0) {
            setError('Please select at least one material.');
            return;
        }
        setSending(true);
        setError('');
        setResult(null);
        try {
            const res = await boqService.sendVendorQuoteEmail({
                vendorEmails: allVendorEmails,
                materials:    selectedItems,
                projectName,
            });
            setResult(res);
            setOpenStep(3);
        } catch {
            setError('Failed to send email. Check backend SMTP settings.');
        } finally {
            setSending(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
        >
            {/* Panel header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
                <Mail size={16} style={{ color: '#F59E0B' }} />
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-widest">
                    Send to Vendors
                </h3>
                <span className="text-[10px] font-mono text-slate-400 ml-auto">
                    {allVendorEmails.length} vendor(s) selected
                </span>
            </div>

            {/* ── STEP 1: Materials ─────────────────────────────────────────────── */}
            <div className="border-b border-slate-200">
                <StepHeader
                    number="1"
                    title="Select Materials to Share"
                    icon={Package}
                    count={selectedMaterials.size}
                    isOpen={openStep === 1}
                    onToggle={() => setOpenStep(openStep === 1 ? 0 : 1)}
                />
                <AnimatePresence initial={false}>
                    {openStep === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4">
                                {/* Select all / deselect all */}
                                <div className="flex gap-3 mb-3">
                                    <button
                                        onClick={() => setSelectedMaterials(new Set(items.map((_, i) => i)))}
                                        className="text-[11px] font-mono text-amber-500 hover:underline"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => setSelectedMaterials(new Set())}
                                        className="text-[11px] font-mono text-slate-400 hover:underline"
                                    >
                                        Deselect All
                                    </button>
                                    <span className="text-[11px] font-mono text-slate-400 ml-auto">
                                        {selectedMaterials.size} of {items.length} selected
                                    </span>
                                </div>

                                {/* Materials list */}
                                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                                    {items.map((item, i) => (
                                        <div
                                            key={i}
                                            onClick={() => toggleMaterial(i)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg
                                                cursor-pointer transition-colors text-sm
                                                ${selectedMaterials.has(i)
                                                    ? 'bg-amber-50 border border-amber-200'
                                                    : 'hover:bg-slate-50 border border-transparent'
                                                }`}
                                        >
                                            {selectedMaterials.has(i)
                                                ? <CheckSquare size={14} className="text-amber-500 shrink-0" />
                                                : <Square size={14} className="text-slate-300 shrink-0" />
                                            }
                                            <span className="flex-1 text-slate-700 truncate font-medium">
                                                {item.description}
                                            </span>
                                            <span className="font-mono text-[11px] text-slate-400 shrink-0">
                                                {item.quantity ?? 'TBD'} {item.unit || ''}
                                            </span>
                                            <span
                                                className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0"
                                                style={{
                                                    background: getCategoryBadgeColor(item.category) + '25',
                                                    color: getCategoryBadgeColor(item.category),
                                                }}
                                            >
                                                {item.category || 'General'}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setOpenStep(2)}
                                    className="mt-3 w-full py-2 rounded-lg border text-xs font-mono transition-colors"
                                    style={{
                                        background: 'rgba(245,158,11,0.1)',
                                        borderColor: 'rgba(245,158,11,0.3)',
                                        color: '#F59E0B',
                                    }}
                                >
                                    Next: Select Vendors →
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── STEP 2: Vendors ───────────────────────────────────────────────── */}
            <div className="border-b border-slate-200">
                <StepHeader
                    number="2"
                    title="Select Vendors"
                    icon={Users}
                    count={allVendorEmails.length}
                    isOpen={openStep === 2}
                    onToggle={() => setOpenStep(openStep === 2 ? 0 : 2)}
                />
                <AnimatePresence initial={false}>
                    {openStep === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-4">
                                {/* Filter tabs */}
                                <div className="flex gap-2 mb-3">
                                    {['all', 'recommended', 'past'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setVendorFilter(f)}
                                            className={`text-[11px] font-mono px-3 py-1 rounded-full
                                                transition-colors capitalize border
                                                ${vendorFilter === f
                                                    ? 'bg-amber-50 text-amber-600 border-amber-300'
                                                    : 'text-slate-400 hover:text-slate-600 border-slate-200'
                                                }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>

                                {/* Vendor list */}
                                <div className="max-h-56 overflow-y-auto space-y-1 mb-3 pr-1">
                                    {loadingVendors
                                        ? (
                                            <p className="text-xs text-slate-400 font-mono py-4 text-center">
                                                Loading vendors...
                                            </p>
                                        )
                                        : vendors.map(vendor => (
                                            <div
                                                key={vendor.id}
                                                onClick={() => toggleVendor(vendor.id)}
                                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
                                                    cursor-pointer transition-colors
                                                    ${selectedVendors.has(vendor.id)
                                                        ? 'bg-amber-50 border border-amber-200'
                                                        : 'hover:bg-slate-50 border border-transparent'
                                                    }`}
                                            >
                                                {selectedVendors.has(vendor.id)
                                                    ? <CheckSquare size={14} className="text-amber-500 shrink-0" />
                                                    : <Square size={14} className="text-slate-300 shrink-0" />
                                                }
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">
                                                        {vendor.name}
                                                    </p>
                                                    <p className="text-[10px] font-mono text-slate-400 truncate">
                                                        {vendor.email}
                                                    </p>
                                                </div>
                                                <StarRating rating={vendor.rating} />
                                                <VendorTypeBadge type={vendor.type} />
                                            </div>
                                        ))
                                    }
                                </div>

                                {/* Manual email input */}
                                <div className="flex gap-2 mb-3">
                                    <input
                                        type="email"
                                        value={manualEmail}
                                        onChange={e => setManualEmail(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addManualEmail()}
                                        placeholder="+ Add vendor email manually"
                                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5
                                                   text-xs font-mono text-slate-700 placeholder-slate-400
                                                   focus:outline-none focus:border-amber-400"
                                    />
                                    <button
                                        onClick={addManualEmail}
                                        className="px-3 py-1.5 rounded-lg border transition-colors"
                                        style={{
                                            background: 'rgba(245,158,11,0.1)',
                                            borderColor: 'rgba(245,158,11,0.3)',
                                            color: '#F59E0B',
                                        }}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                {/* Manual email chips */}
                                {manualEmails.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {manualEmails.map(email => (
                                            <span
                                                key={email}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded-full
                                                           bg-slate-100 border border-slate-200 text-[10px]
                                                           font-mono text-slate-600"
                                            >
                                                {email}
                                                <button
                                                    onClick={() =>
                                                        setManualEmails(prev => prev.filter(e => e !== email))
                                                    }
                                                >
                                                    <X size={10} className="text-slate-400 hover:text-red-500" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <button
                                    onClick={() => setOpenStep(3)}
                                    className="w-full py-2 rounded-lg border text-xs font-mono transition-colors"
                                    style={{
                                        background: 'rgba(245,158,11,0.1)',
                                        borderColor: 'rgba(245,158,11,0.3)',
                                        color: '#F59E0B',
                                    }}
                                >
                                    Next: Preview Email →
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── STEP 3: Email Preview + Send ──────────────────────────────────── */}
            <div>
                <StepHeader
                    number="3"
                    title="Email Preview & Send"
                    icon={Mail}
                    isOpen={openStep === 3}
                    onToggle={() => setOpenStep(openStep === 3 ? 0 : 3)}
                />
                <AnimatePresence initial={false}>
                    {openStep === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="px-4 pb-5">
                                {/* To */}
                                <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-mono text-slate-400 mb-1">TO:</p>
                                    <p className="text-xs font-mono text-slate-600 break-all">
                                        {allVendorEmails.join(', ') || 'No vendors selected'}
                                    </p>
                                </div>

                                {/* Subject */}
                                <div className="mb-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                    <p className="text-[10px] font-mono text-slate-400 mb-1">SUBJECT:</p>
                                    <p className="text-xs font-mono text-slate-700">
                                        Material Quote Request — {projectName}
                                    </p>
                                </div>

                                {/* Body */}
                                <div className="mb-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[10px] font-mono text-slate-400">BODY:</p>
                                        <button
                                            onClick={() => setEditingEmail(!editingEmail)}
                                            className="text-[10px] font-mono text-amber-500 hover:underline"
                                        >
                                            {editingEmail ? 'Done Editing' : 'Edit'}
                                        </button>
                                    </div>
                                    {editingEmail ? (
                                        <textarea
                                            value={emailBody}
                                            onChange={e => setEmailBody(e.target.value)}
                                            rows={12}
                                            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2
                                                       text-xs font-mono text-slate-700 resize-y
                                                       focus:outline-none focus:border-amber-500"
                                        />
                                    ) : (
                                        <pre
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg
                                                       px-3 py-2 text-[11px] font-mono text-slate-600
                                                       max-h-56 overflow-y-auto whitespace-pre-wrap"
                                        >
                                            {emailBody}
                                        </pre>
                                    )}
                                </div>

                                {/* Error */}
                                {error && (
                                    <p className="text-xs text-red-600 font-mono mb-3 px-3 py-2
                                                  bg-red-50 border border-red-200 rounded-lg">
                                        {error}
                                    </p>
                                )}

                                {/* Result */}
                                {result && (
                                    <div
                                        className={`mb-3 px-3 py-2 rounded-lg border text-xs font-mono
                                            ${result.success
                                                ? 'bg-green-50 border-green-200 text-green-700'
                                                : 'bg-amber-50 border-amber-200 text-amber-700'
                                            }`}
                                    >
                                        {result.success
                                            ? `✅ Sent to ${result.sent_to.length} vendor(s) successfully.`
                                            : '📋 SMTP not configured. Copy the email above and send manually.'
                                        }
                                    </div>
                                )}

                                {/* Send button */}
                                <button
                                    onClick={handleSend}
                                    disabled={sending || allVendorEmails.length === 0}
                                    className={`w-full py-2.5 rounded-lg flex items-center justify-center
                                               gap-2 text-sm font-mono font-semibold transition-all
                                               ${sending || allVendorEmails.length === 0
                                                   ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                                                   : 'bg-amber-400 hover:bg-amber-500 text-white cursor-pointer'
                                               }`}
                                >
                                    {sending ? (
                                        'Sending...'
                                    ) : (
                                        <>
                                            <Send size={14} />
                                            Send to {allVendorEmails.length} Vendor(s)
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
