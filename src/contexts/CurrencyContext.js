import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const CurrencyContext = createContext();

// Comprehensive currency mapping by country
export const currencyMapping = {
  // UAE
  'United Arab Emirates': { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  'UAE': { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  
  // USA
  'United States': { code: 'USD', name: 'US Dollar', symbol: '$' },
  'United States of America': { code: 'USD', name: 'US Dollar', symbol: '$' },
  'USA': { code: 'USD', name: 'US Dollar', symbol: '$' },
  
  // Europe
  'Germany': { code: 'EUR', name: 'Euro', symbol: '€' },
  'France': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Italy': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Spain': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Netherlands': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Belgium': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Austria': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Ireland': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Portugal': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Greece': { code: 'EUR', name: 'Euro', symbol: '€' },
  'Finland': { code: 'EUR', name: 'Euro', symbol: '€' },
  
  // UK
  'United Kingdom': { code: 'GBP', name: 'British Pound', symbol: '£' },
  'UK': { code: 'GBP', name: 'British Pound', symbol: '£' },
  'Great Britain': { code: 'GBP', name: 'British Pound', symbol: '£' },
  'England': { code: 'GBP', name: 'British Pound', symbol: '£' },
  
  // GCC Countries
  'Saudi Arabia': { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  'Kingdom of Saudi Arabia': { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  'Kuwait': { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
  'Qatar': { code: 'QAR', name: 'Qatari Riyal', symbol: '﷼' },
  'Bahrain': { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب' },
  'Oman': { code: 'OMR', name: 'Omani Rial', symbol: '﷼' },
  
  // Asia
  'Japan': { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  'China': { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  'India': { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  'South Korea': { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  'Singapore': { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  'Hong Kong': { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  'Malaysia': { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  'Thailand': { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  'Indonesia': { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  'Philippines': { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  'Vietnam': { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  'Pakistan': { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨' },
  'Bangladesh': { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  'Sri Lanka': { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  'Taiwan': { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$' },
  
  // Oceania
  'Australia': { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  'New Zealand': { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  
  // Americas
  'Canada': { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  'Mexico': { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
  'Brazil': { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  'Argentina': { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
  'Chile': { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
  'Colombia': { code: 'COP', name: 'Colombian Peso', symbol: '$' },
  'Peru': { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/' },
  
  // Middle East
  'Iraq': { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د' },
  'Iran': { code: 'IRR', name: 'Iranian Rial', symbol: '﷼' },
  'Turkey': { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  'Israel': { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
  'Jordan': { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا' },
  'Lebanon': { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل' },
  'Egypt': { code: 'EGP', name: 'Egyptian Pound', symbol: '£' },
  
  // Africa
  'South Africa': { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
  'Nigeria': { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  'Kenya': { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  'Ghana': { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵' },
  'Morocco': { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.' },
  'Tunisia': { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت' },
  'Algeria': { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج' },
  
  // Europe (non-Euro)
  'Switzerland': { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  'Sweden': { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  'Norway': { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  'Denmark': { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  'Poland': { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  'Czech Republic': { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  'Hungary': { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  'Romania': { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  'Russia': { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  'Ukraine': { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
};

// Get list of countries for dropdown
export const getCountryList = () => {
  const countries = Object.keys(currencyMapping);
  // Remove duplicates (like USA/United States)
  const uniqueCountries = [...new Set(countries.map(c => {
    // Normalize to preferred name
    if (c === 'USA' || c === 'United States of America') return 'United States';
    if (c === 'UK' || c === 'Great Britain' || c === 'England') return 'United Kingdom';
    if (c === 'Kingdom of Saudi Arabia') return 'Saudi Arabia';
    return c;
  }))];
  return uniqueCountries.sort();
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const [companyCurrency, setCompanyCurrency] = useState({
    country: 'United Arab Emirates',
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'د.إ'
  });
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Load currency setting on mount
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/settings/company`);
        if (response.data.success && response.data.settings.currency) {
          const currency = response.data.settings.currency;
          setCompanyCurrency(currency);
        }
      } catch (error) {
        console.error('Error loading currency settings:', error);
        // Keep default UAE Dirham
      } finally {
        setLoading(false);
      }
    };
    loadCurrency();
  }, [API_BASE_URL]);

  // Update currency by country
  const setCurrencyByCountry = useCallback((country) => {
    const currencyInfo = currencyMapping[country];
    if (currencyInfo) {
      const newCurrency = {
        country,
        ...currencyInfo
      };
      setCompanyCurrency(newCurrency);
      return newCurrency;
    }
    return null;
  }, []);

  // Format amount with currency symbol
  const formatCurrency = useCallback((amount, options = {}) => {
    const { 
      includeSymbol = true, 
      decimals = 0,
      abbreviated = false 
    } = options;
    
    if (amount === null || amount === undefined || isNaN(amount)) {
      return includeSymbol ? `${companyCurrency.symbol}0` : '0';
    }
    
    let value = Number(amount);
    let suffix = '';
    
    if (abbreviated) {
      if (Math.abs(value) >= 1000000000) {
        value = value / 1000000000;
        suffix = 'B';
      } else if (Math.abs(value) >= 1000000) {
        value = value / 1000000;
        suffix = 'M';
      } else if (Math.abs(value) >= 1000) {
        value = value / 1000;
        suffix = 'K';
      }
    }
    
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }) + suffix;
    
    if (includeSymbol) {
      return `${companyCurrency.symbol}${formatted}`;
    }
    return formatted;
  }, [companyCurrency.symbol]);

  // Get just the symbol
  const getCurrencySymbol = useCallback(() => {
    return companyCurrency.symbol;
  }, [companyCurrency.symbol]);

  // Check if current currency is UAE Dirham (for SVG symbol)
  const isUAEDirham = useCallback(() => {
    return companyCurrency.code === 'AED';
  }, [companyCurrency.code]);

  const value = {
    companyCurrency,
    setCompanyCurrency,
    setCurrencyByCountry,
    formatCurrency,
    getCurrencySymbol,
    isUAEDirham,
    loading,
    currencyMapping,
    getCountryList
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export default CurrencyContext;
