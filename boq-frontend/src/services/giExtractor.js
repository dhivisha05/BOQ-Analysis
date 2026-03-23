import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_BOQ_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '';

const DASH = '[:\\-\\u2013\\u2014]';

const EMPTY = {
  project_name: '',
  client_name: '',
  project_type: '',
  location: '',
  estimated_value: '',
  currency: 'INR',
  deadline: '',
  description: '',
  contact_person: '',
  contact_email: '',
  tender_number: '',
  floors: '',
  area_sqm: '',
};

let backendWarned = false;
let pdfJsModulePromise = null;

function sanitize(value) {
  return value == null ? '' : String(value).trim();
}

function normalizePayload(payload = {}) {
  return {
    ...EMPTY,
    ...payload,
    project_name: sanitize(payload.project_name),
    client_name: sanitize(payload.client_name),
    project_type: sanitize(payload.project_type),
    location: sanitize(payload.location),
    estimated_value: sanitize(payload.estimated_value).replace(/,/g, ''),
    currency: sanitize(payload.currency) || 'INR',
    deadline: sanitize(payload.deadline),
    description: sanitize(payload.description),
    contact_person: sanitize(payload.contact_person),
    contact_email: sanitize(payload.contact_email),
    tender_number: sanitize(payload.tender_number),
    floors: sanitize(payload.floors),
    area_sqm: sanitize(payload.area_sqm).replace(/,/g, ''),
  };
}

function hasAnyStructuredField(data = {}) {
  const keys = [
    'project_name',
    'client_name',
    'project_type',
    'location',
    'estimated_value',
    'deadline',
    'description',
    'contact_email',
    'tender_number',
  ];
  return keys.some((key) => sanitize(data[key]));
}

export async function extractGeneralInfo(file) {
  if (!file) return { ...EMPTY };

  const backendResult = await extractFromBackend(file);
  if (backendResult && hasAnyStructuredField(backendResult)) {
    return backendResult;
  }

  const clientResult = await clientSideExtract(file);
  return normalizePayload(clientResult);
}

async function extractFromBackend(file) {
  if (!API_BASE_URL) {
    return null;
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${API_BASE_URL}/extract-general-info`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 45000,
    });
    const payload = response.data?.data ?? response.data ?? {};
    return normalizePayload(payload);
  } catch (error) {
    if (!backendWarned) {
      backendWarned = true;
      console.info('[GI Extractor] Backend extraction unavailable, using local parser.');
    }
    return null;
  }
}

async function clientSideExtract(file) {
  try {
    const text = await readPdfText(file);
    if (!text || text.length < 20) return { ...EMPTY };

    return normalizePayload({
      project_name: matchField(
        text,
        new RegExp(`(?:project\\s*(?:name|title)|name\\s*of\\s*work)\\s*${DASH}\\s*(.+)`, 'i')
      ),
      client_name: matchField(
        text,
        new RegExp(`(?:client|owner|employer|authority)\\s*${DASH}\\s*(.+)`, 'i')
      ),
      project_type: inferProjectType(text),
      location: matchField(
        text,
        new RegExp(`(?:location|site|address|place)\\s*${DASH}\\s*(.+)`, 'i')
      ),
      estimated_value:
        matchField(
          text,
          new RegExp(
            `(?:estimated\\s*(?:cost|value|budget)|project\\s*cost)\\s*${DASH}\\s*[\\u20B9$]?\\s*([\\d,.]+)`,
            'i'
          )
        )?.replace(/,/g, '') || '',
      currency: inferCurrency(text),
      deadline: matchDate(text),
      description: summarizeText(text),
      contact_person: matchField(
        text,
        new RegExp(
          `(?:contact\\s*person|engineer\\s*in\\s*charge|project\\s*manager)\\s*${DASH}\\s*(.+)`,
          'i'
        )
      ),
      contact_email: matchField(text, /[\w.-]+@[\w.-]+\.\w{2,}/),
      tender_number: matchField(
        text,
        new RegExp(`(?:tender|nit|ref(?:erence)?)\\s*(?:no|number|#)?\\s*${DASH}\\s*(.+)`, 'i')
      ),
      floors: matchField(text, /(\d+)\s*(?:floor|floors|storey|storeys|story|stories)\b/i),
      area_sqm:
        matchField(text, /([\d,]+)\s*(?:sq\.?\s*m|sqm|m2|m\u00B2)\b/i)?.replace(/,/g, '') || '',
    });
  } catch (error) {
    console.warn('[GI Extractor] Local PDF parsing failed:', error?.message || error);
    return { ...EMPTY };
  }
}

function matchField(text, regex) {
  const match = text.match(regex);
  if (!match) return '';
  return sanitize(match[1] || match[0]);
}

function matchDate(text) {
  const iso = text.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/);
  if (iso) return iso[1].replace(/\//g, '-');

  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (!dmy) return '';
  return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
}

function inferCurrency(text) {
  if (/\u20B9|INR/i.test(text)) return 'INR';
  if (/\$|USD/i.test(text)) return 'USD';
  if (/AED/i.test(text)) return 'AED';
  if (/SAR/i.test(text)) return 'SAR';
  return 'INR';
}

function inferProjectType(text) {
  const lower = text.toLowerCase();
  const typeMap = [
    ['hospital', 'Hospital'],
    ['office', 'Office'],
    ['residential', 'Residential'],
    ['industrial', 'Industrial'],
    ['government', 'Government'],
    ['school', 'Educational'],
    ['university', 'Educational'],
    ['college', 'Educational'],
    ['infrastructure', 'Infrastructure'],
    ['mixed use', 'Mixed Use'],
    ['mixed-use', 'Mixed Use'],
  ];

  for (const [keyword, type] of typeMap) {
    if (lower.includes(keyword)) return type;
  }
  return '';
}

function summarizeText(text) {
  const normalized = text
    .replace(/\s+/g, ' ')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
    .trim();

  if (!normalized) return '';
  const sentences = normalized
    .split(/(?<=[.?!])\s+/)
    .filter((line) => line.length > 40 && line.length < 220);

  return sanitize(sentences.slice(0, 2).join(' '));
}

async function loadPdfJs() {
  if (pdfJsModulePromise) return pdfJsModulePromise;

  pdfJsModulePromise = Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, workerUrl]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
    return pdfjs;
  });

  return pdfJsModulePromise;
}

async function readPdfText(file) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({
    data,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();

    if (pageText) pages.push(pageText);
  }

  return pages.join('\n');
}

