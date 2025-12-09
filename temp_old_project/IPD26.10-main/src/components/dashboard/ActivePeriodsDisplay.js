import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilter } from '../../contexts/FilterContext';
import MultiChartHTMLExport from './MultiChartHTMLExport';
import DivisionalExportButton from './DivisionalDashboardExport';
import './ColumnConfigGrid.css'; // Reuse styles

const ActivePeriodsDisplay = ({ productGroupTableRef }) => {
  const { 
    columnOrder, 
    generateData, 
    dataGenerated
  } = useFilter();
  
  const navigate = useNavigate();

  // Auto-generate report when columns are available and not yet generated
  useEffect(() => {
    if (columnOrder.length > 0 && !dataGenerated) {
      generateData();
    }
  }, [columnOrder, dataGenerated, generateData]);

  return (
    <>
      {/* Top Bar with Configure Button (Left) and Export Buttons (Right) */}
      <div className="dashboard-actions-bar" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        padding: '0 20px',
        marginBottom: '10px',
        marginTop: '-10px'
      }}>
        {/* Configure Button - Top Left */}
        <button 
          onClick={() => navigate('/settings', { state: { activeTab: 'periods' } })} 
          className="export-btn html-export"
          title="Configure Periods"
        >
          Configure Periods
        </button>
        
        {/* Export Buttons - Top Right */}
        {dataGenerated && (
          <div style={{ 
            display: 'flex', 
            gap: '10px'
          }}>
            <DivisionalExportButton />
            <MultiChartHTMLExport />
          </div>
        )}
      </div>
    </>
  );
};

export default ActivePeriodsDisplay;
