import React from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { computeCellValue as sharedComputeCellValue } from '../../utils/computeCellValue';
import ModernMarginGauge from '../charts/components/ModernMarginGauge';
import './MarginAnalysisDetail.css';

/**
 * MarginAnalysisDetail Component
 * ------------------------------
 * Displays the Margin over Material Analysis chart in the Divisional Dashboard overlay.
 * Uses the same data computation as ChartContainer but renders only the ModernMarginGauge.
 */
const MarginAnalysisDetail = () => {
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
      <div className="margin-analysis-detail__empty">
        Please select periods in the Period Configuration and click Generate to view data.
      </div>
    );
  }

  if (basePeriodIndex == null || basePeriodIndex >= columnOrder.length) {
    return (
      <div className="margin-analysis-detail__empty">
        No base period selected. Please select a base period (★) in the Period Configuration.
      </div>
    );
  }

  // Build chart data (same logic as ChartContainer)
  const periods = columnOrder;
  const basePeriod = periods[basePeriodIndex];
  const visiblePeriods = periods.filter(p => isColumnVisibleInChart(p.id));

  const chartData = {};
  const colsToIterate = visiblePeriods.length ? visiblePeriods : periods;

  colsToIterate.forEach(col => {
    let key;
    if (col.isCustomRange) {
      key = `${col.year}-${col.month}-${col.type}`;
    } else {
      key = `${col.year}-${col.month || 'Year'}-${col.type}`;
    }
    
    const sales = computeCellValue(3, col);
    const material = computeCellValue(5, col);
    const salesVol = computeCellValue(7, col);
    const prodVol = computeCellValue(8, col);
    chartData[key] = {
      sales,
      materialCost: material,
      salesVolume: salesVol,
      productionVolume: prodVol,
      marginPerKg: salesVol > 0 ? (sales - material) / salesVol : null
    };
  });

  // Create base period key
  const basePeriodKey = basePeriod 
    ? (basePeriod.isCustomRange 
        ? `${basePeriod.year}-${basePeriod.month}-${basePeriod.type}` 
        : `${basePeriod.year}-${basePeriod.month || 'Year'}-${basePeriod.type}`)
    : '';

  return (
    <div className="margin-analysis-detail">
      <div className="margin-analysis-detail__chart-wrapper">
        <ModernMarginGauge 
          data={chartData} 
          periods={visiblePeriods.length ? visiblePeriods : periods} 
          basePeriod={basePeriodKey}
          hideHeader={true}
          style={{ margin: 0, backgroundColor: 'transparent', boxShadow: 'none', padding: 0 }}
        />
      </div>
      {/* Variance note - displayed below the chart with good spacing */}
      <div className="margin-analysis-detail__variance-note">
        % variance based on sequential period comparison (current vs previous period)
      </div>
    </div>
  );
};

export default MarginAnalysisDetail;













