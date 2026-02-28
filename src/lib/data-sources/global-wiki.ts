export interface GlobalCompany {
  symbol: string;
  name: string;
  sector: string;
  subIndustry: string;
  country: string;
}

interface CacheEntry {
  data: GlobalCompany[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const caches: Record<string, CacheEntry> = {};

async function fetchWikipediaPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; StockAnalyzer/1.0; +https://github.com/stock-analyzer)',
      Accept: 'text/html',
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/**
 * Extracts text content from all <td> cells in a table row.
 */
function extractCells(rowHtml: string): string[] {
  const cells: string[] = [];
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(rowHtml)) !== null) {
    cells.push(match[1]);
  }
  return cells;
}

/**
 * Strips HTML tags and decodes common HTML entities from a string.
 */
function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .replace(/\n/g, ' ')
    .trim();
}

function parseWikitableRows(html: string): string[][] {
  const tableMatch = html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];

  const tableHtml = tableMatch[0];
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  const rows: string[][] = [];
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const row = rowMatch[0];
    // Skip header rows
    if (/<th[^>]*>/i.test(row) && !/<td[^>]*>/i.test(row)) continue;
    const cells = extractCells(row);
    if (cells.length > 0) rows.push(cells.map(cleanText));
  }
  return rows;
}

/**
 * Fetches FTSE 100 companies from Wikipedia and adds `.L` suffix to tickers.
 */
export async function getFTSE100FromWikipedia(): Promise<GlobalCompany[]> {
  const cacheKey = 'ftse100';
  if (caches[cacheKey] && Date.now() - caches[cacheKey].fetchedAt < CACHE_TTL_MS) {
    return caches[cacheKey].data;
  }

  const html = await fetchWikipediaPage('https://en.wikipedia.org/wiki/FTSE_100_Index');
  const rows = parseWikitableRows(html);
  const companies: GlobalCompany[] = [];

  for (const cells of rows) {
    if (cells.length < 2) continue;
    // FTSE 100 table: col 0 = Company, col 1 = Ticker, col 2 = GICS Sector (sometimes)
    // The table columns vary; try to find ticker by pattern
    let symbol = '';
    let name = '';
    let sector = 'Unknown';

    // Try col 1 as ticker (typical layout: Company | Ticker | Sector | ...)
    if (cells.length >= 2) {
      name = cells[0];
      const possibleTicker = cells[1].replace(/\s/g, '');
      if (/^[A-Z0-9]{1,6}$/.test(possibleTicker)) {
        symbol = possibleTicker;
      }
    }
    if (cells.length >= 3) sector = cells[2] || 'Unknown';

    if (!symbol || !name) continue;

    companies.push({
      symbol: `${symbol}.L`,
      name,
      sector,
      subIndustry: 'Unknown',
      country: 'UK',
    });
  }

  caches[cacheKey] = { data: companies, fetchedAt: Date.now() };
  return companies;
}

/**
 * Fetches DAX 40 companies from Wikipedia and adds `.DE` suffix to tickers.
 */
export async function getDAX40FromWikipedia(): Promise<GlobalCompany[]> {
  const cacheKey = 'dax40';
  if (caches[cacheKey] && Date.now() - caches[cacheKey].fetchedAt < CACHE_TTL_MS) {
    return caches[cacheKey].data;
  }

  const html = await fetchWikipediaPage('https://en.wikipedia.org/wiki/DAX');
  const rows = parseWikitableRows(html);
  const companies: GlobalCompany[] = [];

  for (const cells of rows) {
    if (cells.length < 2) continue;
    // DAX table: Company | Ticker | Industry | ...
    const name = cells[0];
    const possibleTicker = cells[1].replace(/\s/g, '');
    if (!/^[A-Z0-9]{1,6}$/.test(possibleTicker)) continue;
    const sector = cells[2] || 'Unknown';

    companies.push({
      symbol: `${possibleTicker}.DE`,
      name,
      sector,
      subIndustry: 'Unknown',
      country: 'Germany',
    });
  }

  caches[cacheKey] = { data: companies, fetchedAt: Date.now() };
  return companies;
}

/**
 * Fetches CAC 40 companies from Wikipedia and adds `.PA` suffix to tickers.
 */
export async function getCAC40FromWikipedia(): Promise<GlobalCompany[]> {
  const cacheKey = 'cac40';
  if (caches[cacheKey] && Date.now() - caches[cacheKey].fetchedAt < CACHE_TTL_MS) {
    return caches[cacheKey].data;
  }

  const html = await fetchWikipediaPage('https://en.wikipedia.org/wiki/CAC_40');
  const rows = parseWikitableRows(html);
  const companies: GlobalCompany[] = [];

  for (const cells of rows) {
    if (cells.length < 2) continue;
    // CAC 40 table: Company | Ticker | Sector | ...
    const name = cells[0];
    const possibleTicker = cells[1].replace(/\s/g, '');
    if (!/^[A-Z0-9]{1,6}$/.test(possibleTicker)) continue;
    const sector = cells[2] || 'Unknown';

    companies.push({
      symbol: `${possibleTicker}.PA`,
      name,
      sector,
      subIndustry: 'Unknown',
      country: 'France',
    });
  }

  caches[cacheKey] = { data: companies, fetchedAt: Date.now() };
  return companies;
}

// Exchange suffix mapping for Euro Stoxx 50 companies
const EURO_STOXX_EXCHANGE_MAP: Record<string, string> = {
  Euronext_Amsterdam: '.AS',
  Euronext_Brussels: '.BR',
  Euronext_Paris: '.PA',
  Frankfurt_Stock_Exchange: '.DE',
  Madrid_Stock_Exchange: '.MC',
  Milan_Stock_Exchange: '.MI',
  Helsinki_Stock_Exchange: '.HE',
  Luxembourg_Stock_Exchange: '.LU',
};

// Known Euro Stoxx 50 tickers with correct suffixes (fallback for scraping)
const EURO_STOXX_50_FALLBACK: GlobalCompany[] = [
  { symbol: 'ABI.BR', name: 'AB InBev', sector: 'Consumer Staples', subIndustry: 'Brewers', country: 'Belgium' },
  { symbol: 'ADYEN.AS', name: 'Adyen', sector: 'Information Technology', subIndustry: 'Data Processing & Outsourced Services', country: 'Netherlands' },
  { symbol: 'AI.PA', name: 'Air Liquide', sector: 'Materials', subIndustry: 'Industrial Gases', country: 'France' },
  { symbol: 'AIR.PA', name: 'Airbus', sector: 'Industrials', subIndustry: 'Aerospace & Defense', country: 'France' },
  { symbol: 'ALV.DE', name: 'Allianz', sector: 'Financials', subIndustry: 'Multi-line Insurance', country: 'Germany' },
  { symbol: 'ASML.AS', name: 'ASML', sector: 'Information Technology', subIndustry: 'Semiconductor Equipment', country: 'Netherlands' },
  { symbol: 'AXA.PA', name: 'AXA', sector: 'Financials', subIndustry: 'Multi-line Insurance', country: 'France' },
  { symbol: 'BAYN.DE', name: 'Bayer', sector: 'Health Care', subIndustry: 'Pharmaceuticals', country: 'Germany' },
  { symbol: 'BMW.DE', name: 'BMW', sector: 'Consumer Discretionary', subIndustry: 'Automobile Manufacturers', country: 'Germany' },
  { symbol: 'BNP.PA', name: 'BNP Paribas', sector: 'Financials', subIndustry: 'Diversified Banks', country: 'France' },
  { symbol: 'CRH.IE', name: 'CRH', sector: 'Materials', subIndustry: 'Construction Materials', country: 'Ireland' },
  { symbol: 'CS.PA', name: 'AXA', sector: 'Financials', subIndustry: 'Multi-line Insurance', country: 'France' },
  { symbol: 'DHL.DE', name: 'DHL Group', sector: 'Industrials', subIndustry: 'Air Freight & Logistics', country: 'Germany' },
  { symbol: 'DTE.DE', name: 'Deutsche Telekom', sector: 'Communication Services', subIndustry: 'Integrated Telecommunication Services', country: 'Germany' },
  { symbol: 'ENEL.MI', name: 'Enel', sector: 'Utilities', subIndustry: 'Electric Utilities', country: 'Italy' },
  { symbol: 'ENI.MI', name: 'Eni', sector: 'Energy', subIndustry: 'Integrated Oil & Gas', country: 'Italy' },
  { symbol: 'EL.PA', name: "L'Oreal", sector: 'Consumer Staples', subIndustry: 'Personal Products', country: 'France' },
  { symbol: 'IBE.MC', name: 'Iberdrola', sector: 'Utilities', subIndustry: 'Electric Utilities', country: 'Spain' },
  { symbol: 'IFX.DE', name: 'Infineon Technologies', sector: 'Information Technology', subIndustry: 'Semiconductors', country: 'Germany' },
  { symbol: 'INGA.AS', name: 'ING Group', sector: 'Financials', subIndustry: 'Diversified Banks', country: 'Netherlands' },
  { symbol: 'ISP.MI', name: 'Intesa Sanpaolo', sector: 'Financials', subIndustry: 'Diversified Banks', country: 'Italy' },
  { symbol: 'KER.PA', name: 'Kering', sector: 'Consumer Discretionary', subIndustry: 'Apparel, Accessories & Luxury Goods', country: 'France' },
  { symbol: 'LIN.DE', name: 'Linde', sector: 'Materials', subIndustry: 'Industrial Gases', country: 'Germany' },
  { symbol: 'MC.PA', name: 'LVMH', sector: 'Consumer Discretionary', subIndustry: 'Apparel, Accessories & Luxury Goods', country: 'France' },
  { symbol: 'MBG.DE', name: 'Mercedes-Benz', sector: 'Consumer Discretionary', subIndustry: 'Automobile Manufacturers', country: 'Germany' },
  { symbol: 'MUV2.DE', name: 'Munich Re', sector: 'Financials', subIndustry: 'Reinsurance', country: 'Germany' },
  { symbol: 'OR.PA', name: "L'Oreal", sector: 'Consumer Staples', subIndustry: 'Personal Products', country: 'France' },
  { symbol: 'ORA.PA', name: 'Orange', sector: 'Communication Services', subIndustry: 'Integrated Telecommunication Services', country: 'France' },
  { symbol: 'PHIA.AS', name: 'Philips', sector: 'Health Care', subIndustry: 'Health Care Equipment', country: 'Netherlands' },
  { symbol: 'PRX.AS', name: 'Prosus', sector: 'Information Technology', subIndustry: 'Internet Services & Infrastructure', country: 'Netherlands' },
  { symbol: 'RMS.PA', name: 'Hermes International', sector: 'Consumer Discretionary', subIndustry: 'Apparel, Accessories & Luxury Goods', country: 'France' },
  { symbol: 'SAN.MC', name: 'Banco Santander', sector: 'Financials', subIndustry: 'Diversified Banks', country: 'Spain' },
  { symbol: 'SAP.DE', name: 'SAP', sector: 'Information Technology', subIndustry: 'Application Software', country: 'Germany' },
  { symbol: 'SIE.DE', name: 'Siemens', sector: 'Industrials', subIndustry: 'Industrial Conglomerates', country: 'Germany' },
  { symbol: 'SU.PA', name: 'Schneider Electric', sector: 'Industrials', subIndustry: 'Electrical Components & Equipment', country: 'France' },
  { symbol: 'TTE.PA', name: 'TotalEnergies', sector: 'Energy', subIndustry: 'Integrated Oil & Gas', country: 'France' },
  { symbol: 'UCG.MI', name: 'UniCredit', sector: 'Financials', subIndustry: 'Diversified Banks', country: 'Italy' },
  { symbol: 'VOW3.DE', name: 'Volkswagen', sector: 'Consumer Discretionary', subIndustry: 'Automobile Manufacturers', country: 'Germany' },
  { symbol: 'VIV.PA', name: 'Vivendi', sector: 'Communication Services', subIndustry: 'Movies & Entertainment', country: 'France' },
  { symbol: 'WKL.AS', name: 'Wolters Kluwer', sector: 'Industrials', subIndustry: 'Research & Consulting Services', country: 'Netherlands' },
];

/**
 * Returns Euro Stoxx 50 companies (uses static fallback for reliability,
 * as Wikipedia table structure is complex with exchange mapping).
 */
export async function getEuroStoxx50FromWikipedia(): Promise<GlobalCompany[]> {
  const cacheKey = 'eurostoxx50';
  if (caches[cacheKey] && Date.now() - caches[cacheKey].fetchedAt < CACHE_TTL_MS) {
    return caches[cacheKey].data;
  }

  // Use static fallback — Euro Stoxx 50 has a complex Wikipedia table
  // with exchange names that need manual mapping; static data is more reliable
  const data = EURO_STOXX_50_FALLBACK;
  caches[cacheKey] = { data, fetchedAt: Date.now() };
  return data;
}

/**
 * Aggregates all European Wikipedia-sourced companies, deduplicating by ticker.
 */
export async function getAllGlobalWikiCompanies(): Promise<GlobalCompany[]> {
  const results = await Promise.allSettled([
    getFTSE100FromWikipedia(),
    getDAX40FromWikipedia(),
    getCAC40FromWikipedia(),
    getEuroStoxx50FromWikipedia(),
  ]);

  const seen = new Set<string>();
  const companies: GlobalCompany[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const company of result.value) {
        if (!seen.has(company.symbol)) {
          seen.add(company.symbol);
          companies.push(company);
        }
      }
    } else {
      console.warn('Failed to fetch index from Wikipedia:', result.reason);
    }
  }

  return companies;
}

/**
 * Clears all in-memory caches (useful for testing).
 */
export function clearGlobalWikiCache(): void {
  for (const key of Object.keys(caches)) {
    delete caches[key];
  }
}
