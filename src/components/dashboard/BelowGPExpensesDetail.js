import React from 'react';
import { useFilter } from '../../contexts/FilterContext';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { computeCellValue as sharedComputeCellValue } from '../../utils/computeCellValue';
import BelowGPExpensesChart from '../charts/components/BelowGPExpensesChart.tsx';
import './BelowGPExpensesDetail.css';

/**
 * BelowGPExpensesDetail Component
 * -------------------------------
 * Displays the Below GP Expenses chart in the Divisional Dashboard overlay.
 * Uses the same data computation as ChartContainer but renders only the BelowGPExpensesChart.
 */
const BelowGPExpensesDetail = () => {
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
      <div className="below-gp-expenses-detail__empty">
        Please select periods in the Period Configuration and click Generate to view data.
      </div>
    );
  }

  if (basePeriodIndex == null || basePeriodIndex >= columnOrder.length) {
    return (
      <div className="below-gp-expenses-detail__empty">
        No base period selected. Please select a base period (★) in the Period Configuration.
      </div>
    );
  }

  // Build chart data (same logic as ChartContainer)
  const periods = columnOrder;
  const visiblePeriods = periods.filter(p => isColumnVisibleInChart(p.id));

  return (
    <div className="below-gp-expenses-detail">
      <div className="below-gp-expenses-detail__chart-wrapper">
        <BelowGPExpensesChart 
          tableData={divisionData}
          selectedPeriods={visiblePeriods.length ? visiblePeriods : periods} 
          computeCellValue={computeCellValue}
          hideHeader={true}
        />
      </div>
      {/* Variance note - displayed below the chart with good spacing */}
      <div className="below-gp-expenses-detail__variance-note">
        % variance based on sequential period comparison (current vs previous period)
      </div>
    </div>
  );
};

export default BelowGPExpensesDetail;
