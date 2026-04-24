interface ExchangeRateCache {
  rates: Record<string, number>;
  base: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const rateCache: Record<string, ExchangeRateCache> = {};

export async function getExchangeRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
  const upper = baseCurrency.toUpperCase();
  const cached = rateCache[upper];

  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rates;
  }

  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${upper}`);
    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }

    const data = await response.json() as { result: string; rates: Record<string, number> };
    if (data.result !== 'success') {
      throw new Error('Exchange rate API returned unsuccessful result');
    }

    rateCache[upper] = {
      rates: data.rates,
      base: upper,
      fetchedAt: Date.now(),
    };

    return data.rates;
  } catch (error) {
    // If we have stale cache, return it as fallback
    if (cached) {
      console.warn(`Failed to fetch fresh rates for ${upper}, using stale cache`);
      return cached.rates;
    }
    throw error;
  }
}

export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) return amount;

  const rates = await getExchangeRates(from);
  const rate = rates[to];

  if (!rate) {
    throw new Error(`No exchange rate found for ${from} -> ${to}`);
  }

  return Math.round(amount * rate * 100) / 100;
}
