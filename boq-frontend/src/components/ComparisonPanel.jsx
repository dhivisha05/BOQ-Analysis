import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, CheckCircle2, AlertTriangle, XCircle, Search,
  ArrowRight, Mail, SkipForward, GitCompare, RefreshCw,
  FileText, Layers, ChevronDown, ChevronUp, ArrowLeftRight,
  ShieldCheck, ShieldAlert, Filter, BarChart3, Eye,
  ChevronRight, Package, X
} from 'lucide-react';
import { boqService } from '../services/BoqService';

/* ── helpers ─────────────────────────────────────────────────── */
const SEV = {
  HIGH:   { bg: '#fef2f2', color: '#ef4444', border: '#fecaca', label: 'High',   icon: XCircle },
  MEDIUM: { bg: '#fffbeb', color: '#f59e0b', border: '#fde68a', label: 'Medium', icon: AlertTriangle },
  LOW:    { bg: '#f0f9ff', color: '#3b82f6', border: '#bfdbfe', label: 'Low',    icon: AlertTriangle },
};

const TYPE_LABEL = {
  SPEC_MISMATCH:  'Spec Mismatch',
  QTY_MISMATCH:   'Qty Mismatch',
  MISSING_IN_BOQ: 'Missing in BOQ',
  MISSING_IN_CAD: 'Missing in CAD',
};

/* ═══════════════════════════════════════════════════════════════ */
/*  Score Ring                                                     */
/* ═══════════════════════════════════════════════════════════════ */
function ScoreRing({ score, size = 100 }) {
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s ease' }} />
      </svg>
      <div className="relative text-center z-10">
        <span className="text-2xl font-extrabold" style={{ color }}>{score}%</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Material List Item                                             */
/* ═══════════════════════════════════════════════════════════════ */
function MaterialItem({ item, status, side }) {
  const colors = {
    matched: { dot: '#10b981', bg: '#f0fdf4' },
    missing: { dot: '#ef4444', bg: '#fef2f2' },
    issue:   { dot: '#f59e0b', bg: '#fffbeb' },
    normal:  { dot: '#94a3b8', bg: 'transparent' },
  };
  const c = colors[status] || colors.normal;

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-slate-50 last:border-0
                    hover:bg-slate-50/60 transition-colors group">
      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: c.dot }} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-slate-700 leading-snug truncate">
          {item.description}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {side === 'boq' && (
            <span className="text-[11px] text-slate-400">
              {item.quantity ?? '—'} {item.unit || ''}
            </span>
          )}
          {side === 'cad' && item.zone && (
            <span className="text-[11px] text-slate-400 truncate max-w-[160px]">{item.zone}</span>
          )}
          {item.category && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
              {item.category}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Issue Row                                                      */
/* ═══════════════════════════════════════════════════════════════ */
function IssueRow({ issue }) {
  const sev = SEV[issue.severity] || SEV.LOW;
  const Icon = sev.icon;
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all hover:shadow-sm"
      style={{ background: sev.bg, borderColor: sev.border }}>
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: sev.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: sev.color }}>
            {TYPE_LABEL[issue.issue_type] || issue.issue_type?.replace(/_/g, ' ')}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: sev.color + '15', color: sev.color }}>
            {sev.label}
          </span>
        </div>
        <p className="text-[13px] text-slate-600 leading-snug">{issue.message}</p>
        {issue.recommendation && (
          <p className="text-[11px] text-slate-400 mt-1 italic">{issue.recommendation}</p>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════ */
/*  MAIN COMPONENT                                                 */
/* ═══════════════════════════════════════════════════════════════ */
export default function ComparisonPanel({
  boqItems = [], cadItems = [], projectName = 'Construction Project',
  boqFilename = 'BOQ.xlsx', cadFilename = 'Drawing.dwg',
  currentUser = null, onApproved, onNeedsReview,
}) {
  const [compResult, setCompResult]     = useState(null);
  const [comparing, setComparing]       = useState(false);
  const [error, setError]               = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent]       = useState(false);
  const [emailResult, setEmailResult]   = useState(null);
  const [boqSearch, setBoqSearch]       = useState('');
  const [cadSearch, setCadSearch]       = useState('');
  const [issueFilter, setIssueFilter]   = useState('ALL');   // ALL | HIGH | MEDIUM | LOW
  const [issuesOpen, setIssuesOpen]     = useState(true);
  const hasRun = useRef(false);

  useEffect(() => {
    if (cadItems.length > 0 && boqItems.length > 0 && !hasRun.current && !compResult) {
      hasRun.current = true;
      runComparison();
    }
  }, [cadItems.length, boqItems.length]);

  /* ── compare ─────────────────────────────────────────────────── */
  const runComparison = async () => {
    setComparing(true);
    setError('');
    try {
      const result = await boqService.compare({ boqItems, cadItems, projectName, boqFilename, cadFilename });
      setCompResult(result);
      if (result.issues_count > 0) {
        onNeedsReview?.(result);
        _autoSendReport(result);
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Comparison failed.');
    } finally {
      setComparing(false);
    }
  };

  const _autoSendReport = async (result) => {
    setSendingEmail(true);
    try {
      const res = await boqService.sendComparisonReportToSelf({
        subject: result.email_subject || `BOQ vs CAD Review — ${projectName}`,
        reportBody: result.email_body || '',
        projectName,
      });
      setEmailResult(res);
      setEmailSent(true);
    } catch (err) {
      setEmailResult({ success: false, error: err.message });
    } finally {
      setSendingEmail(false);
    }
  };

  /* ── Empty state: no CAD data ───────────────────────────────── */
  if (cadItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
          <GitCompare size={36} className="text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-600 mb-2">No CAD data available</h3>
        <p className="text-sm text-slate-400 text-center max-w-sm">
          Go to the <strong>CAD Extraction</strong> tab first and upload a drawing file.
        </p>
      </div>
    );
  }

  /* ── Loading state ──────────────────────────────────────────── */
  if (comparing) {
    return (
      <div className="flex flex-col items-center justify-center py-28">
        <div className="relative mb-8">
          <div className="w-20 h-20 rounded-full border-4 border-slate-200 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ArrowLeftRight size={22} className="text-indigo-500" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-2">Analysing documents...</h3>
        <p className="text-sm text-slate-400">
          Comparing {boqItems.length} BOQ items with {cadItems.length} CAD materials
        </p>
        <div className="flex gap-3 mt-6">
          <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-medium">
            <CheckCircle2 size={12} className="inline mr-1" />BOQ
          </span>
          <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-medium">
            <CheckCircle2 size={12} className="inline mr-1" />CAD
          </span>
          <span className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-medium">
            <Loader2 size={12} className="inline mr-1 animate-spin" />AI matching
          </span>
        </div>
      </div>
    );
  }

  /* ── Error state ────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <h3 className="text-base font-semibold text-red-600 mb-2">Comparison failed</h3>
        <p className="text-sm text-slate-400 mb-5 max-w-sm text-center">{error}</p>
        <button onClick={() => { hasRun.current = false; runComparison(); }}
          className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  /* ── Not run yet ────────────────────────────────────────────── */
  if (!compResult) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <button onClick={runComparison}
          className="flex items-center gap-2 text-base font-semibold px-8 py-3.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 shadow-lg transition-colors">
          <GitCompare size={18} /> Run Comparison
        </button>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════ */
  /*  RESULTS                                                       */
  /* ═══════════════════════════════════════════════════════════════ */
  const {
    matched_count = 0, issues = [], issues_count = 0,
    is_approved, match_score = 0, total_boq_items = 0, total_cad_items = 0,
  } = compResult;

  const highCount = issues.filter(i => i.severity === 'HIGH').length;
  const medCount  = issues.filter(i => i.severity === 'MEDIUM').length;
  const lowCount  = issues.filter(i => i.severity === 'LOW').length;

  // Status lookup
  const missingInCadSet = new Set(issues.filter(i => i.issue_type === 'MISSING_IN_CAD').map(i => i.boq_item?.description));
  const missingInBoqSet = new Set(issues.filter(i => i.issue_type === 'MISSING_IN_BOQ').map(i => i.cad_item?.description));
  const issueBoqSet     = new Set(issues.filter(i => i.boq_item).map(i => i.boq_item.description));

  const getBoqStatus = (item) => {
    if (missingInCadSet.has(item.description)) return 'missing';
    if (issueBoqSet.has(item.description)) return 'issue';
    return 'matched';
  };
  const getCadStatus = (item) => {
    if (missingInBoqSet.has(item.description)) return 'missing';
    return 'matched';
  };

  const filteredBoq = boqItems.filter(it =>
    !boqSearch || it.description?.toLowerCase().includes(boqSearch.toLowerCase())
      || it.category?.toLowerCase().includes(boqSearch.toLowerCase())
  );
  const filteredCad = cadItems.filter(it =>
    !cadSearch || it.description?.toLowerCase().includes(cadSearch.toLowerCase())
      || it.category?.toLowerCase().includes(cadSearch.toLowerCase())
      || it.zone?.toLowerCase().includes(cadSearch.toLowerCase())
  );

  const filteredIssues = issueFilter === 'ALL'
    ? issues
    : issues.filter(i => i.severity === issueFilter);

  const scoreColor = match_score >= 80 ? '#10b981' : match_score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  HEADER CARD                                               */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="px-6 py-5 flex items-center gap-6">

          {/* Score */}
          <ScoreRing score={match_score} size={88} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-slate-800">BOQ vs CAD Comparison</h3>
            <div className="flex items-center gap-2 text-[13px] text-slate-400 mt-1 flex-wrap">
              <FileText size={13} />
              <span className="truncate max-w-[200px]">{boqFilename}</span>
              <span className="text-slate-300">vs</span>
              <Layers size={13} />
              <span className="truncate max-w-[200px]">{cadFilename}</span>
            </div>
            {is_approved && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-emerald-600 font-medium">
                <ShieldCheck size={14} /> All checks passed
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2">
            {[
              { val: matched_count, label: 'Matched', bg: '#f0fdf4', color: '#10b981' },
              { val: highCount,     label: 'High',    bg: '#fef2f2', color: '#ef4444' },
              { val: medCount,      label: 'Medium',  bg: '#fffbeb', color: '#f59e0b' },
              { val: lowCount,      label: 'Low',     bg: '#f0f9ff', color: '#3b82f6' },
            ].map(s => (
              <div key={s.label} className="text-center px-4 py-2 rounded-xl" style={{ background: s.bg }}>
                <p className="text-xl font-bold" style={{ color: s.color }}>{s.val}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider mt-0.5"
                  style={{ color: s.color + 'aa' }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  SPLIT TWO-PANEL VIEW                                      */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── BOQ Panel ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <FileText size={15} className="text-blue-500" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700">BOQ Materials</h4>
                <p className="text-[11px] text-slate-400">{total_boq_items} items</p>
              </div>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input type="text" placeholder="Search..." value={boqSearch}
                onChange={e => setBoqSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50
                           text-slate-600 w-36 focus:outline-none focus:ring-1 focus:ring-blue-200" />
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 py-2 border-b border-slate-50 flex items-center gap-4">
            {[
              { label: 'Matched', color: '#10b981' },
              { label: 'Issue', color: '#f59e0b' },
              { label: 'Missing', color: '#ef4444' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 480 }}>
            {filteredBoq.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No items match</p>
            ) : filteredBoq.map((item, i) => (
              <MaterialItem key={i} item={item} status={getBoqStatus(item)} side="boq" />
            ))}
          </div>
        </div>

        {/* ── CAD Panel ───────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <Layers size={15} className="text-violet-500" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-700">CAD Materials</h4>
                <p className="text-[11px] text-slate-400">{total_cad_items} items</p>
              </div>
            </div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" />
              <input type="text" placeholder="Search..." value={cadSearch}
                onChange={e => setCadSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50
                           text-slate-600 w-36 focus:outline-none focus:ring-1 focus:ring-violet-200" />
            </div>
          </div>

          {/* Legend */}
          <div className="px-4 py-2 border-b border-slate-50 flex items-center gap-4">
            {[
              { label: 'Matched', color: '#10b981' },
              { label: 'Missing in BOQ', color: '#ef4444' },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>

          {/* Scrollable list */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: 480 }}>
            {filteredCad.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No items match</p>
            ) : filteredCad.map((item, i) => (
              <MaterialItem key={i} item={item} status={getCadStatus(item)} side="cad" />
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  ISSUES SECTION (below, scrollable)                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Toggle header */}
        <button onClick={() => setIssuesOpen(!issuesOpen)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
          <div className="flex items-center gap-3">
            {issues_count === 0
              ? <ShieldCheck size={18} className="text-emerald-500" />
              : <ShieldAlert size={18} className="text-amber-500" />}
            <span className="text-sm font-semibold text-slate-700">
              {issues_count === 0
                ? 'No issues — BOQ and CAD are aligned'
                : `${issues_count} issue${issues_count !== 1 ? 's' : ''} detected`}
            </span>
            {issues_count > 0 && (
              <div className="flex gap-1.5 ml-1">
                {highCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-500">{highCount} high</span>}
                {medCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-500">{medCount} med</span>}
                {lowCount > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-500">{lowCount} low</span>}
              </div>
            )}
          </div>
          {issues_count > 0 && (
            issuesOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {issuesOpen && issues_count > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {/* Severity filter tabs */}
              <div className="px-5 py-2.5 border-t border-slate-100 flex items-center gap-2">
                <Filter size={12} className="text-slate-400" />
                {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
                  <button key={f}
                    onClick={() => setIssueFilter(f)}
                    className={`text-[11px] font-semibold px-3 py-1 rounded-lg transition-colors ${
                      issueFilter === f
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}>
                    {f === 'ALL' ? `All (${issues_count})` : `${f.charAt(0) + f.slice(1).toLowerCase()} (${
                      f === 'HIGH' ? highCount : f === 'MEDIUM' ? medCount : lowCount
                    })`}
                  </button>
                ))}
              </div>

              {/* Issue list */}
              <div className="border-t border-slate-50 px-5 py-4 space-y-2.5 overflow-y-auto"
                style={{ maxHeight: 380 }}>
                {filteredIssues.map((issue, i) => (
                  <IssueRow key={i} issue={issue} />
                ))}
                {filteredIssues.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-6">No issues in this category</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*  FOOTER: Email + Navigation                                */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 space-y-3">
        {/* Email status */}
        {issues_count > 0 && (
          <>
            {sendingEmail && (
              <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-blue-50 border border-blue-100">
                <Loader2 size={14} className="text-blue-500 animate-spin" />
                <p className="text-sm text-blue-600 font-medium">Sending report...</p>
              </div>
            )}
            {emailSent && emailResult?.success && (
              <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <div>
                    <p className="text-sm text-emerald-700 font-medium">Report sent to your email</p>
                    <p className="text-[11px] text-emerald-500">{emailResult.sent_to || currentUser?.email}</p>
                  </div>
                </div>
                <Mail size={14} className="text-emerald-300" />
              </div>
            )}
            {emailSent && !emailResult?.success && (
              <div className="flex items-center justify-between rounded-xl px-4 py-3 bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-500" />
                  <p className="text-sm text-amber-600 font-medium">Email delivery failed</p>
                </div>
                <button onClick={() => compResult && _autoSendReport(compResult)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200">
                  Retry
                </button>
              </div>
            )}
          </>
        )}

        {/* Nav buttons */}
        <div className="flex items-center justify-between">
          <button onClick={() => onApproved?.()}
            className="text-sm flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors">
            <SkipForward size={13} /> Skip to Vendors
          </button>
          <div className="flex items-center gap-2 text-sm text-amber-600 font-medium">
            {issues_count > 0 && <span>{issues_count} issues found</span>}
          </div>
          <button onClick={() => onApproved?.()}
            className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl
                       bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-sm">
            Proceed to Vendors <ArrowRight size={14} />
          </button>
        </div>
      </div>

    </motion.div>
  );
}
