import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { useSalesData } from '../../contexts/SalesDataContext';
import { useFilter } from '../../contexts/FilterContext';
import Header from '../common/Header';
import ActivePeriodsDisplay from './ActivePeriodsDisplay';
import WriteUpViewV2 from '../writeup/WriteUpViewV2';
import SalesBySaleRepTable from './SalesBySaleRepTable';
import DivisionalDashboardLanding from './DivisionalDashboardLanding';
import './Dashboard.css';

// Home dashboard cards configuration
const HOME_CARDS = [
  {
    id: 'divisional',
    icon: '📊',
    title: 'Divisional Dashboard',
    description: 'Key performance indicators, charts, and detailed analysis by division'
  },
  {
    id: 'sales',
    icon: '👥',
    title: 'Sales Dashboard',
    description: 'Sales representative performance analysis and tracking'
  },
  {
    id: 'writeup',
    icon: '✍️',
    title: 'Write-Up',
    description: 'AI-powered analysis and report generation'
  }
];

const Dashboard = () => {
  const { loading, error, selectedDivision } = useExcelData();
  const { loadSalesData, loading: salesLoading, error: salesError } = useSalesData();
  const { dataGenerated } = useFilter();
  const productGroupTableRef = useRef(null);
  const [activeView, setActiveView] = useState(null);
  const [divisionalCardActive, setDivisionalCardActive] = useState(false);
  
  // Handle divisional dashboard card selection
  const handleDivisionalCardSelect = useCallback((cardId) => {
    setDivisionalCardActive(cardId !== null);
  }, []);
  
  // Handle home card click
  const handleCardClick = (cardId) => {
    setActiveView(cardId);
  };
  
  // Handle back to home
  const handleBackToHome = () => {
    setActiveView(null);
    setDivisionalCardActive(false);
  };
  
  // Use useCallback to memoize the function to prevent it from changing on every render
  const loadData = useCallback(() => {
    // Excel data is now auto-loaded by ExcelDataContext when division changes
    // Just load Sales data here
    loadSalesData('/api/sales.xlsx')
      .catch(err => {
        console.error('Error loading sales data:', err);
      });
  }, [loadSalesData]);
  
  // Only run this effect once when the component mounts
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  if (loading || salesLoading) {
    return <div className="loading">Loading Excel data...</div>;
  }
  
  if (error || salesError) {
    return <div className="error">Error: {error || salesError}</div>;
  }
  
  // Render the active view content
  const renderActiveView = () => {
    switch (activeView) {
      case 'divisional':
        return dataGenerated ? (
          <DivisionalDashboardLanding onCardSelect={handleDivisionalCardSelect} />
        ) : (
          <div className="empty-charts-container">
            <p>Please select columns and click the Generate button to view the divisional dashboard.</p>
          </div>
        );
      case 'sales':
        return <SalesBySaleRepTable />;
      case 'writeup':
        return dataGenerated ? (
          <WriteUpViewV2 />
        ) : (
          <div className="empty-writeup-container">
            <p>Please select columns and click the Generate button to access the AI writeup assistant.</p>
          </div>
        );
      default:
        return null;
    }
  };
  
  // Get current view title
  const getActiveViewTitle = () => {
    const card = HOME_CARDS.find(c => c.id === activeView);
    return card ? card.title : '';
  };
  
  return (
    <div className="dashboard-container">
      <Header />
      
      <div className="dashboard-main-content">
        {selectedDivision && (
          <div className="dashboard-content">
          
          {/* Active Periods Display (Configuration moved to Settings) */}
          <ActivePeriodsDisplay productGroupTableRef={productGroupTableRef} />
          
          {activeView ? (
            // Active view with floating back button
            <div className="dashboard-active-view">
              {/* Floating Back Button */}
              <button 
                className="dashboard-floating-back-btn"
                onClick={handleBackToHome}
              >
                ← Back to Home Dashboard
              </button>
              
              {/* View Content */}
              <div className="dashboard-view-content">
                {renderActiveView()}
              </div>
            </div>
          ) : (
            // Home view with cards
            <div className="dashboard-home">
              <h2 className="dashboard-home-title">Welcome to Your Dashboard</h2>
              <p className="dashboard-home-subtitle">Select a dashboard to get started</p>
              
              <div className="dashboard-home-cards">
                {HOME_CARDS.map((card) => (
                  <div
                    key={card.id}
                    className="dashboard-home-card"
                    onClick={() => handleCardClick(card.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(card.id);
                      }
                    }}
                  >
                    <span className="dashboard-home-card-icon">{card.icon}</span>
                    <h3 className="dashboard-home-card-title">{card.title}</h3>
                    <p className="dashboard-home-card-description">{card.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          
        </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;