import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, Layers, BarChart3, Users, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import BoqService from '../services/BoqService';
import Layout from '../components/Layout';
import UploadZone from '../components/UploadZone';
import ResultsDashboard from '../components/ResultsDashboard';
import DataTable from '../components/DataTable';
import CategorySidebar from '../components/CategorySidebar';
import CadExtractPanel from '../components/CadExtractPanel';
import ComparisonPanel from '../components/ComparisonPanel';
import VendorMailPanel from '../components/VendorMailPanel';

const TABS = [
  { id: 'boq', label: 'BOQ Extraction', icon: FileSpreadsheet },
  { id: 'cad', label: 'CAD Analysis', icon: Layers },
  { id: 'compare', label: 'Comparison', icon: BarChart3 },
  { id: 'vendors', label: 'Vendors', icon: Users },
];

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('boq');

  // BOQ extraction state
  const [boqResult, setBoqResult] = useState(null);
  const [cadResult, setCadResult] = useState(null);
  const [cadFile, setCadFile] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);

  // Stable items references
  const boqItems = useMemo(() => boqResult?.items || [], [boqResult]);
  const cadItems = useMemo(() => cadResult?.items || [], [cadResult]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (error) { toast.error('Project not found'); navigate('/projects'); return; }
      setProject(data);
      setLoading(false);
    })();
  }, [id, navigate]);

  const handleBoqUpload = async (file) => {
    setExtracting(true);
    setExtractError(null);
    try {
      const data = await BoqService.extractLangGraph(file);
      setBoqResult(data);
      toast.success(`Extracted ${data.extracted_items || data.items?.length || 0} materials`);
    } catch (err) {
      setExtractError(err.response?.data?.detail || err.message || 'Failed to extract materials');
      toast.error('Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/projects')}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">{project.project_name}</h1>
            <p className="text-sm text-slate-400">{project.project_type} {project.client ? `- ${project.client}` : ''}</p>
          </div>
          <span className="ml-auto text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
            {project.status}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'boq' && (
          <div>
            {!boqResult ? (
              <div className="max-w-2xl mx-auto">
                <UploadZone onUpload={handleBoqUpload} loading={extracting} error={extractError} />
              </div>
            ) : (
              <div className="space-y-4">
                <ResultsDashboard results={boqResult} />
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                  <div className="xl:col-span-1">
                    <CategorySidebar
                      categories={boqResult.categories || {}}
                      activeCategory={activeCategory}
                      onCategoryChange={setActiveCategory}
                    />
                  </div>
                  <div className="xl:col-span-4">
                    <DataTable
                      items={boqResult.items || []}
                      activeCategory={activeCategory}
                      title="BOQ Extracted Materials"
                    />
                  </div>
                </div>
                <button onClick={() => { setBoqResult(null); setActiveCategory(null); }}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200">
                  <Upload size={14} /> Upload New BOQ
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'cad' && (
          <CadExtractPanel
            existingCadData={cadResult}
            existingCadFile={cadFile}
            onExtracted={(data, file) => { setCadResult(data); setCadFile(file); }}
            onGoToCompare={() => setTab('compare')}
            onSkip={() => setTab('vendors')}
          />
        )}

        {tab === 'compare' && (
          <ComparisonPanel
            boqItems={boqItems}
            cadItems={cadItems}
            projectName={project?.project_name || 'Construction Project'}
            currentUser={user}
            onApproved={() => setTab('vendors')}
            onNeedsReview={() => {}}
          />
        )}

        {tab === 'vendors' && (
          <VendorMailPanel
            items={boqItems}
            projectName={project?.project_name || 'Construction Project'}
            currentUser={user}
          />
        )}
      </div>
    </Layout>
  );
}
