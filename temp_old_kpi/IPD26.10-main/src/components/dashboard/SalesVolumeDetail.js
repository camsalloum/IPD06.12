import React from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { computeCellValue as sharedComputeCellValue } from '../../utils/computeCellValue';
import { getColumnColorPalette } from './utils/colorUtils';
import BarChart from '../charts/components/BarChart';
import './SalesVolumeDetail.css';

/**
 * SalesVolumeDetail Component
 * ---------------------------
 * Displays the Sales & Volume Analysis chart in the Divisional Dashboard overlay.
 * Uses the same data computation as ChartContainer but renders only the BarChart.
 */
const SalesVolumeDetail = () => {
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
      <div className="sales-volume-detail__empty">
        Please select periods in the Period Configuration and click Generate to view data.
      </div>
    );
  }

  if (basePeriodIndex == null || basePeriodIndex >= columnOrder.length) {
    return (
      <div className="sales-volume-detail__empty">
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

  // Get period colors for legend
  const periodsToShow = visiblePeriods.length ? visiblePeriods : periods;

  return (
    <div className="sales-volume-detail">
      {/* Period Legend */}
      <div className="sales-volume-detail__legend">
        {periodsToShow.map((period, idx) => {
          const palette = getColumnColorPalette(period);
          const periodLabel = `${period.year} ${period.isCustomRange ? period.displayName : (period.month || '')} ${period.type}`.trim();
          return (
            <div 
              key={idx}
              className="sales-volume-detail__legend-item"
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

      <div className="sales-volume-detail__chart-wrapper">
        <BarChart 
          data={chartData} 
          periods={periodsToShow} 
          basePeriod={basePeriodKey}
          hideHeader={true}
          hideSalesPerKg={false}
        />
      </div>
      {/* Variance note - displayed below the chart with good spacing */}
      <div className="sales-volume-detail__variance-note">
        % variance based on sequential period comparison (current vs previous period)
      </div>
    </div>
  );
};

export default SalesVolumeDetail;

