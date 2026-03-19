import { motion } from 'framer-motion';
import {
  motionEase,
  panelVariants,
  subtleButtonMotion,
} from '../lib/motion';

const CATEGORY_COLORS = {
  'Civil & Structural':    '#2563eb',
  'Plumbing & Drainage':   '#0891b2',
  'Electrical':            '#d97706',
  'HVAC':                  '#0d9488',
  'Firefighting':          '#dc2626',
  'Finishing & Interior':  '#7c3aed',
  'External Works':        '#16a34a',
  'Mechanical & HVAC':     '#0d9488',
  'Fire Protection':       '#dc2626',
  'Other':                 '#64748b',
  'Uncategorized':         '#94a3b8',
};

function getColor(cat) {
  if (!cat) return '#94a3b8';
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (cat.toLowerCase().includes(key.split(' ')[0].toLowerCase())) return color;
  }
  return '#64748b';
}

export default function CategorySidebar({ categories, activeCategory, onCategoryChange }) {
  if (!categories || Object.keys(categories).length === 0) return null;

  const entries = Object.entries(categories).sort((a, b) => b[1].length - a[1].length);
  const total   = entries.reduce((sum, [, items]) => sum + items.length, 0);
  const max     = entries[0]?.[1].length || 1;

  return (
    <motion.div
      variants={panelVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="text-xs font-semibold text-slate-400 tracking-widest uppercase">Categories</h3>
      </div>

      <div className="p-3 space-y-1">
        <motion.button
          {...subtleButtonMotion}
          onClick={() => onCategoryChange(null)}
          className="relative w-full text-left px-4 py-3 rounded-xl transition-all duration-200 flex justify-between items-center group"
          style={{
            background: !activeCategory ? '#eff6ff' : 'transparent',
          }}
        >
          {!activeCategory && (
            <motion.span
              layoutId="category-active-pill"
              transition={motionEase.spring}
              className="absolute inset-0 rounded-xl bg-blue-50"
            />
          )}
          <div className="relative flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
            <span className={`text-sm font-medium ${!activeCategory ? 'text-blue-700' : 'text-slate-600 group-hover:text-slate-800'}`}>
              All Trades
            </span>
          </div>
          <span className={`relative text-xs font-semibold px-2.5 py-1 rounded-full ${
            !activeCategory ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
          }`}>
            {total}
          </span>
        </motion.button>

        <div className="h-px bg-slate-100 mx-2 my-1" />

        {entries.map(([category, items]) => {
          const isActive   = activeCategory === category;
          const dotColor   = getColor(category);
          const barPercent = Math.round((items.length / max) * 100);

          return (
            <motion.button
              {...subtleButtonMotion}
              key={category}
              onClick={() => onCategoryChange(isActive ? null : category)}
              className="relative w-full text-left px-4 py-3 rounded-xl transition-all duration-200 group"
            >
              {isActive && (
                <motion.span
                  layoutId="category-active-pill"
                  transition={motionEase.spring}
                  className="absolute inset-0 rounded-xl"
                  style={{ background: dotColor + '10' }}
                />
              )}
              <div className="relative flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: dotColor }} />
                  <span className={`text-sm font-medium truncate max-w-[130px] ${
                    isActive ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-800'
                  }`}>
                    {category}
                  </span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-1"
                  style={{
                    background: isActive ? dotColor + '20' : '#f1f5f9',
                    color: isActive ? dotColor : '#64748b',
                  }}>
                  {items.length}
                </span>
              </div>

              <div className="relative h-1 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barPercent}%` }}
                  transition={{ duration: 0.35 }}
                  className="h-full rounded-full"
                  style={{ width: `${barPercent}%`, background: dotColor + '80' }} />
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
