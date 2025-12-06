import React, { useMemo, useState, Suspense, useEffect, useCallback } from 'react';
import './DivisionalDashboardLanding.css';
import { useFilter } from '../../contexts/FilterContext';
import UAEDirhamSymbol from './UAEDirhamSymbol';

// Lazy load all detail components
const LazyKPIExecutiveSummary = React.lazy(() => import('./KPIExecutiveSummary'));
const LazySalesVolumeDetail = React.lazy(() => import('./SalesVolumeDetail'));
const LazyMarginAnalysisDetail = React.lazy(() => import('./MarginAnalysisDetail'));
const LazyManufacturingCostDetail = React.lazy(() => import('./ManufacturingCostDetail'));
const LazyBelowGPExpensesDetail = React.lazy(() => import('./BelowGPExpensesDetail'));
const LazyCombinedTrendsDetail = React.lazy(() => import('./CombinedTrendsDetail'));
const LazyPLFinancialDetail = React.lazy(() => import('./PLFinancialDetail'));
const LazyProductGroupDetail = React.lazy(() => import('./ProductGroupDetail'));
const LazySalesRepDetail = React.lazy(() => import('./SalesRepDetail'));
const LazySalesCustomerDetail = React.lazy(() => import('./SalesCustomerDetail'));
const LazySalesCountryDetail = React.lazy(() => import('./SalesCountryDetail'));

const PRIMARY_CARD = {
  id: 'divisional-kpis',
  icon: '📈',
  title: 'Divisional KPIs',
  copy: 'Key performance indicators and metrics overview'
};

const CHART_CARDS = [
  {
    id: 'sales-volume',
    icon: '📊',
    title: 'Sales & Volume Analysis',
    copy: 'Visual analysis of sales revenue and volume trends across different time periods'
  },
  {
    id: 'margin-analysis',
    icon: '📋',
    title: 'Margin Analysis',
    copy: 'Detailed breakdown of profit margins over material costs with trend analysis'
  },
  {
    id: 'manufacturing-cost',
    icon: '🏭',
    title: 'Manufacturing Cost',
    copy: 'Analysis of direct manufacturing costs including materials, labor, and production expenses'
  },
  {
    id: 'below-gp-expenses',
    icon: '📊',
    title: 'Below GP Expenses',
    copy: 'Operating expenses below gross profit including administrative and selling costs'
  },
  {
    id: 'combined-trends',
    icon: '📈',
    title: 'Cost & Profitability Trend',
    copy: 'Historical trends showing cost evolution and profitability patterns over time'
  }
];

const TABLE_CARDS = [
  {
    id: 'pl-financial',
    icon: '💰',
    title: 'Profit and Loss Statement',
    copy: 'Complete Profit & Loss statement with detailed financial performance breakdown'
  },
  {
    id: 'product-group',
    icon: '📊',
    title: 'Product Groups',
    copy: 'Performance analysis by product categories including sales, margins, and growth metrics'
  },
  {
    id: 'sales-rep',
    icon: '🧑‍💼',
    title: 'Sales by Sales Reps',
    copy: 'Sales representative performance analysis and individual contribution breakdown'
  },
  {
    id: 'sales-customer',
    icon: '👥',
    title: 'Sales by Customers',
    copy: 'Top customer analysis showing sales performance and contribution by key accounts'
  },
  {
    id: 'sales-country',
    icon: '🌍',
    title: 'Sales by Countries',
    copy: 'Geographic distribution of sales performance across different countries and regions'
  }
];

const formatPeriodLabel = (period) => {
  if (!period) {
    return 'Select periods to generate view';
  }

  const rangeLabel = period.isCustomRange && period.displayName
    ? period.displayName
    : period.month === 'Year'
      ? 'FY'
      : period.month;

  const parts = [period.year];
  if (rangeLabel) {
    parts.push(rangeLabel);
  }
  if (period.type) {
    parts.push(period.type);
  }

  return parts.join(' ');
};

const CARD_DETAIL_RENDERERS = {
  'divisional-kpis': {
    title: 'Divisional KPIs',
    Component: LazyKPIExecutiveSummary
  },
  'sales-volume': {
    title: 'Sales & Volume Analysis',
    Component: LazySalesVolumeDetail
  },
  'margin-analysis': {
    title: 'Margin Analysis',
    Component: LazyMarginAnalysisDetail
  },
  'manufacturing-cost': {
    title: 'Manufacturing Cost',
    Component: LazyManufacturingCostDetail
  },
  'below-gp-expenses': {
    title: 'Below GP Expenses',
    Component: LazyBelowGPExpensesDetail
  },
  'combined-trends': {
    title: 'Cost & Profitability Trend',
    Component: LazyCombinedTrendsDetail
  },
  'pl-financial': {
    title: 'Profit and Loss Statement',
    Component: LazyPLFinancialDetail
  },
  'product-group': {
    title: 'Product Groups',
    Component: LazyProductGroupDetail
  },
  'sales-rep': {
    title: 'Sales by Sales Reps',
    Component: LazySalesRepDetail
  },
  'sales-customer': {
    title: 'Sales by Customers',
    Component: LazySalesCustomerDetail
  },
  'sales-country': {
    title: 'Sales by Countries',
    Component: LazySalesCountryDetail
  }
};

const ALL_CARDS = [PRIMARY_CARD, ...CHART_CARDS, ...TABLE_CARDS];
const CARD_METADATA = ALL_CARDS.reduce((accumulator, card) => {
  accumulator[card.id] = card;
  return accumulator;
}, {});

const DivisionalDashboardLanding = ({ onCardSelect }) => {
  const { columnOrder, basePeriodIndex } = useFilter();
  const [activeCard, setActiveCard] = useState(null);

  const { periodText, comparisonText } = useMemo(() => {
    if (!columnOrder.length) {
      return {
        periodText: 'Select periods to generate view',
        comparisonText: ''
      };
    }

    const basePeriod =
      (basePeriodIndex !== null && columnOrder[basePeriodIndex])
        ? columnOrder[basePeriodIndex]
        : columnOrder[columnOrder.length - 1];

    const comparisonPeriod =
      basePeriodIndex > 0 && columnOrder[basePeriodIndex - 1]
        ? columnOrder[basePeriodIndex - 1]
        : null;

    return {
      periodText: formatPeriodLabel(basePeriod),
      comparisonText: comparisonPeriod ? formatPeriodLabel(comparisonPeriod) : ''
    };
  }, [columnOrder, basePeriodIndex]);

  const handleCardClick = (cardId) => {
    if (onCardSelect) {
      onCardSelect(cardId);
    }
    if (CARD_DETAIL_RENDERERS[cardId]) {
      setActiveCard(cardId);
    }
  };

  const handleReturnHome = useCallback(() => {
    setActiveCard(null);
    if (onCardSelect) {
      onCardSelect(null);
    }
  }, [onCardSelect]);

  const handleCardKeyDown = (event, cardId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleCardClick(cardId);
    }
  };

  const activeDetail = activeCard ? CARD_DETAIL_RENDERERS[activeCard] : null;
  const DetailComponent = activeDetail ? activeDetail.Component : null;
  const activeCardMeta = activeCard ? CARD_METADATA[activeCard] : null;
  const detailProps = activeCard === 'divisional-kpis' 
    ? { showPeriodHeader: false, showTitle: false } 
    : activeCard === 'sales-volume'
    ? {} // SalesVolumeDetail doesn't need special props, banner handles title/period
    : {};

  useEffect(() => {
    if (!activeDetail) {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
      }
      return undefined;
    }

    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleReturnHome();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    let previousOverflow;
    if (typeof document !== 'undefined') {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = previousOverflow || '';
      }
    };
  }, [activeDetail, handleReturnHome]);

  const renderCard = (card) => (
    <article
      key={card.id}
      className={`divisional-dashboard__card${activeCard === card.id ? ' divisional-dashboard__card--active' : ''}`}
      onClick={() => handleCardClick(card.id)}
      onKeyDown={(event) => handleCardKeyDown(event, card.id)}
      role="button"
      tabIndex={0}
    >
      <span className="divisional-dashboard__icon" aria-hidden="true">{card.icon}</span>
      <div className="divisional-dashboard__card-title">{card.title}</div>
      <p className="divisional-dashboard__card-copy">{card.copy}</p>
    </article>
  );

  return (
    <section className="divisional-dashboard">
      <div className="divisional-dashboard__container">
        <div className="divisional-dashboard__cards-grid divisional-dashboard__cards-grid--single">
          {renderCard(PRIMARY_CARD)}
        </div>

        <div className="divisional-dashboard__cards-grid">
          {CHART_CARDS.map(renderCard)}
        </div>

        <div className="divisional-dashboard__cards-grid">
          {TABLE_CARDS.map(renderCard)}
        </div>
      </div>

      {activeDetail ? (
        <>
          <div
            className="divisional-dashboard__overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="divisional-dashboard-overlay-title"
          >
            <button
              type="button"
              className="divisional-dashboard__overlay-close"
              onClick={handleReturnHome}
            >
              ← Back
            </button>
            <div className="divisional-dashboard__overlay-scroll">
              <div className="divisional-dashboard__overlay-banner">
                <div className="divisional-dashboard__overlay-heading">
                  <h2 id="divisional-dashboard-overlay-title" className="divisional-dashboard__overlay-title">
                    {activeCardMeta?.icon ? (
                      <span className="divisional-dashboard__overlay-icon" aria-hidden="true">{activeCardMeta.icon}</span>
                    ) : null}
                    {activeDetail.title}
                  </h2>
                  {activeCardMeta?.copy ? (
                    <p className="divisional-dashboard__overlay-description">{activeCardMeta.copy}</p>
                  ) : null}
                </div>
                <div className="divisional-dashboard__overlay-period-wrapper">
                  <div className="divisional-dashboard__overlay-period-group">
                    <div className="divisional-dashboard__overlay-period">{periodText}</div>
                    {comparisonText ? (
                      <>
                        <div className="divisional-dashboard__overlay-period-divider">Vs</div>
                        <div className="divisional-dashboard__overlay-period divisional-dashboard__overlay-period--secondary">{comparisonText}</div>
                      </>
                    ) : null}
                  </div>
                  {/* Show currency symbol only for table cards */}
                  {['pl-financial', 'product-group', 'sales-rep', 'sales-customer', 'sales-country'].includes(activeCard) && (
                    <div className="divisional-dashboard__overlay-currency">
                      <UAEDirhamSymbol style={{ width: 32, height: 32, color: '#ffffff' }} />
                    </div>
                  )}
                </div>
              </div>
            <div className="divisional-dashboard__overlay-body">
              <Suspense fallback={<div className="divisional-dashboard__loading">Loading {activeDetail.title}...</div>}>
                {DetailComponent ? <DetailComponent {...detailProps} /> : null}
              </Suspense>
            </div>
          </div>
        </div>
        </>
      ) : null}
    </section>
  );
};

export default DivisionalDashboardLanding;
