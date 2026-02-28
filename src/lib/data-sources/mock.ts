import { CompanyProfile, FinancialData, HistoricalPrice } from '@/types';

interface MockCompanyData {
  profile: CompanyProfile;
  financials: FinancialData[];
}

function generatePriceHistory(basePrice: number, volatility: number, years: number): HistoricalPrice[] {
  const prices: HistoricalPrice[] = [];
  const days = years * 252; // trading days
  let price = basePrice * (0.5 + Math.random() * 0.3); // start lower in the past
  const trend = (basePrice / price) ** (1 / days); // trend toward current price

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - years);

  let currentDate = new Date(startDate);
  for (let i = 0; i < days; i++) {
    // Skip weekends
    while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const dailyReturn = (Math.random() - 0.48) * volatility * 2;
    price = price * trend * (1 + dailyReturn);
    price = Math.max(price * 0.5, price); // floor

    const dayVolatility = price * volatility * 0.5;
    prices.push({
      date: currentDate.toISOString().split('T')[0],
      open: +(price * (1 + (Math.random() - 0.5) * 0.01)).toFixed(2),
      high: +(price + Math.random() * dayVolatility).toFixed(2),
      low: +(price - Math.random() * dayVolatility).toFixed(2),
      close: +price.toFixed(2),
      volume: Math.floor(20_000_000 + Math.random() * 80_000_000),
    });

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return prices;
}

const MOCK_COMPANIES: MockCompanyData[] = [
  {
    profile: {
      ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics',
      marketCap: 3_400_000_000_000, exchange: 'NASDAQ', price: 228.50,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-09-28', revenue: 391_035_000_000, netIncome: 93_736_000_000, freeCashFlow: 108_807_000_000, totalDebt: 101_304_000_000, totalEquity: 56_950_000_000, totalAssets: 364_980_000_000, pe: 35.2, evEbitda: 26.1, pb: 56.8, ps: 8.5, roe: 1.57, roic: 0.58, debtToEquity: 1.78, currentRatio: 0.87, grossMargin: 0.462, operatingMargin: 0.317, netMargin: 0.240, revenueGrowth: 0.02, epsGrowth: 0.10, dividendYield: 0.0044, ebitda: 134_661_000_000, eps: 6.08, bookValuePerShare: 3.77, operatingCashFlow: 118_254_000_000, capitalExpenditure: -9_447_000_000 },
      { period: '2023-FY', periodDate: '2023-09-30', revenue: 383_285_000_000, netIncome: 96_995_000_000, freeCashFlow: 99_584_000_000, totalDebt: 111_088_000_000, totalEquity: 62_146_000_000, totalAssets: 352_583_000_000, pe: 30.5, evEbitda: 22.8, pb: 47.2, ps: 7.6, roe: 1.56, roic: 0.55, debtToEquity: 1.79, currentRatio: 0.99, grossMargin: 0.442, operatingMargin: 0.302, netMargin: 0.253, revenueGrowth: -0.03, epsGrowth: -0.02, dividendYield: 0.0055, ebitda: 125_820_000_000, eps: 6.13, bookValuePerShare: 3.95, operatingCashFlow: 110_543_000_000, capitalExpenditure: -10_959_000_000 },
      { period: '2022-FY', periodDate: '2022-09-24', revenue: 394_328_000_000, netIncome: 99_803_000_000, freeCashFlow: 111_443_000_000, totalDebt: 120_069_000_000, totalEquity: 50_672_000_000, totalAssets: 352_755_000_000, pe: 24.8, evEbitda: 19.5, pb: 43.5, ps: 6.3, roe: 1.97, roic: 0.62, debtToEquity: 2.37, currentRatio: 0.88, grossMargin: 0.434, operatingMargin: 0.303, netMargin: 0.253, revenueGrowth: 0.08, epsGrowth: 0.09, dividendYield: 0.0065, ebitda: 130_541_000_000, eps: 6.15, bookValuePerShare: 3.18, operatingCashFlow: 122_151_000_000, capitalExpenditure: -10_708_000_000 },
      { period: '2021-FY', periodDate: '2021-09-25', revenue: 365_817_000_000, netIncome: 94_680_000_000, freeCashFlow: 92_953_000_000, totalDebt: 124_719_000_000, totalEquity: 63_090_000_000, totalAssets: 351_002_000_000, pe: 28.7, evEbitda: 22.0, pb: 38.5, ps: 7.1, roe: 1.50, roic: 0.50, debtToEquity: 1.98, currentRatio: 1.07, grossMargin: 0.418, operatingMargin: 0.298, netMargin: 0.259, revenueGrowth: 0.33, epsGrowth: 0.71, dividendYield: 0.0058, ebitda: 123_136_000_000, eps: 5.61, bookValuePerShare: 3.84, operatingCashFlow: 104_038_000_000, capitalExpenditure: -11_085_000_000 },
      { period: '2020-FY', periodDate: '2020-09-26', revenue: 274_515_000_000, netIncome: 57_411_000_000, freeCashFlow: 73_365_000_000, totalDebt: 112_436_000_000, totalEquity: 65_339_000_000, totalAssets: 323_888_000_000, pe: 33.9, evEbitda: 24.3, pb: 30.1, ps: 7.2, roe: 0.88, roic: 0.35, debtToEquity: 1.72, currentRatio: 1.36, grossMargin: 0.382, operatingMargin: 0.241, netMargin: 0.209, revenueGrowth: 0.06, epsGrowth: 0.10, dividendYield: 0.0068, ebitda: 77_344_000_000, eps: 3.28, bookValuePerShare: 3.85, operatingCashFlow: 80_674_000_000, capitalExpenditure: -7_309_000_000 },
    ],
  },
  {
    profile: {
      ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software - Infrastructure',
      marketCap: 3_100_000_000_000, exchange: 'NASDAQ', price: 415.80,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-06-30', revenue: 245_122_000_000, netIncome: 88_136_000_000, freeCashFlow: 74_071_000_000, totalDebt: 55_956_000_000, totalEquity: 268_477_000_000, totalAssets: 512_163_000_000, pe: 36.5, evEbitda: 27.2, pb: 12.1, ps: 13.2, roe: 0.328, roic: 0.285, debtToEquity: 0.21, currentRatio: 1.27, grossMargin: 0.696, operatingMargin: 0.447, netMargin: 0.360, revenueGrowth: 0.16, epsGrowth: 0.22, dividendYield: 0.0072, ebitda: 125_981_000_000, eps: 11.86, bookValuePerShare: 36.12, operatingCashFlow: 95_383_000_000, capitalExpenditure: -21_312_000_000 },
      { period: '2023-FY', periodDate: '2023-06-30', revenue: 211_915_000_000, netIncome: 72_361_000_000, freeCashFlow: 59_475_000_000, totalDebt: 47_032_000_000, totalEquity: 206_223_000_000, totalAssets: 411_976_000_000, pe: 33.1, evEbitda: 24.8, pb: 12.5, ps: 12.0, roe: 0.351, roic: 0.298, debtToEquity: 0.23, currentRatio: 1.77, grossMargin: 0.685, operatingMargin: 0.418, netMargin: 0.342, revenueGrowth: 0.07, epsGrowth: 0.03, dividendYield: 0.0080, ebitda: 104_212_000_000, eps: 9.72, bookValuePerShare: 27.72, operatingCashFlow: 87_582_000_000, capitalExpenditure: -28_107_000_000 },
      { period: '2022-FY', periodDate: '2022-06-30', revenue: 198_270_000_000, netIncome: 72_738_000_000, freeCashFlow: 65_149_000_000, totalDebt: 50_074_000_000, totalEquity: 166_542_000_000, totalAssets: 364_840_000_000, pe: 27.8, evEbitda: 20.6, pb: 11.0, ps: 9.5, roe: 0.437, roic: 0.345, debtToEquity: 0.30, currentRatio: 1.78, grossMargin: 0.683, operatingMargin: 0.422, netMargin: 0.367, revenueGrowth: 0.18, epsGrowth: 0.14, dividendYield: 0.0088, ebitda: 97_982_000_000, eps: 9.65, bookValuePerShare: 22.32, operatingCashFlow: 89_035_000_000, capitalExpenditure: -23_886_000_000 },
      { period: '2021-FY', periodDate: '2021-06-30', revenue: 168_088_000_000, netIncome: 61_271_000_000, freeCashFlow: 56_118_000_000, totalDebt: 55_746_000_000, totalEquity: 141_988_000_000, totalAssets: 333_779_000_000, pe: 34.5, evEbitda: 25.0, pb: 13.5, ps: 11.8, roe: 0.431, roic: 0.318, debtToEquity: 0.39, currentRatio: 2.08, grossMargin: 0.689, operatingMargin: 0.415, netMargin: 0.365, revenueGrowth: 0.18, epsGrowth: 0.38, dividendYield: 0.0082, ebitda: 85_039_000_000, eps: 8.05, bookValuePerShare: 18.89, operatingCashFlow: 76_740_000_000, capitalExpenditure: -20_622_000_000 },
      { period: '2020-FY', periodDate: '2020-06-30', revenue: 143_015_000_000, netIncome: 44_281_000_000, freeCashFlow: 45_234_000_000, totalDebt: 63_313_000_000, totalEquity: 118_304_000_000, totalAssets: 301_311_000_000, pe: 33.4, evEbitda: 23.5, pb: 12.4, ps: 10.6, roe: 0.374, roic: 0.244, debtToEquity: 0.54, currentRatio: 2.52, grossMargin: 0.679, operatingMargin: 0.371, netMargin: 0.310, revenueGrowth: 0.14, epsGrowth: 0.21, dividendYield: 0.0098, ebitda: 68_876_000_000, eps: 5.76, bookValuePerShare: 15.57, operatingCashFlow: 60_675_000_000, capitalExpenditure: -15_441_000_000 },
    ],
  },
  {
    profile: {
      ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology', industry: 'Internet Content & Information',
      marketCap: 2_100_000_000_000, exchange: 'NASDAQ', price: 171.20,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 350_018_000_000, netIncome: 100_681_000_000, freeCashFlow: 72_798_000_000, totalDebt: 14_242_000_000, totalEquity: 325_081_000_000, totalAssets: 430_266_000_000, pe: 22.5, evEbitda: 16.8, pb: 6.8, ps: 6.3, roe: 0.310, roic: 0.295, debtToEquity: 0.04, currentRatio: 1.84, grossMargin: 0.576, operatingMargin: 0.322, netMargin: 0.288, revenueGrowth: 0.14, epsGrowth: 0.36, dividendYield: 0.0045, ebitda: 131_632_000_000, eps: 8.04, bookValuePerShare: 26.16, operatingCashFlow: 112_785_000_000, capitalExpenditure: -39_987_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 307_394_000_000, netIncome: 73_795_000_000, freeCashFlow: 69_495_000_000, totalDebt: 14_040_000_000, totalEquity: 283_379_000_000, totalAssets: 402_392_000_000, pe: 25.8, evEbitda: 18.2, pb: 6.1, ps: 5.6, roe: 0.260, roic: 0.248, debtToEquity: 0.05, currentRatio: 2.10, grossMargin: 0.564, operatingMargin: 0.278, netMargin: 0.240, revenueGrowth: 0.09, epsGrowth: 0.28, dividendYield: 0.0, ebitda: 101_267_000_000, eps: 5.80, bookValuePerShare: 22.42, operatingCashFlow: 101_746_000_000, capitalExpenditure: -32_251_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 282_836_000_000, netIncome: 59_972_000_000, freeCashFlow: 60_010_000_000, totalDebt: 14_701_000_000, totalEquity: 256_144_000_000, totalAssets: 365_264_000_000, pe: 20.1, evEbitda: 13.5, pb: 4.6, ps: 4.2, roe: 0.234, roic: 0.225, debtToEquity: 0.06, currentRatio: 2.38, grossMargin: 0.553, operatingMargin: 0.264, netMargin: 0.212, revenueGrowth: 0.10, epsGrowth: -0.17, dividendYield: 0.0, ebitda: 91_246_000_000, eps: 4.56, bookValuePerShare: 19.57, operatingCashFlow: 91_495_000_000, capitalExpenditure: -31_485_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 257_637_000_000, netIncome: 76_033_000_000, freeCashFlow: 67_012_000_000, totalDebt: 14_817_000_000, totalEquity: 251_635_000_000, totalAssets: 359_268_000_000, pe: 27.5, evEbitda: 20.5, pb: 7.2, ps: 7.1, roe: 0.302, roic: 0.290, debtToEquity: 0.06, currentRatio: 2.93, grossMargin: 0.566, operatingMargin: 0.306, netMargin: 0.295, revenueGrowth: 0.41, epsGrowth: 0.91, dividendYield: 0.0, ebitda: 97_261_000_000, eps: 5.61, bookValuePerShare: 18.73, operatingCashFlow: 91_652_000_000, capitalExpenditure: -24_640_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 182_527_000_000, netIncome: 40_269_000_000, freeCashFlow: 42_843_000_000, totalDebt: 14_287_000_000, totalEquity: 222_544_000_000, totalAssets: 319_616_000_000, pe: 32.8, evEbitda: 21.8, pb: 5.5, ps: 6.7, roe: 0.181, roic: 0.170, debtToEquity: 0.06, currentRatio: 3.07, grossMargin: 0.535, operatingMargin: 0.226, netMargin: 0.221, revenueGrowth: 0.13, epsGrowth: 0.19, dividendYield: 0.0, ebitda: 54_921_000_000, eps: 2.93, bookValuePerShare: 16.25, operatingCashFlow: 65_124_000_000, capitalExpenditure: -22_281_000_000 },
    ],
  },
  {
    profile: {
      ticker: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical', industry: 'Internet Retail',
      marketCap: 2_050_000_000_000, exchange: 'NASDAQ', price: 196.00,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 637_997_000_000, netIncome: 59_248_000_000, freeCashFlow: 38_200_000_000, totalDebt: 58_874_000_000, totalEquity: 285_970_000_000, totalAssets: 624_894_000_000, pe: 38.5, evEbitda: 18.9, pb: 7.8, ps: 3.5, roe: 0.207, roic: 0.145, debtToEquity: 0.21, currentRatio: 1.06, grossMargin: 0.487, operatingMargin: 0.108, netMargin: 0.093, revenueGrowth: 0.11, epsGrowth: 0.86, dividendYield: 0.0, ebitda: 115_345_000_000, eps: 5.53, bookValuePerShare: 27.05, operatingCashFlow: 115_877_000_000, capitalExpenditure: -77_677_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 574_785_000_000, netIncome: 30_425_000_000, freeCashFlow: 32_200_000_000, totalDebt: 67_150_000_000, totalEquity: 201_875_000_000, totalAssets: 527_854_000_000, pe: 58.2, evEbitda: 22.5, pb: 8.4, ps: 2.9, roe: 0.151, roic: 0.098, debtToEquity: 0.33, currentRatio: 1.05, grossMargin: 0.468, operatingMargin: 0.064, netMargin: 0.053, revenueGrowth: 0.12, epsGrowth: null, dividendYield: 0.0, ebitda: 85_524_000_000, eps: 2.90, bookValuePerShare: 19.34, operatingCashFlow: 84_946_000_000, capitalExpenditure: -52_746_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 513_983_000_000, netIncome: -2_722_000_000, freeCashFlow: -16_893_000_000, totalDebt: 70_036_000_000, totalEquity: 146_043_000_000, totalAssets: 462_675_000_000, pe: null, evEbitda: 18.5, pb: 6.2, ps: 1.8, roe: -0.019, roic: -0.008, debtToEquity: 0.48, currentRatio: 0.93, grossMargin: 0.437, operatingMargin: 0.023, netMargin: -0.005, revenueGrowth: 0.09, epsGrowth: null, dividendYield: 0.0, ebitda: 55_269_000_000, eps: -0.27, bookValuePerShare: 14.25, operatingCashFlow: 46_752_000_000, capitalExpenditure: -63_645_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 469_822_000_000, netIncome: 33_364_000_000, freeCashFlow: 25_900_000_000, totalDebt: 57_497_000_000, totalEquity: 138_245_000_000, totalAssets: 420_549_000_000, pe: 50.8, evEbitda: 25.5, pb: 10.5, ps: 3.2, roe: 0.241, roic: 0.165, debtToEquity: 0.42, currentRatio: 1.14, grossMargin: 0.421, operatingMargin: 0.059, netMargin: 0.071, revenueGrowth: 0.22, epsGrowth: 0.02, dividendYield: 0.0, ebitda: 59_286_000_000, eps: 3.24, bookValuePerShare: 13.41, operatingCashFlow: 46_327_000_000, capitalExpenditure: -20_427_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 386_064_000_000, netIncome: 21_331_000_000, freeCashFlow: 31_900_000_000, totalDebt: 44_280_000_000, totalEquity: 93_404_000_000, totalAssets: 321_195_000_000, pe: 72.5, evEbitda: 32.6, pb: 15.5, ps: 3.8, roe: 0.228, roic: 0.148, debtToEquity: 0.47, currentRatio: 1.05, grossMargin: 0.395, operatingMargin: 0.059, netMargin: 0.055, revenueGrowth: 0.38, epsGrowth: 0.84, dividendYield: 0.0, ebitda: 47_159_000_000, eps: 3.18, bookValuePerShare: 9.27, operatingCashFlow: 66_064_000_000, capitalExpenditure: -34_164_000_000 },
    ],
  },
  {
    profile: {
      ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors',
      marketCap: 2_800_000_000_000, exchange: 'NASDAQ', price: 114.50,
    },
    financials: [
      { period: '2024-FY', periodDate: '2025-01-26', revenue: 130_497_000_000, netIncome: 72_880_000_000, freeCashFlow: 60_940_000_000, totalDebt: 8_462_000_000, totalEquity: 65_899_000_000, totalAssets: 112_198_000_000, pe: 40.2, evEbitda: 32.5, pb: 42.8, ps: 22.0, roe: 1.106, roic: 0.892, debtToEquity: 0.13, currentRatio: 4.17, grossMargin: 0.750, operatingMargin: 0.622, netMargin: 0.558, revenueGrowth: 1.14, epsGrowth: 1.30, dividendYield: 0.0003, ebitda: 86_198_000_000, eps: 2.94, bookValuePerShare: 2.69, operatingCashFlow: 64_089_000_000, capitalExpenditure: -3_149_000_000 },
      { period: '2023-FY', periodDate: '2024-01-28', revenue: 60_922_000_000, netIncome: 29_760_000_000, freeCashFlow: 27_020_000_000, totalDebt: 9_709_000_000, totalEquity: 42_978_000_000, totalAssets: 65_728_000_000, pe: 62.5, evEbitda: 48.0, pb: 33.2, ps: 23.4, roe: 0.692, roic: 0.584, debtToEquity: 0.23, currentRatio: 4.11, grossMargin: 0.727, operatingMargin: 0.542, netMargin: 0.489, revenueGrowth: 1.26, epsGrowth: 1.28, dividendYield: 0.0004, ebitda: 35_258_000_000, eps: 1.21, bookValuePerShare: 1.74, operatingCashFlow: 28_090_000_000, capitalExpenditure: -1_070_000_000 },
      { period: '2022-FY', periodDate: '2023-01-29', revenue: 26_974_000_000, netIncome: 4_368_000_000, freeCashFlow: 3_808_000_000, totalDebt: 11_056_000_000, totalEquity: 22_101_000_000, totalAssets: 41_182_000_000, pe: 52.1, evEbitda: 38.2, pb: 15.8, ps: 12.9, roe: 0.198, roic: 0.142, debtToEquity: 0.50, currentRatio: 3.59, grossMargin: 0.569, operatingMargin: 0.210, netMargin: 0.162, revenueGrowth: 0.0, epsGrowth: -0.55, dividendYield: 0.0008, ebitda: 8_132_000_000, eps: 0.17, bookValuePerShare: 0.89, operatingCashFlow: 5_641_000_000, capitalExpenditure: -1_833_000_000 },
      { period: '2021-FY', periodDate: '2022-01-30', revenue: 26_914_000_000, netIncome: 9_752_000_000, freeCashFlow: 8_132_000_000, totalDebt: 11_687_000_000, totalEquity: 26_612_000_000, totalAssets: 44_187_000_000, pe: 65.2, evEbitda: 52.0, pb: 22.4, ps: 22.1, roe: 0.366, roic: 0.282, debtToEquity: 0.44, currentRatio: 4.09, grossMargin: 0.648, operatingMargin: 0.379, netMargin: 0.362, revenueGrowth: 0.61, epsGrowth: 0.78, dividendYield: 0.0006, ebitda: 11_356_000_000, eps: 0.39, bookValuePerShare: 1.07, operatingCashFlow: 9_108_000_000, capitalExpenditure: -976_000_000 },
      { period: '2020-FY', periodDate: '2021-01-31', revenue: 16_675_000_000, netIncome: 4_332_000_000, freeCashFlow: 4_694_000_000, totalDebt: 6_963_000_000, totalEquity: 16_893_000_000, totalAssets: 28_791_000_000, pe: 80.5, evEbitda: 62.5, pb: 18.2, ps: 18.5, roe: 0.256, roic: 0.192, debtToEquity: 0.41, currentRatio: 4.09, grossMargin: 0.625, operatingMargin: 0.338, netMargin: 0.260, revenueGrowth: 0.53, epsGrowth: 0.53, dividendYield: 0.0012, ebitda: 6_200_000_000, eps: 0.17, bookValuePerShare: 0.68, operatingCashFlow: 5_822_000_000, capitalExpenditure: -1_128_000_000 },
    ],
  },
  {
    profile: {
      ticker: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', industry: 'Banks - Diversified',
      marketCap: 680_000_000_000, exchange: 'NYSE', price: 240.20,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 178_934_000_000, netIncome: 58_471_000_000, freeCashFlow: null, totalDebt: 472_190_000_000, totalEquity: 345_775_000_000, totalAssets: 4_003_000_000_000, pe: 12.5, evEbitda: null, pb: 2.05, ps: 3.96, roe: 0.169, roic: 0.045, debtToEquity: 1.37, currentRatio: null, grossMargin: null, operatingMargin: 0.405, netMargin: 0.327, revenueGrowth: 0.12, epsGrowth: 0.18, dividendYield: 0.021, ebitda: null, eps: 19.75, bookValuePerShare: 116.98, operatingCashFlow: null, capitalExpenditure: null },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 159_866_000_000, netIncome: 49_552_000_000, freeCashFlow: null, totalDebt: 447_252_000_000, totalEquity: 327_878_000_000, totalAssets: 3_875_000_000_000, pe: 11.2, evEbitda: null, pb: 1.85, ps: 3.55, roe: 0.151, roic: 0.041, debtToEquity: 1.36, currentRatio: null, grossMargin: null, operatingMargin: 0.382, netMargin: 0.310, revenueGrowth: 0.23, epsGrowth: 0.32, dividendYield: 0.024, ebitda: null, eps: 16.23, bookValuePerShare: 108.80, operatingCashFlow: null, capitalExpenditure: null },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 130_058_000_000, netIncome: 37_676_000_000, freeCashFlow: null, totalDebt: 399_988_000_000, totalEquity: 292_332_000_000, totalAssets: 3_665_000_000_000, pe: 10.8, evEbitda: null, pb: 1.45, ps: 3.12, roe: 0.129, roic: 0.033, debtToEquity: 1.37, currentRatio: null, grossMargin: null, operatingMargin: 0.350, netMargin: 0.290, revenueGrowth: -0.05, epsGrowth: -0.22, dividendYield: 0.029, ebitda: null, eps: 12.09, bookValuePerShare: 95.79, operatingCashFlow: null, capitalExpenditure: null },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 136_798_000_000, netIncome: 48_334_000_000, freeCashFlow: null, totalDebt: 375_560_000_000, totalEquity: 294_127_000_000, totalAssets: 3_743_000_000_000, pe: 10.2, evEbitda: null, pb: 1.80, ps: 3.84, roe: 0.164, roic: 0.042, debtToEquity: 1.28, currentRatio: null, grossMargin: null, operatingMargin: 0.425, netMargin: 0.353, revenueGrowth: 0.15, epsGrowth: 0.67, dividendYield: 0.025, ebitda: null, eps: 15.39, bookValuePerShare: 95.25, operatingCashFlow: null, capitalExpenditure: null },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 119_543_000_000, netIncome: 29_131_000_000, freeCashFlow: null, totalDebt: 363_234_000_000, totalEquity: 279_354_000_000, totalAssets: 3_386_000_000_000, pe: 13.5, evEbitda: null, pb: 1.55, ps: 3.15, roe: 0.104, roic: 0.028, debtToEquity: 1.30, currentRatio: null, grossMargin: null, operatingMargin: 0.310, netMargin: 0.244, revenueGrowth: -0.08, epsGrowth: -0.29, dividendYield: 0.028, ebitda: null, eps: 8.88, bookValuePerShare: 84.72, operatingCashFlow: null, capitalExpenditure: null },
    ],
  },
  {
    profile: {
      ticker: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare', industry: 'Drug Manufacturers',
      marketCap: 380_000_000_000, exchange: 'NYSE', price: 157.30,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 89_008_000_000, netIncome: 14_068_000_000, freeCashFlow: 18_579_000_000, totalDebt: 30_755_000_000, totalEquity: 71_310_000_000, totalAssets: 187_700_000_000, pe: 22.8, evEbitda: 16.2, pb: 5.4, ps: 4.3, roe: 0.197, roic: 0.142, debtToEquity: 0.43, currentRatio: 1.03, grossMargin: 0.694, operatingMargin: 0.238, netMargin: 0.158, revenueGrowth: 0.05, epsGrowth: -0.48, dividendYield: 0.032, ebitda: 28_752_000_000, eps: 5.79, bookValuePerShare: 29.51, operatingCashFlow: 22_294_000_000, capitalExpenditure: -3_715_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 85_159_000_000, netIncome: 26_413_000_000, freeCashFlow: 19_831_000_000, totalDebt: 29_843_000_000, totalEquity: 68_774_000_000, totalAssets: 167_558_000_000, pe: 14.5, evEbitda: 12.8, pb: 5.8, ps: 4.7, roe: 0.384, roic: 0.265, debtToEquity: 0.43, currentRatio: 1.16, grossMargin: 0.691, operatingMargin: 0.381, netMargin: 0.310, revenueGrowth: -0.12, epsGrowth: 0.22, dividendYield: 0.030, ebitda: 30_756_000_000, eps: 10.82, bookValuePerShare: 28.41, operatingCashFlow: 22_774_000_000, capitalExpenditure: -2_943_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 93_775_000_000, netIncome: 17_941_000_000, freeCashFlow: 16_853_000_000, totalDebt: 33_725_000_000, totalEquity: 76_804_000_000, totalAssets: 187_378_000_000, pe: 20.5, evEbitda: 15.5, pb: 5.5, ps: 4.5, roe: 0.234, roic: 0.160, debtToEquity: 0.44, currentRatio: 1.47, grossMargin: 0.676, operatingMargin: 0.272, netMargin: 0.191, revenueGrowth: 0.01, epsGrowth: -0.14, dividendYield: 0.026, ebitda: 32_248_000_000, eps: 6.73, bookValuePerShare: 29.04, operatingCashFlow: 20_471_000_000, capitalExpenditure: -3_618_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 93_775_000_000, netIncome: 20_878_000_000, freeCashFlow: 17_864_000_000, totalDebt: 32_632_000_000, totalEquity: 74_023_000_000, totalAssets: 182_018_000_000, pe: 25.2, evEbitda: 17.1, pb: 6.3, ps: 5.0, roe: 0.282, roic: 0.195, debtToEquity: 0.44, currentRatio: 1.35, grossMargin: 0.681, operatingMargin: 0.285, netMargin: 0.223, revenueGrowth: 0.14, epsGrowth: 0.42, dividendYield: 0.025, ebitda: 33_452_000_000, eps: 7.81, bookValuePerShare: 27.92, operatingCashFlow: 23_410_000_000, capitalExpenditure: -5_546_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 82_584_000_000, netIncome: 14_714_000_000, freeCashFlow: 18_724_000_000, totalDebt: 32_635_000_000, totalEquity: 63_278_000_000, totalAssets: 174_894_000_000, pe: 26.5, evEbitda: 16.8, pb: 6.5, ps: 5.0, roe: 0.233, roic: 0.158, debtToEquity: 0.52, currentRatio: 1.21, grossMargin: 0.664, operatingMargin: 0.245, netMargin: 0.178, revenueGrowth: 0.08, epsGrowth: 0.03, dividendYield: 0.025, ebitda: 26_482_000_000, eps: 5.51, bookValuePerShare: 24.02, operatingCashFlow: 23_585_000_000, capitalExpenditure: -4_861_000_000 },
    ],
  },
  {
    profile: {
      ticker: 'XOM', name: 'Exxon Mobil Corporation', sector: 'Energy', industry: 'Oil & Gas Integrated',
      marketCap: 460_000_000_000, exchange: 'NYSE', price: 108.50,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 339_250_000_000, netIncome: 33_680_000_000, freeCashFlow: 26_440_000_000, totalDebt: 42_853_000_000, totalEquity: 263_705_000_000, totalAssets: 453_475_000_000, pe: 14.2, evEbitda: 7.5, pb: 1.82, ps: 1.41, roe: 0.128, roic: 0.108, debtToEquity: 0.16, currentRatio: 1.32, grossMargin: 0.298, operatingMargin: 0.136, netMargin: 0.099, revenueGrowth: -0.02, epsGrowth: -0.14, dividendYield: 0.035, ebitda: 67_850_000_000, eps: 7.84, bookValuePerShare: 61.52, operatingCashFlow: 55_367_000_000, capitalExpenditure: -28_927_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 344_582_000_000, netIncome: 36_010_000_000, freeCashFlow: 33_400_000_000, totalDebt: 40_823_000_000, totalEquity: 204_802_000_000, totalAssets: 376_317_000_000, pe: 10.5, evEbitda: 5.8, pb: 2.20, ps: 1.35, roe: 0.176, roic: 0.155, debtToEquity: 0.20, currentRatio: 1.41, grossMargin: 0.312, operatingMargin: 0.152, netMargin: 0.104, revenueGrowth: -0.17, epsGrowth: -0.35, dividendYield: 0.037, ebitda: 72_432_000_000, eps: 9.12, bookValuePerShare: 51.85, operatingCashFlow: 55_369_000_000, capitalExpenditure: -21_969_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 413_680_000_000, netIncome: 55_740_000_000, freeCashFlow: 48_870_000_000, totalDebt: 40_559_000_000, totalEquity: 185_588_000_000, totalAssets: 369_067_000_000, pe: 8.4, evEbitda: 4.5, pb: 2.15, ps: 0.97, roe: 0.300, roic: 0.252, debtToEquity: 0.22, currentRatio: 1.43, grossMargin: 0.352, operatingMargin: 0.198, netMargin: 0.135, revenueGrowth: 0.44, epsGrowth: 1.59, dividendYield: 0.033, ebitda: 92_451_000_000, eps: 13.26, bookValuePerShare: 45.11, operatingCashFlow: 76_800_000_000, capitalExpenditure: -27_930_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 285_640_000_000, netIncome: 23_040_000_000, freeCashFlow: 22_800_000_000, totalDebt: 43_428_000_000, totalEquity: 168_577_000_000, totalAssets: 338_923_000_000, pe: 14.5, evEbitda: 6.8, pb: 1.75, ps: 1.28, roe: 0.137, roic: 0.112, debtToEquity: 0.26, currentRatio: 1.21, grossMargin: 0.275, operatingMargin: 0.112, netMargin: 0.081, revenueGrowth: 0.57, epsGrowth: null, dividendYield: 0.058, ebitda: 53_123_000_000, eps: 5.38, bookValuePerShare: 40.12, operatingCashFlow: 48_129_000_000, capitalExpenditure: -25_329_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 181_502_000_000, netIncome: -22_440_000_000, freeCashFlow: -3_421_000_000, totalDebt: 47_182_000_000, totalEquity: 157_150_000_000, totalAssets: 332_750_000_000, pe: null, evEbitda: 28.5, pb: 1.05, ps: 0.92, roe: -0.143, roic: -0.102, debtToEquity: 0.30, currentRatio: 0.93, grossMargin: 0.152, operatingMargin: -0.082, netMargin: -0.124, revenueGrowth: -0.31, epsGrowth: null, dividendYield: 0.068, ebitda: 8_621_000_000, eps: -5.25, bookValuePerShare: 37.44, operatingCashFlow: 14_668_000_000, capitalExpenditure: -18_089_000_000 },
    ],
  },
  {
    profile: {
      ticker: 'PG', name: 'Procter & Gamble Co.', sector: 'Consumer Defensive', industry: 'Household & Personal Products',
      marketCap: 395_000_000_000, exchange: 'NYSE', price: 167.80,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-06-30', revenue: 84_039_000_000, netIncome: 14_996_000_000, freeCashFlow: 14_200_000_000, totalDebt: 28_572_000_000, totalEquity: 49_328_000_000, totalAssets: 120_829_000_000, pe: 27.2, evEbitda: 20.5, pb: 8.2, ps: 4.8, roe: 0.304, roic: 0.215, debtToEquity: 0.58, currentRatio: 0.76, grossMargin: 0.513, operatingMargin: 0.238, netMargin: 0.178, revenueGrowth: 0.02, epsGrowth: 0.02, dividendYield: 0.024, ebitda: 22_345_000_000, eps: 6.20, bookValuePerShare: 20.47, operatingCashFlow: 18_356_000_000, capitalExpenditure: -4_156_000_000 },
      { period: '2023-FY', periodDate: '2023-06-30', revenue: 82_006_000_000, netIncome: 14_653_000_000, freeCashFlow: 13_500_000_000, totalDebt: 30_185_000_000, totalEquity: 46_777_000_000, totalAssets: 120_100_000_000, pe: 26.5, evEbitda: 19.8, pb: 7.8, ps: 4.5, roe: 0.313, roic: 0.220, debtToEquity: 0.65, currentRatio: 0.59, grossMargin: 0.487, operatingMargin: 0.227, netMargin: 0.179, revenueGrowth: 0.02, epsGrowth: -0.01, dividendYield: 0.025, ebitda: 21_356_000_000, eps: 5.90, bookValuePerShare: 19.24, operatingCashFlow: 16_848_000_000, capitalExpenditure: -3_348_000_000 },
      { period: '2022-FY', periodDate: '2022-06-30', revenue: 80_187_000_000, netIncome: 14_742_000_000, freeCashFlow: 13_100_000_000, totalDebt: 29_938_000_000, totalEquity: 46_589_000_000, totalAssets: 117_208_000_000, pe: 22.2, evEbitda: 17.5, pb: 7.2, ps: 4.2, roe: 0.316, roic: 0.218, debtToEquity: 0.64, currentRatio: 0.62, grossMargin: 0.473, operatingMargin: 0.235, netMargin: 0.184, revenueGrowth: 0.05, epsGrowth: 0.06, dividendYield: 0.025, ebitda: 21_856_000_000, eps: 5.81, bookValuePerShare: 19.04, operatingCashFlow: 16_694_000_000, capitalExpenditure: -3_594_000_000 },
      { period: '2021-FY', periodDate: '2021-06-30', revenue: 76_118_000_000, netIncome: 14_306_000_000, freeCashFlow: 14_100_000_000, totalDebt: 32_285_000_000, totalEquity: 46_378_000_000, totalAssets: 119_307_000_000, pe: 25.5, evEbitda: 19.2, pb: 7.5, ps: 4.6, roe: 0.308, roic: 0.198, debtToEquity: 0.70, currentRatio: 0.66, grossMargin: 0.510, operatingMargin: 0.252, netMargin: 0.188, revenueGrowth: 0.07, epsGrowth: 0.10, dividendYield: 0.024, ebitda: 21_085_000_000, eps: 5.66, bookValuePerShare: 18.56, operatingCashFlow: 18_380_000_000, capitalExpenditure: -4_280_000_000 },
      { period: '2020-FY', periodDate: '2020-06-30', revenue: 70_950_000_000, netIncome: 13_027_000_000, freeCashFlow: 14_350_000_000, totalDebt: 30_285_000_000, totalEquity: 46_521_000_000, totalAssets: 120_700_000_000, pe: 24.0, evEbitda: 18.0, pb: 7.0, ps: 4.6, roe: 0.280, roic: 0.172, debtToEquity: 0.65, currentRatio: 0.72, grossMargin: 0.505, operatingMargin: 0.242, netMargin: 0.184, revenueGrowth: 0.05, epsGrowth: 0.13, dividendYield: 0.025, ebitda: 19_352_000_000, eps: 5.12, bookValuePerShare: 18.11, operatingCashFlow: 17_403_000_000, capitalExpenditure: -3_053_000_000 },
    ],
  },
  {
    profile: {
      ticker: 'UNH', name: 'UnitedHealth Group Inc.', sector: 'Healthcare', industry: 'Healthcare Plans',
      marketCap: 420_000_000_000, exchange: 'NYSE', price: 455.10,
    },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 400_278_000_000, netIncome: 14_425_000_000, freeCashFlow: 18_200_000_000, totalDebt: 51_218_000_000, totalEquity: 85_710_000_000, totalAssets: 273_721_000_000, pe: 30.5, evEbitda: 18.5, pb: 5.1, ps: 1.1, roe: 0.168, roic: 0.112, debtToEquity: 0.60, currentRatio: 0.79, grossMargin: 0.232, operatingMargin: 0.068, netMargin: 0.036, revenueGrowth: 0.08, epsGrowth: -0.16, dividendYield: 0.016, ebitda: 32_456_000_000, eps: 15.64, bookValuePerShare: 92.86, operatingCashFlow: 24_562_000_000, capitalExpenditure: -6_362_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 371_622_000_000, netIncome: 22_381_000_000, freeCashFlow: 20_100_000_000, totalDebt: 48_250_000_000, totalEquity: 82_400_000_000, totalAssets: 265_750_000_000, pe: 24.2, evEbitda: 15.2, pb: 5.8, ps: 1.3, roe: 0.272, roic: 0.168, debtToEquity: 0.59, currentRatio: 0.78, grossMargin: 0.241, operatingMargin: 0.088, netMargin: 0.060, revenueGrowth: 0.15, epsGrowth: 0.12, dividendYield: 0.014, ebitda: 35_872_000_000, eps: 23.86, bookValuePerShare: 87.98, operatingCashFlow: 29_100_000_000, capitalExpenditure: -9_000_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 324_162_000_000, netIncome: 20_120_000_000, freeCashFlow: 19_100_000_000, totalDebt: 45_890_000_000, totalEquity: 73_475_000_000, totalAssets: 245_705_000_000, pe: 23.5, evEbitda: 14.8, pb: 5.2, ps: 1.2, roe: 0.274, roic: 0.165, debtToEquity: 0.62, currentRatio: 0.77, grossMargin: 0.239, operatingMargin: 0.089, netMargin: 0.062, revenueGrowth: 0.13, epsGrowth: 0.17, dividendYield: 0.013, ebitda: 32_187_000_000, eps: 21.18, bookValuePerShare: 78.38, operatingCashFlow: 28_452_000_000, capitalExpenditure: -9_352_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 287_597_000_000, netIncome: 17_285_000_000, freeCashFlow: 16_870_000_000, totalDebt: 38_721_000_000, totalEquity: 64_814_000_000, totalAssets: 212_206_000_000, pe: 28.5, evEbitda: 17.2, pb: 6.2, ps: 1.4, roe: 0.267, roic: 0.172, debtToEquity: 0.60, currentRatio: 0.77, grossMargin: 0.240, operatingMargin: 0.088, netMargin: 0.060, revenueGrowth: 0.12, epsGrowth: 0.13, dividendYield: 0.013, ebitda: 29_256_000_000, eps: 18.08, bookValuePerShare: 68.94, operatingCashFlow: 22_317_000_000, capitalExpenditure: -5_447_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 257_141_000_000, netIncome: 15_403_000_000, freeCashFlow: 18_800_000_000, totalDebt: 38_648_000_000, totalEquity: 54_414_000_000, totalAssets: 197_289_000_000, pe: 22.5, evEbitda: 13.8, pb: 5.5, ps: 1.2, roe: 0.283, roic: 0.165, debtToEquity: 0.71, currentRatio: 0.74, grossMargin: 0.251, operatingMargin: 0.089, netMargin: 0.060, revenueGrowth: 0.06, epsGrowth: 0.11, dividendYield: 0.015, ebitda: 25_745_000_000, eps: 16.03, bookValuePerShare: 57.52, operatingCashFlow: 22_174_000_000, capitalExpenditure: -3_374_000_000 },
    ],
  },
  {
    profile: { ticker: 'V', name: 'Visa Inc.', sector: 'Financial Services', industry: 'Credit Services', marketCap: 620_000_000_000, exchange: 'NYSE', price: 315.40 },
    financials: [
      { period: '2024-FY', periodDate: '2024-09-30', revenue: 35_934_000_000, netIncome: 19_743_000_000, freeCashFlow: 19_500_000_000, totalDebt: 20_810_000_000, totalEquity: 36_775_000_000, totalAssets: 94_511_000_000, pe: 31.5, evEbitda: 25.2, pb: 16.2, ps: 17.1, roe: 0.537, roic: 0.358, debtToEquity: 0.57, currentRatio: 1.50, grossMargin: 0.798, operatingMargin: 0.672, netMargin: 0.550, revenueGrowth: 0.10, epsGrowth: 0.14, dividendYield: 0.0075, ebitda: 26_124_000_000, eps: 10.05, bookValuePerShare: 18.88, operatingCashFlow: 21_034_000_000, capitalExpenditure: -1_534_000_000 },
      { period: '2023-FY', periodDate: '2023-09-30', revenue: 32_653_000_000, netIncome: 17_273_000_000, freeCashFlow: 18_400_000_000, totalDebt: 20_463_000_000, totalEquity: 35_247_000_000, totalAssets: 90_499_000_000, pe: 28.2, evEbitda: 22.8, pb: 14.5, ps: 15.6, roe: 0.490, roic: 0.324, debtToEquity: 0.58, currentRatio: 1.42, grossMargin: 0.794, operatingMargin: 0.657, netMargin: 0.529, revenueGrowth: 0.11, epsGrowth: 0.17, dividendYield: 0.0080, ebitda: 23_453_000_000, eps: 8.77, bookValuePerShare: 17.95, operatingCashFlow: 19_734_000_000, capitalExpenditure: -1_334_000_000 },
      { period: '2022-FY', periodDate: '2022-09-30', revenue: 29_310_000_000, netIncome: 14_957_000_000, freeCashFlow: 16_100_000_000, totalDebt: 20_200_000_000, totalEquity: 35_581_000_000, totalAssets: 85_500_000_000, pe: 25.5, evEbitda: 20.5, pb: 11.8, ps: 14.4, roe: 0.420, roic: 0.280, debtToEquity: 0.57, currentRatio: 1.38, grossMargin: 0.790, operatingMargin: 0.642, netMargin: 0.510, revenueGrowth: 0.22, epsGrowth: 0.27, dividendYield: 0.0078, ebitda: 20_875_000_000, eps: 7.50, bookValuePerShare: 17.15, operatingCashFlow: 18_500_000_000, capitalExpenditure: -2_400_000_000 },
      { period: '2021-FY', periodDate: '2021-09-30', revenue: 24_105_000_000, netIncome: 12_311_000_000, freeCashFlow: 14_500_000_000, totalDebt: 20_977_000_000, totalEquity: 35_483_000_000, totalAssets: 82_896_000_000, pe: 35.5, evEbitda: 28.0, pb: 14.0, ps: 20.5, roe: 0.347, roic: 0.222, debtToEquity: 0.59, currentRatio: 1.52, grossMargin: 0.786, operatingMargin: 0.655, netMargin: 0.511, revenueGrowth: 0.10, epsGrowth: 0.15, dividendYield: 0.0062, ebitda: 17_345_000_000, eps: 5.91, bookValuePerShare: 17.04, operatingCashFlow: 15_824_000_000, capitalExpenditure: -1_324_000_000 },
      { period: '2020-FY', periodDate: '2020-09-30', revenue: 21_846_000_000, netIncome: 10_866_000_000, freeCashFlow: 12_700_000_000, totalDebt: 22_000_000_000, totalEquity: 36_210_000_000, totalAssets: 80_919_000_000, pe: 32.5, evEbitda: 25.8, pb: 11.5, ps: 19.1, roe: 0.300, roic: 0.192, debtToEquity: 0.61, currentRatio: 1.80, grossMargin: 0.782, operatingMargin: 0.641, netMargin: 0.497, revenueGrowth: -0.05, epsGrowth: -0.07, dividendYield: 0.0068, ebitda: 15_672_000_000, eps: 5.04, bookValuePerShare: 16.82, operatingCashFlow: 14_542_000_000, capitalExpenditure: -1_842_000_000 },
    ],
  },
  {
    profile: { ticker: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive', industry: 'Discount Stores', marketCap: 680_000_000_000, exchange: 'NYSE', price: 85.20 },
    financials: [
      { period: '2024-FY', periodDate: '2025-01-31', revenue: 674_538_000_000, netIncome: 19_436_000_000, freeCashFlow: 12_700_000_000, totalDebt: 38_110_000_000, totalEquity: 91_395_000_000, totalAssets: 260_114_000_000, pe: 36.5, evEbitda: 17.8, pb: 7.8, ps: 1.05, roe: 0.213, roic: 0.148, debtToEquity: 0.42, currentRatio: 0.85, grossMargin: 0.244, operatingMargin: 0.042, netMargin: 0.029, revenueGrowth: 0.05, epsGrowth: 0.13, dividendYield: 0.0098, ebitda: 40_256_000_000, eps: 2.41, bookValuePerShare: 11.36, operatingCashFlow: 36_413_000_000, capitalExpenditure: -23_713_000_000 },
      { period: '2023-FY', periodDate: '2024-01-31', revenue: 642_637_000_000, netIncome: 15_511_000_000, freeCashFlow: 11_800_000_000, totalDebt: 38_724_000_000, totalEquity: 83_861_000_000, totalAssets: 252_399_000_000, pe: 28.0, evEbitda: 14.2, pb: 6.5, ps: 0.85, roe: 0.185, roic: 0.128, debtToEquity: 0.46, currentRatio: 0.82, grossMargin: 0.241, operatingMargin: 0.040, netMargin: 0.024, revenueGrowth: 0.06, epsGrowth: -0.14, dividendYield: 0.0142, ebitda: 36_872_000_000, eps: 2.08, bookValuePerShare: 10.56, operatingCashFlow: 36_440_000_000, capitalExpenditure: -24_640_000_000 },
      { period: '2022-FY', periodDate: '2023-01-31', revenue: 605_881_000_000, netIncome: 11_680_000_000, freeCashFlow: 9_800_000_000, totalDebt: 36_122_000_000, totalEquity: 76_693_000_000, totalAssets: 243_197_000_000, pe: 24.5, evEbitda: 12.5, pb: 5.2, ps: 0.66, roe: 0.152, roic: 0.105, debtToEquity: 0.47, currentRatio: 0.82, grossMargin: 0.238, operatingMargin: 0.036, netMargin: 0.019, revenueGrowth: 0.07, epsGrowth: -0.18, dividendYield: 0.0165, ebitda: 32_456_000_000, eps: 1.78, bookValuePerShare: 9.62, operatingCashFlow: 28_841_000_000, capitalExpenditure: -19_041_000_000 },
      { period: '2021-FY', periodDate: '2022-01-31', revenue: 567_762_000_000, netIncome: 13_673_000_000, freeCashFlow: 14_600_000_000, totalDebt: 41_194_000_000, totalEquity: 82_274_000_000, totalAssets: 244_860_000_000, pe: 36.5, evEbitda: 15.2, pb: 5.0, ps: 0.72, roe: 0.166, roic: 0.112, debtToEquity: 0.50, currentRatio: 0.93, grossMargin: 0.250, operatingMargin: 0.042, netMargin: 0.024, revenueGrowth: 0.02, epsGrowth: -0.02, dividendYield: 0.0155, ebitda: 35_543_000_000, eps: 2.08, bookValuePerShare: 10.14, operatingCashFlow: 24_181_000_000, capitalExpenditure: -9_581_000_000 },
      { period: '2020-FY', periodDate: '2021-01-31', revenue: 559_151_000_000, netIncome: 13_510_000_000, freeCashFlow: 15_100_000_000, totalDebt: 44_320_000_000, totalEquity: 80_925_000_000, totalAssets: 252_496_000_000, pe: 22.5, evEbitda: 11.5, pb: 3.8, ps: 0.55, roe: 0.167, roic: 0.105, debtToEquity: 0.55, currentRatio: 0.97, grossMargin: 0.249, operatingMargin: 0.041, netMargin: 0.024, revenueGrowth: 0.07, epsGrowth: 0.10, dividendYield: 0.0155, ebitda: 33_125_000_000, eps: 2.15, bookValuePerShare: 9.88, operatingCashFlow: 36_074_000_000, capitalExpenditure: -20_974_000_000 },
    ],
  },
  {
    profile: { ticker: 'MA', name: 'Mastercard Inc.', sector: 'Financial Services', industry: 'Credit Services', marketCap: 480_000_000_000, exchange: 'NYSE', price: 528.60 },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 28_167_000_000, netIncome: 12_873_000_000, freeCashFlow: 12_400_000_000, totalDebt: 16_418_000_000, totalEquity: 6_802_000_000, totalAssets: 42_470_000_000, pe: 36.8, evEbitda: 28.5, pb: 68.5, ps: 16.6, roe: 1.892, roic: 0.545, debtToEquity: 2.41, currentRatio: 1.15, grossMargin: 0.788, operatingMargin: 0.578, netMargin: 0.457, revenueGrowth: 0.12, epsGrowth: 0.17, dividendYield: 0.006, ebitda: 17_345_000_000, eps: 14.36, bookValuePerShare: 7.58, operatingCashFlow: 13_256_000_000, capitalExpenditure: -856_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 25_098_000_000, netIncome: 11_195_000_000, freeCashFlow: 11_800_000_000, totalDebt: 15_681_000_000, totalEquity: 5_971_000_000, totalAssets: 38_724_000_000, pe: 34.0, evEbitda: 26.5, pb: 64.2, ps: 15.2, roe: 1.875, roic: 0.520, debtToEquity: 2.63, currentRatio: 1.22, grossMargin: 0.785, operatingMargin: 0.571, netMargin: 0.446, revenueGrowth: 0.13, epsGrowth: 0.13, dividendYield: 0.006, ebitda: 15_245_000_000, eps: 12.26, bookValuePerShare: 6.51, operatingCashFlow: 12_456_000_000, capitalExpenditure: -656_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 22_237_000_000, netIncome: 9_930_000_000, freeCashFlow: 10_200_000_000, totalDebt: 14_225_000_000, totalEquity: 5_789_000_000, totalAssets: 38_724_000_000, pe: 28.5, evEbitda: 22.5, pb: 52.0, ps: 13.5, roe: 1.715, roic: 0.495, debtToEquity: 2.46, currentRatio: 1.20, grossMargin: 0.782, operatingMargin: 0.562, netMargin: 0.447, revenueGrowth: 0.18, epsGrowth: 0.15, dividendYield: 0.006, ebitda: 13_456_000_000, eps: 10.68, bookValuePerShare: 6.12, operatingCashFlow: 11_256_000_000, capitalExpenditure: -1_056_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 18_884_000_000, netIncome: 8_687_000_000, freeCashFlow: 8_500_000_000, totalDebt: 13_823_000_000, totalEquity: 5_234_000_000, totalAssets: 37_669_000_000, pe: 35.5, evEbitda: 28.5, pb: 58.0, ps: 16.1, roe: 1.660, roic: 0.455, debtToEquity: 2.64, currentRatio: 1.28, grossMargin: 0.780, operatingMargin: 0.552, netMargin: 0.460, revenueGrowth: 0.23, epsGrowth: 0.35, dividendYield: 0.005, ebitda: 11_245_000_000, eps: 9.24, bookValuePerShare: 5.54, operatingCashFlow: 9_456_000_000, capitalExpenditure: -956_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 15_301_000_000, netIncome: 6_411_000_000, freeCashFlow: 7_200_000_000, totalDebt: 12_624_000_000, totalEquity: 5_686_000_000, totalAssets: 33_497_000_000, pe: 42.5, evEbitda: 32.5, pb: 43.0, ps: 16.0, roe: 1.128, roic: 0.355, debtToEquity: 2.22, currentRatio: 1.80, grossMargin: 0.775, operatingMargin: 0.535, netMargin: 0.419, revenueGrowth: -0.09, epsGrowth: -0.15, dividendYield: 0.005, ebitda: 9_256_000_000, eps: 6.37, bookValuePerShare: 5.72, operatingCashFlow: 7_856_000_000, capitalExpenditure: -656_000_000 },
    ],
  },
  {
    profile: { ticker: 'HD', name: 'The Home Depot Inc.', sector: 'Consumer Cyclical', industry: 'Home Improvement Retail', marketCap: 370_000_000_000, exchange: 'NYSE', price: 372.40 },
    financials: [
      { period: '2024-FY', periodDate: '2025-02-02', revenue: 159_514_000_000, netIncome: 14_806_000_000, freeCashFlow: 14_600_000_000, totalDebt: 50_178_000_000, totalEquity: 2_763_000_000, totalAssets: 96_298_000_000, pe: 25.8, evEbitda: 18.5, pb: null, ps: 2.4, roe: 5.360, roic: 0.322, debtToEquity: 18.16, currentRatio: 1.07, grossMargin: 0.335, operatingMargin: 0.140, netMargin: 0.093, revenueGrowth: 0.04, epsGrowth: 0.02, dividendYield: 0.024, ebitda: 24_878_000_000, eps: 14.91, bookValuePerShare: 2.79, operatingCashFlow: 20_100_000_000, capitalExpenditure: -5_500_000_000 },
      { period: '2023-FY', periodDate: '2024-01-28', revenue: 152_669_000_000, netIncome: 15_143_000_000, freeCashFlow: 15_200_000_000, totalDebt: 42_743_000_000, totalEquity: 1_044_000_000, totalAssets: 76_530_000_000, pe: 24.2, evEbitda: 17.5, pb: null, ps: 2.4, roe: 14.505, roic: 0.435, debtToEquity: 40.94, currentRatio: 1.41, grossMargin: 0.333, operatingMargin: 0.145, netMargin: 0.099, revenueGrowth: -0.03, epsGrowth: -0.10, dividendYield: 0.025, ebitda: 24_456_000_000, eps: 15.11, bookValuePerShare: 1.04, operatingCashFlow: 18_206_000_000, capitalExpenditure: -3_006_000_000 },
      { period: '2022-FY', periodDate: '2023-01-29', revenue: 157_403_000_000, netIncome: 17_105_000_000, freeCashFlow: 14_600_000_000, totalDebt: 41_988_000_000, totalEquity: -1_696_000_000, totalAssets: 76_445_000_000, pe: 18.5, evEbitda: 14.2, pb: null, ps: 1.8, roe: null, roic: 0.450, debtToEquity: null, currentRatio: 1.01, grossMargin: 0.334, operatingMargin: 0.156, netMargin: 0.109, revenueGrowth: 0.04, epsGrowth: 0.07, dividendYield: 0.025, ebitda: 26_456_000_000, eps: 16.69, bookValuePerShare: -1.65, operatingCashFlow: 16_400_000_000, capitalExpenditure: -1_800_000_000 },
      { period: '2021-FY', periodDate: '2022-01-30', revenue: 151_157_000_000, netIncome: 16_433_000_000, freeCashFlow: 14_200_000_000, totalDebt: 38_228_000_000, totalEquity: -1_267_000_000, totalAssets: 71_876_000_000, pe: 22.5, evEbitda: 16.5, pb: null, ps: 2.2, roe: null, roic: 0.455, debtToEquity: null, currentRatio: 1.01, grossMargin: 0.338, operatingMargin: 0.158, netMargin: 0.109, revenueGrowth: 0.14, epsGrowth: 0.28, dividendYield: 0.019, ebitda: 25_678_000_000, eps: 15.53, bookValuePerShare: -1.21, operatingCashFlow: 16_571_000_000, capitalExpenditure: -2_371_000_000 },
      { period: '2020-FY', periodDate: '2021-01-31', revenue: 132_110_000_000, netIncome: 12_866_000_000, freeCashFlow: 13_800_000_000, totalDebt: 35_824_000_000, totalEquity: 3_299_000_000, totalAssets: 70_581_000_000, pe: 23.5, evEbitda: 16.5, pb: null, ps: 2.1, roe: 3.900, roic: 0.340, debtToEquity: 10.86, currentRatio: 1.23, grossMargin: 0.339, operatingMargin: 0.142, netMargin: 0.097, revenueGrowth: 0.20, epsGrowth: 0.16, dividendYield: 0.022, ebitda: 20_756_000_000, eps: 11.94, bookValuePerShare: 3.06, operatingCashFlow: 18_839_000_000, capitalExpenditure: -5_039_000_000 },
    ],
  },
  {
    profile: { ticker: 'NEE', name: 'NextEra Energy Inc.', sector: 'Utilities', industry: 'Utilities - Regulated Electric', marketCap: 155_000_000_000, exchange: 'NYSE', price: 74.80 },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 24_861_000_000, netIncome: 7_202_000_000, freeCashFlow: -3_200_000_000, totalDebt: 74_350_000_000, totalEquity: 44_250_000_000, totalAssets: 171_856_000_000, pe: 22.5, evEbitda: 18.5, pb: 3.6, ps: 6.4, roe: 0.163, roic: 0.058, debtToEquity: 1.68, currentRatio: 0.52, grossMargin: 0.565, operatingMargin: 0.372, netMargin: 0.290, revenueGrowth: 0.11, epsGrowth: 0.06, dividendYield: 0.028, ebitda: 12_345_000_000, eps: 3.48, bookValuePerShare: 21.42, operatingCashFlow: 11_456_000_000, capitalExpenditure: -14_656_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 22_327_000_000, netIncome: 7_310_000_000, freeCashFlow: -4_500_000_000, totalDebt: 68_250_000_000, totalEquity: 40_180_000_000, totalAssets: 158_756_000_000, pe: 18.5, evEbitda: 15.2, pb: 3.2, ps: 5.8, roe: 0.182, roic: 0.065, debtToEquity: 1.70, currentRatio: 0.45, grossMargin: 0.572, operatingMargin: 0.392, netMargin: 0.327, revenueGrowth: -0.07, epsGrowth: 0.10, dividendYield: 0.030, ebitda: 11_456_000_000, eps: 3.56, bookValuePerShare: 19.78, operatingCashFlow: 9_856_000_000, capitalExpenditure: -14_356_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 24_068_000_000, netIncome: 4_147_000_000, freeCashFlow: -8_200_000_000, totalDebt: 58_250_000_000, totalEquity: 37_890_000_000, totalAssets: 139_256_000_000, pe: 32.5, evEbitda: 22.5, pb: 3.4, ps: 5.3, roe: 0.109, roic: 0.045, debtToEquity: 1.54, currentRatio: 0.52, grossMargin: 0.412, operatingMargin: 0.228, netMargin: 0.172, revenueGrowth: 0.22, epsGrowth: -0.37, dividendYield: 0.020, ebitda: 8_456_000_000, eps: 2.10, bookValuePerShare: 19.18, operatingCashFlow: 8_256_000_000, capitalExpenditure: -16_456_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 19_788_000_000, netIncome: 3_573_000_000, freeCashFlow: -4_200_000_000, totalDebt: 47_850_000_000, totalEquity: 35_640_000_000, totalAssets: 123_756_000_000, pe: 42.5, evEbitda: 28.5, pb: 4.5, ps: 8.2, roe: 0.100, roic: 0.042, debtToEquity: 1.34, currentRatio: 0.55, grossMargin: 0.435, operatingMargin: 0.242, netMargin: 0.181, revenueGrowth: 0.16, epsGrowth: 0.12, dividendYield: 0.019, ebitda: 6_856_000_000, eps: 1.81, bookValuePerShare: 18.08, operatingCashFlow: 7_856_000_000, capitalExpenditure: -12_056_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 17_997_000_000, netIncome: 2_919_000_000, freeCashFlow: -5_100_000_000, totalDebt: 41_250_000_000, totalEquity: 29_850_000_000, totalAssets: 104_256_000_000, pe: 48.5, evEbitda: 32.5, pb: 5.2, ps: 8.6, roe: 0.098, roic: 0.040, debtToEquity: 1.38, currentRatio: 0.54, grossMargin: 0.415, operatingMargin: 0.215, netMargin: 0.162, revenueGrowth: -0.14, epsGrowth: 0.15, dividendYield: 0.019, ebitda: 5_756_000_000, eps: 1.48, bookValuePerShare: 15.18, operatingCashFlow: 6_756_000_000, capitalExpenditure: -11_856_000_000 },
    ],
  },
  {
    profile: { ticker: 'META', name: 'Meta Platforms Inc.', sector: 'Technology', industry: 'Internet Content & Information', marketCap: 1_600_000_000_000, exchange: 'NASDAQ', price: 630.50 },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 164_503_000_000, netIncome: 62_360_000_000, freeCashFlow: 42_500_000_000, totalDebt: 28_834_000_000, totalEquity: 153_168_000_000, totalAssets: 256_166_000_000, pe: 26.2, evEbitda: 18.5, pb: 10.5, ps: 9.8, roe: 0.407, roic: 0.348, debtToEquity: 0.19, currentRatio: 2.73, grossMargin: 0.815, operatingMargin: 0.418, netMargin: 0.379, revenueGrowth: 0.22, epsGrowth: 0.59, dividendYield: 0.0032, ebitda: 84_567_000_000, eps: 23.86, bookValuePerShare: 60.25, operatingCashFlow: 77_991_000_000, capitalExpenditure: -35_491_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 134_902_000_000, netIncome: 39_098_000_000, freeCashFlow: 43_001_000_000, totalDebt: 18_385_000_000, totalEquity: 125_713_000_000, totalAssets: 229_623_000_000, pe: 28.5, evEbitda: 18.8, pb: 7.2, ps: 6.7, roe: 0.311, roic: 0.280, debtToEquity: 0.15, currentRatio: 2.67, grossMargin: 0.808, operatingMargin: 0.346, netMargin: 0.290, revenueGrowth: 0.16, epsGrowth: 0.73, dividendYield: 0.0, ebitda: 61_245_000_000, eps: 14.87, bookValuePerShare: 48.62, operatingCashFlow: 71_113_000_000, capitalExpenditure: -28_112_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 116_609_000_000, netIncome: 23_200_000_000, freeCashFlow: 18_600_000_000, totalDebt: 9_922_000_000, totalEquity: 125_713_000_000, totalAssets: 185_727_000_000, pe: 15.8, evEbitda: 10.2, pb: 2.5, ps: 2.7, roe: 0.184, roic: 0.170, debtToEquity: 0.08, currentRatio: 2.20, grossMargin: 0.784, operatingMargin: 0.249, netMargin: 0.199, revenueGrowth: -0.01, epsGrowth: -0.38, dividendYield: 0.0, ebitda: 38_245_000_000, eps: 8.59, bookValuePerShare: 47.02, operatingCashFlow: 50_475_000_000, capitalExpenditure: -31_875_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 117_929_000_000, netIncome: 39_370_000_000, freeCashFlow: 39_116_000_000, totalDebt: 0, totalEquity: 124_879_000_000, totalAssets: 165_987_000_000, pe: 22.2, evEbitda: 14.5, pb: 6.8, ps: 7.2, roe: 0.315, roic: 0.310, debtToEquity: 0.0, currentRatio: 4.65, grossMargin: 0.808, operatingMargin: 0.396, netMargin: 0.334, revenueGrowth: 0.37, epsGrowth: 0.36, dividendYield: 0.0, ebitda: 54_234_000_000, eps: 13.77, bookValuePerShare: 45.52, operatingCashFlow: 57_683_000_000, capitalExpenditure: -18_567_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 85_965_000_000, netIncome: 29_146_000_000, freeCashFlow: 23_632_000_000, totalDebt: 0, totalEquity: 128_290_000_000, totalAssets: 159_316_000_000, pe: 25.5, evEbitda: 16.2, pb: 5.3, ps: 7.9, roe: 0.227, roic: 0.224, debtToEquity: 0.0, currentRatio: 5.05, grossMargin: 0.806, operatingMargin: 0.380, netMargin: 0.339, revenueGrowth: 0.22, epsGrowth: 0.58, dividendYield: 0.0, ebitda: 39_456_000_000, eps: 10.09, bookValuePerShare: 46.56, operatingCashFlow: 38_747_000_000, capitalExpenditure: -15_115_000_000 },
    ],
  },
  {
    profile: { ticker: 'LLY', name: 'Eli Lilly and Company', sector: 'Healthcare', industry: 'Drug Manufacturers', marketCap: 740_000_000_000, exchange: 'NYSE', price: 822.30 },
    financials: [
      { period: '2024-FY', periodDate: '2024-12-31', revenue: 45_036_000_000, netIncome: 10_592_000_000, freeCashFlow: 5_200_000_000, totalDebt: 29_838_000_000, totalEquity: 12_826_000_000, totalAssets: 75_866_000_000, pe: 72.5, evEbitda: 52.5, pb: 58.5, ps: 16.8, roe: 0.826, roic: 0.282, debtToEquity: 2.33, currentRatio: 1.11, grossMargin: 0.808, operatingMargin: 0.312, netMargin: 0.235, revenueGrowth: 0.32, epsGrowth: 0.07, dividendYield: 0.006, ebitda: 14_534_000_000, eps: 11.81, bookValuePerShare: 14.28, operatingCashFlow: 8_956_000_000, capitalExpenditure: -3_756_000_000 },
      { period: '2023-FY', periodDate: '2023-12-31', revenue: 34_124_000_000, netIncome: 5_240_000_000, freeCashFlow: 3_600_000_000, totalDebt: 22_415_000_000, totalEquity: 10_771_000_000, totalAssets: 64_006_000_000, pe: 105.0, evEbitda: 72.5, pb: 52.5, ps: 16.5, roe: 0.486, roic: 0.168, debtToEquity: 2.08, currentRatio: 1.43, grossMargin: 0.798, operatingMargin: 0.215, netMargin: 0.154, revenueGrowth: 0.20, epsGrowth: -0.56, dividendYield: 0.008, ebitda: 8_456_000_000, eps: 5.80, bookValuePerShare: 11.92, operatingCashFlow: 6_456_000_000, capitalExpenditure: -2_856_000_000 },
      { period: '2022-FY', periodDate: '2022-12-31', revenue: 28_541_000_000, netIncome: 6_245_000_000, freeCashFlow: 4_800_000_000, totalDebt: 18_635_000_000, totalEquity: 8_979_000_000, totalAssets: 49_367_000_000, pe: 48.5, evEbitda: 35.5, pb: 38.5, ps: 12.2, roe: 0.695, roic: 0.235, debtToEquity: 2.08, currentRatio: 1.48, grossMargin: 0.775, operatingMargin: 0.292, netMargin: 0.219, revenueGrowth: 0.01, epsGrowth: 0.05, dividendYield: 0.012, ebitda: 10_245_000_000, eps: 6.93, bookValuePerShare: 9.95, operatingCashFlow: 7_056_000_000, capitalExpenditure: -2_256_000_000 },
      { period: '2021-FY', periodDate: '2021-12-31', revenue: 28_318_000_000, netIncome: 5_637_000_000, freeCashFlow: 4_900_000_000, totalDebt: 18_326_000_000, totalEquity: 8_784_000_000, totalAssets: 45_603_000_000, pe: 42.5, evEbitda: 32.5, pb: 28.0, ps: 8.7, roe: 0.642, roic: 0.218, debtToEquity: 2.09, currentRatio: 1.23, grossMargin: 0.755, operatingMargin: 0.268, netMargin: 0.199, revenueGrowth: 0.15, epsGrowth: 0.07, dividendYield: 0.014, ebitda: 9_456_000_000, eps: 6.22, bookValuePerShare: 9.68, operatingCashFlow: 7_456_000_000, capitalExpenditure: -2_556_000_000 },
      { period: '2020-FY', periodDate: '2020-12-31', revenue: 24_540_000_000, netIncome: 5_580_000_000, freeCashFlow: 5_200_000_000, totalDebt: 16_586_000_000, totalEquity: 5_641_000_000, totalAssets: 39_563_000_000, pe: 35.5, evEbitda: 25.5, pb: 32.2, ps: 7.5, roe: 0.989, roic: 0.252, debtToEquity: 2.94, currentRatio: 1.40, grossMargin: 0.768, operatingMargin: 0.285, netMargin: 0.227, revenueGrowth: 0.10, epsGrowth: 0.26, dividendYield: 0.018, ebitda: 8_756_000_000, eps: 6.02, bookValuePerShare: 6.09, operatingCashFlow: 7_256_000_000, capitalExpenditure: -2_056_000_000 },
    ],
  },
];

// Seeded random for deterministic results
let seed = 42;
function seededRandom() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

const priceCache: Record<string, HistoricalPrice[]> = {};

export function getMockCompanies(): CompanyProfile[] {
  return MOCK_COMPANIES.map((c) => c.profile);
}

export function getMockProfile(ticker: string): CompanyProfile | null {
  return MOCK_COMPANIES.find((c) => c.profile.ticker === ticker)?.profile || null;
}

export function getMockFinancials(ticker: string): FinancialData[] {
  return MOCK_COMPANIES.find((c) => c.profile.ticker === ticker)?.financials || [];
}

export function getMockHistoricalPrices(ticker: string): HistoricalPrice[] {
  if (priceCache[ticker]) return priceCache[ticker];
  const company = MOCK_COMPANIES.find((c) => c.profile.ticker === ticker);
  if (!company) return [];
  seed = ticker.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0); // deterministic per ticker
  const volatility = company.profile.sector === 'Technology' ? 0.025 : 0.015;
  const prices = generatePriceHistory(company.profile.price, volatility, 5);
  priceCache[ticker] = prices;
  return prices;
}

export function searchMockCompanies(query: string): Array<{ symbol: string; name: string; exchange: string }> {
  const q = query.toUpperCase();
  return MOCK_COMPANIES
    .filter((c) => c.profile.ticker.includes(q) || c.profile.name.toUpperCase().includes(q))
    .map((c) => ({ symbol: c.profile.ticker, name: c.profile.name, exchange: c.profile.exchange }));
}
