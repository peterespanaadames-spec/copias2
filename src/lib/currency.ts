/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbService } from './supabase';

export type CurrencyCode = 'USD' | 'EUR' | 'VES' | 'COP';

export const DEFAULT_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  EUR: 0.92,
  VES: 45.5,
  COP: 4100
};

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  position: 'prefix' | 'suffix';
  thousandSeparator: string;
  decimalSeparator: string;
  decimals: number;
  label: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    position: 'prefix',
    thousandSeparator: ',',
    decimalSeparator: '.',
    decimals: 2,
    label: 'Dólar (USD)',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    position: 'suffix',
    thousandSeparator: '.',
    decimalSeparator: ',',
    decimals: 2,
    label: 'Euro (EUR)',
  },
  VES: {
    code: 'VES',
    symbol: 'Bs.',
    position: 'prefix',
    thousandSeparator: '.',
    decimalSeparator: ',',
    decimals: 2,
    label: 'Bolívar (VES)',
  },
  COP: {
    code: 'COP',
    symbol: 'COP$',
    position: 'prefix',
    thousandSeparator: '.',
    decimalSeparator: ',',
    decimals: 0,
    label: 'Peso Colombiano (COP)',
  },
};

// Global state / helper for formatters
export function formatCurrency(amountUSD: number, currencyCode: CurrencyCode, rates: Record<CurrencyCode, number>): string {
  const rate = rates[currencyCode] || 1;
  const convertedAmount = amountUSD * rate;
  const config = CURRENCIES[currencyCode];

  if (!config) return `$ ${amountUSD.toFixed(2)}`;

  let formattedNumber = '';
  if (config.decimals === 0) {
    const rounded = Math.round(convertedAmount);
    formattedNumber = formatNumberWithSeparators(rounded, config.thousandSeparator, config.decimalSeparator, 0);
  } else {
    formattedNumber = formatNumberWithSeparators(convertedAmount, config.thousandSeparator, config.decimalSeparator, config.decimals);
  }

  if (config.position === 'prefix') {
    return `${config.symbol} ${formattedNumber}`;
  } else {
    return `${formattedNumber} ${config.symbol}`;
  }
}

function formatNumberWithSeparators(
  num: number,
  thousandSep: string,
  decimalSep: string,
  decimals: number
): string {
  const parts = num.toFixed(decimals).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] ? decimalSep + parts[1] : '';

  // Add thousand separators
  const r = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
  return r + decimalPart;
}

// Local storage helpers
export function getSavedCurrency(): CurrencyCode {
  return 'VES';
}

export function saveCurrency(code: CurrencyCode): void {
  localStorage.setItem('copias_bellavista_active_currency', code);
}
