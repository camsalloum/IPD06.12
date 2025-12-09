import React from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { computeCellValue as sharedComputeCellValue } from '../../utils/computeCellValue';
import { getColumnColorPalette } from './utils/colorUtils';
import ExpencesChart from '../charts/components/ExpencesChart';
import Profitchart from '../charts/components/Profitchart';
import './CombinedTrendsDetail.css';

/**
 * CombinedTrendsDetail Component
 * ------------------------------
 * Displays the Expenses Trend and Profit Trend charts combined in the Divisional Dashboard overlay.
 * This combines the ExpencesChart and Profitchart components in one view.
 */
const CombinedTrendsDetail = () => {
  const { excelData, selectedDivision } = useExcelData();
  const { 
    columnOrder, 
    basePeriodIndex,
    isColumnVisibleInChart,
    dataGenerated
  } = useFilter();

  // Helper: computeCellValue (delegates to shared util)
  const divisionData = excelData[selectedDivision] || [];
  const computeCellValue = (rowIndex, column) =>
    sharedComputeCellValue(divisionData, rowIndex, column);

  // Check if data is ready
  if (!dataGenerated || !Array.isArray(columnOrder) || columnOrder.length === 0) {
    return (
      <div className="combined-trends-detail__empty">
        Please select periods in the Period Configuration and click Generate to view data.
      </div>
    );
  }

  if (basePeriodIndex == null || basePeriodIndex >= columnOrder.length) {
    return (
      <div className="combined-trends-detail__empty">
        No base period selected. Please select a base period (★) in the Period Configuration.
      </div>
    );
  }

  // Build chart data (same logic as ChartContainer)
  const periods = columnOrder;
  const visiblePeriods = periods.filter(p => isColumnVisibleInChart(p.id));
  const periodsToUse = visiblePeriods.length ? visiblePeriods : periods;

  return (
    <div className="combined-trends-detail">
      {/* Period Legend */}
      <div className="combined-trends-detail__legend">
        {periodsToUse.map((period, idx) => {
          const palette = getColumnColorPalette(period);
          const periodLabel = `${period.year} ${period.isCustomRange ? period.displayName : (period.month || '')} ${period.type}`.trim();
          return (
            <div 
              key={idx}
              className="combined-trends-detail__legend-item"
              style={{ 
                backgroundColor: palette.primary,
                color: palette.text
              }}
            >
              {periodLabel}
            </div>
          );
        })}
      </div>

      {/* Expenses Trend Section */}
      <div className="combined-trends-detail__section">
        <h3 className="combined-trends-detail__section-title">Expenses Trend</h3>
        <div className="combined-trends-detail__chart-wrapper">
          <ExpencesChart 
            tableData={divisionData}
            selectedPeriods={periodsToUse} 
            computeCellValue={computeCellValue}
            hideHeader={true}
            style={{ marginTop: 0 }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="combined-trends-detail__divider"></div>

      {/* Profit Trend Section */}
      <div className="combined-trends-detail__section">
        <h3 className="combined-trends-detail__section-title">Profitability Trend</h3>
        <div className="combined-trends-detail__chart-wrapper">
          <Profitchart 
            tableData={divisionData}
            selectedPeriods={periodsToUse} 
            computeCellValue={computeCellValue}
            hideHeader={true}
            style={{ marginTop: 0 }}
          />
        </div>
      </div>

      {/* Variance note - displayed below all charts with good spacing */}
      <div className="combined-trends-detail__variance-note">
        % variance based on sequential period comparison (current vs previous period)
      </div>
    </div>
  );
};

export default CombinedTrendsDetail;
