import React from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { computeCellValue as sharedComputeCellValue } from '../../utils/computeCellValue';
import ManufacturingCostChart from '../charts/components/ManufacturingCostChart.tsx';
import './ManufacturingCostDetail.css';

/**
 * ManufacturingCostDetail Component
 * ---------------------------------
 * Displays the Manufacturing Cost chart in the Divisional Dashboard overlay.
 * Uses the same data computation as ChartContainer but renders only the ManufacturingCostChart.
 */
const ManufacturingCostDetail = () => {
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
      <div className="manufacturing-cost-detail__empty">
        Please select periods in the Period Configuration and click Generate to view data.
      </div>
    );
  }

  if (basePeriodIndex == null || basePeriodIndex >= columnOrder.length) {
    return (
      <div className="manufacturing-cost-detail__empty">
        No base period selected. Please select a base period (★) in the Period Configuration.
      </div>
    );
  }

  // Build chart data (same logic as ChartContainer)
  const periods = columnOrder;
  const basePeriod = periods[basePeriodIndex];
  const visiblePeriods = periods.filter(p => isColumnVisibleInChart(p.id));

  // Create base period key
  const basePeriodKey = basePeriod 
    ? (basePeriod.isCustomRange 
        ? `${basePeriod.year}-${basePeriod.month}-${basePeriod.type}` 
        : `${basePeriod.year}-${basePeriod.month || 'Year'}-${basePeriod.type}`)
    : '';

  return (
    <div className="manufacturing-cost-detail">
      <div className="manufacturing-cost-detail__chart-wrapper">
        <ManufacturingCostChart 
          tableData={divisionData}
          selectedPeriods={visiblePeriods.length ? visiblePeriods : periods} 
          computeCellValue={computeCellValue}
          basePeriod={basePeriodKey}
          hideHeader={true}
        />
      </div>
      {/* Variance note - displayed below the chart with good spacing */}
      <div className="manufacturing-cost-detail__variance-note">
        % variance based on sequential period comparison (current vs previous period)
      </div>
    </div>
  );
};

export default ManufacturingCostDetail;
