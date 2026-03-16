import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 300000, // 5 minutes — AI takes time
});

const BoqService = {
  /** AI extraction with rule-based fallback + learning loop */
  extract(file, industry = 'construction') {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/upload-excel?industry=${industry}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  /** Rule-based extraction only (no AI, fast) */
  extractHeuristic(file, industry = 'construction') {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/extract?industry=${industry}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  /** Analyze extracted items */
  analyze(items) {
    return api.post('/analyze', { items }).then(res => res.data);
  },

  /** Risk assessment */
  getRisk(items) {
    return api.post('/risk', { items }).then(res => res.data);
  },

  /** Knowledge graph stats */
  getGraphStats() {
    return api.get('/graph-stats').then(res => res.data);
  },

  /** LangGraph 6-agent pipeline (SRR + FAISS + LLM) */
  extractLangGraph(file, industry = 'construction') {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/extract-langgraph?industry=${industry}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(res => res.data);
  },

  /** Fetch vendor list — optionally filter by category and type */
  getVendors: async (category = null, type = null) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (type) params.append('type', type);
    const url = `/vendors${params.toString() ? '?' + params.toString() : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  /** Send quote request email to selected vendors */
  sendVendorQuoteEmail: async ({
    vendorEmails,
    materials,
    projectName = 'Construction Project',
    requesterName = 'Project Manager',
    requesterEmail = '',
    replyByDays = 7,
  }) => {
    const response = await api.post('/email/vendor-quote', {
      vendor_emails: vendorEmails,
      materials: materials,
      project_name: projectName,
      requester_name: requesterName,
      requester_email: requesterEmail,
      reply_by_days: replyByDays,
    });
    return response.data;
  },
};

export default BoqService;
export const boqService = BoqService;
