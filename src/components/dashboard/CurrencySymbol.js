import React from 'react';
import { useCurrency } from '../../contexts/CurrencyContext';
import UAEDirhamSymbol from './UAEDirhamSymbol';

/**
 * CurrencySymbol Component
 * Displays the company's configured currency symbol.
 * For UAE Dirham, it uses the special SVG symbol.
 * For other currencies, it displays the text symbol.
 */
const CurrencySymbol = ({ className = '', style = {} }) => {
  const { companyCurrency, isUAEDirham } = useCurrency();
  
  // For UAE Dirham, use the SVG symbol
  if (isUAEDirham()) {
    return <UAEDirhamSymbol className={className} style={style} />;
  }
  
  // For other currencies, display the text symbol
  const defaultStyle = {
    display: 'inline',
    marginRight: '0.15em',
    fontWeight: 'inherit',
    ...style
  };
  
  return (
    <span 
      className={`currency-symbol ${className}`} 
      style={defaultStyle}
      aria-label={`${companyCurrency.name} Symbol`}
    >
      {companyCurrency.symbol}
    </span>
  );
};

export default CurrencySymbol;
