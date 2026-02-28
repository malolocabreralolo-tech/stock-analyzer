export interface SP500Company {
  symbol: string;
  name: string;
  sector: string;
  subIndustry: string;
}

interface CacheEntry {
  data: SP500Company[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let cache: CacheEntry | null = null;

/**
 * Fetches the S&P 500 company list from Wikipedia and parses the HTML table.
 * Results are cached in memory for 24 hours.
 */
export async function getSP500FromWikipedia(): Promise<SP500Company[]> {
  // Return cached data if still fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  const url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';

  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; StockAnalyzer/1.0; +https://github.com/stock-analyzer)',
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Wikipedia page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const companies = parseWikipediaSP500Table(html);

  cache = { data: companies, fetchedAt: Date.now() };
  return companies;
}

/**
 * Parses the first wikitable on the Wikipedia S&P 500 page.
 * The table has these columns (0-indexed):
 *   0: Symbol, 1: Security (name), 2: GICS Sector, 3: GICS Sub-Industry,
 *   4: Headquarters Location, 5: Date added, 6: CIK, 7: Founded
 */
function parseWikipediaSP500Table(html: string): SP500Company[] {
  const companies: SP500Company[] = [];

  // Extract the first wikitable (the constituents table)
  const tableMatch = html.match(/<table[^>]*class="[^"]*wikitable[^"]*"[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    throw new Error('Could not find the S&P 500 table on the Wikipedia page');
  }

  const tableHtml = tableMatch[0];

  // Split into rows, skip the header row(s)
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  const rows: string[] = [];
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    rows.push(rowMatch[0]);
  }

  // Skip header rows (rows that contain <th> instead of <td> for all cells)
  for (const row of rows) {
    // Skip header rows
    if (/<th[^>]*>/i.test(row) && !/<td[^>]*>/i.test(row)) {
      continue;
    }

    const cells = extractCells(row);
    if (cells.length < 4) continue;

    const symbol = cleanText(cells[0]);
    const name = cleanText(cells[1]);
    const sector = cleanText(cells[2]);
    const subIndustry = cleanText(cells[3]);

    // Basic validation: symbol should be 1-5 uppercase letters (with possible dot)
    if (!symbol || !/^[A-Z]{1,5}(\.[A-Z])?$/.test(symbol)) continue;
    if (!name || !sector) continue;

    companies.push({ symbol, name, sector, subIndustry });
  }

  return companies;
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
    .replace(/<[^>]+>/g, '') // strip tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '') // strip other numeric entities
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Clears the in-memory cache (useful for testing).
 */
export function clearSP500Cache(): void {
  cache = null;
}
