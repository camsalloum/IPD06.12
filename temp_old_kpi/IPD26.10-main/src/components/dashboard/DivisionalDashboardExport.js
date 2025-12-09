import React, { useCallback, useState } from 'react';
import { useExcelData } from '../../contexts/ExcelDataContext';
import { useFilter } from '../../contexts/FilterContext';
import { computeCellValue as sharedComputeCellValue } from '../../utils/computeCellValue';
import { getColumnColorPalette } from './utils/colorUtils';
import './DivisionalDashboardExport.css';

/**
 * DivisionalDashboardExport
 * Exports an HTML file that is an EXACT visual replica of the Divisional Dashboard
 */
const DivisionalDashboardExport = () => {
  const [isVisible, setIsVisible] = useState(false);
  const onClose = () => setIsVisible(false);
  const onOpen = () => setIsVisible(true);
  
  const { excelData, selectedDivision } = useExcelData();
  const { 
    columnOrder, 
    basePeriodIndex,
    isColumnVisibleInChart,
    dataGenerated 
  } = useFilter();
  
  const [isExporting, setIsExporting] = useState(false);

  const divisionNames = {
    'FP': 'Flexible Packaging',
    'SB': 'Shopping Bags',
    'TF': 'Thermoforming Products',
    'HCM': 'Harwal Container Manufacturing'
  };

  const createPeriodKey = (period) => {
    if (period.isCustomRange) return `${period.year}-${period.month}-${period.type}`;
    return `${period.year}-${period.month || 'Year'}-${period.type}`;
  };

  const createChartLabel = (period) => {
    if (period.isCustomRange) return `${period.year}-${period.displayName}-${period.type}`;
    else if (period.month) return `${period.year}-${period.month}-${period.type}`;
    return `${period.year}-${period.type}`;
  };

  const formatPeriodLabel = (period) => {
    if (!period) return '';
    const rangeLabel = period.isCustomRange && period.displayName
      ? period.displayName
      : period.month === 'Year' ? 'FY' : period.month;
    const parts = [period.year];
    if (rangeLabel) parts.push(rangeLabel);
    if (period.type) parts.push(period.type);
    return parts.join(' ');
  };

  const gatherExportData = useCallback(async () => {
    if (!dataGenerated || !Array.isArray(columnOrder) || columnOrder.length === 0) return null;
    if (basePeriodIndex == null || basePeriodIndex >= columnOrder.length) return null;

    const divisionData = excelData[selectedDivision] || [];
    const computeCellValue = (rowIndex, column) => sharedComputeCellValue(divisionData, rowIndex, column);

    const periods = columnOrder;
    const basePeriod = periods[basePeriodIndex];
    const comparisonPeriod = basePeriodIndex > 0 ? periods[basePeriodIndex - 1] : null;
    const visiblePeriods = periods.filter(p => isColumnVisibleInChart(p.id));
    const periodsToUse = visiblePeriods.length ? visiblePeriods : periods;

    const periodText = formatPeriodLabel(basePeriod);
    const comparisonText = comparisonPeriod ? formatPeriodLabel(comparisonPeriod) : '';

    // KPI Data - Row indices from KPIExecutiveSummary.js: sales=3, grossProfit=19, netProfit=54, ebitda=56
    const kpiData = {
      sales: computeCellValue(3, basePeriod) || 0,
      salesPrev: comparisonPeriod ? computeCellValue(3, comparisonPeriod) : null,
      grossProfit: computeCellValue(19, basePeriod) || 0,
      grossProfitPrev: comparisonPeriod ? computeCellValue(19, comparisonPeriod) : null,
      netProfit: computeCellValue(54, basePeriod) || 0,
      netProfitPrev: comparisonPeriod ? computeCellValue(54, comparisonPeriod) : null,
      ebitda: computeCellValue(56, basePeriod) || 0,
      ebitdaPrev: comparisonPeriod ? computeCellValue(56, comparisonPeriod) : null
    };

    // Fetch Product Performance data from API
    let productPerformanceData = null;
    try {
      const response = await fetch('/api/fp/product-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPeriod: {
            year: basePeriod?.year,
            months: basePeriod?.months,
            type: basePeriod?.type
          },
          comparisonPeriod: comparisonPeriod ? {
            year: comparisonPeriod.year,
            months: comparisonPeriod.months,
            type: comparisonPeriod.type
          } : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          productPerformanceData = result.data;
          console.log('✅ Product performance data loaded for export');
        }
      }
    } catch (error) {
      console.error('❌ Error fetching product performance for export:', error);
    }

    // Chart Data
    const chartData = {};
    periodsToUse.forEach(col => {
      const key = createPeriodKey(col);
      chartData[key] = { 
        sales: computeCellValue(3, col), 
        salesVolume: computeCellValue(7, col) 
      };
    });

    const periodLabels = periodsToUse.map(p => createChartLabel(p));
    const seriesData = periodsToUse.map(p => chartData[createPeriodKey(p)]?.sales || 0);
    const salesVolumeData = periodsToUse.map(p => chartData[createPeriodKey(p)]?.salesVolume || 0);
    const salesPerKgData = periodsToUse.map((p, idx) => {
      const vol = salesVolumeData[idx];
      return vol > 0 ? seriesData[idx] / vol : 0;
    });

    const barColors = periodsToUse.map(period => getColumnColorPalette(period).primary);
    const percentVarianceData = seriesData.map((value, idx) => {
      if (idx === 0) return null;
      const prev = seriesData[idx - 1];
      return prev === 0 ? null : ((value - prev) / Math.abs(prev)) * 100;
    });

    const legendItems = periodsToUse.map((period) => {
      const palette = getColumnColorPalette(period);
      const label = period.isCustomRange
        ? `${period.year} ${period.displayName} ${period.type}`
        : `${period.year} ${period.month || ''} ${period.type}`.trim();
      return { label, color: palette.primary, textColor: palette.text };
    });

    return {
      divisionName: divisionNames[selectedDivision] || selectedDivision,
      divisionCode: selectedDivision,
      periodText,
      comparisonText,
      kpiData,
      productPerformanceData,
      chartData: { periodLabels, seriesData, salesVolumeData, salesPerKgData, barColors, percentVarianceData, legendItems }
    };
  }, [dataGenerated, columnOrder, basePeriodIndex, excelData, selectedDivision, isColumnVisibleInChart]);

  const generateHTML = useCallback(async () => {
    const data = await gatherExportData();
    if (!data) return null;

    const { divisionName, periodText, comparisonText, kpiData, productPerformanceData, chartData } = data;
    const { periodLabels, seriesData, salesVolumeData, salesPerKgData, barColors, percentVarianceData, legendItems } = chartData;

    // UAE Symbol SVG
    const uaeSvg = '<svg viewBox="0 0 344.84 299.91" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>';

    // Format functions - EXACT from formatters.js
    const formatM = (num) => {
      if (!num || isNaN(num)) return `<svg class="uae-dirham-symbol" viewBox="0 0 344.84 299.91" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>0.00M`;
      let formatted;
      if (num >= 1000000) formatted = (num / 1000000).toFixed(2) + 'M';
      else if (num >= 1000) formatted = (num / 1000).toFixed(2) + 'K';
      else formatted = num.toFixed(2);
      return `<svg class="uae-dirham-symbol" viewBox="0 0 344.84 299.91" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>${formatted}`;
    };

    const growth = (current, previous) => {
      if (!previous || previous === 0) return '<span style="color:#6b7280">N/A</span>';
      const percent = ((current - previous) / previous * 100);
      const arrow = percent > 0 ? '▲' : '▼';
      const color = percent > 0 ? '#007bff' : '#dc3545';
      return `<span style="color:${color}">${arrow} ${Math.abs(percent).toFixed(1)}%</span>`;
    };

    const formatKgs = (kgs) => {
      const mt = kgs / 1000;
      if (mt >= 1000000) return (mt / 1000000).toFixed(1) + 'M MT';
      if (mt >= 1000) return (mt / 1000).toFixed(1) + 'K MT';
      if (mt >= 1) return mt.toFixed(0) + ' MT';
      return kgs.toLocaleString() + ' kg';
    };

    const formatAEDPerKg = (value) => {
      return `<svg class="uae-dirham-symbol" viewBox="0 0 344.84 299.91" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>${value.toFixed(2)}/Kg`;
    };

    // Calculate Product Performance data from API
    let topProductsHTML = '';
    let totalKgs = 0, totalKgsPrev = 0;
    let totalSales = 0, totalSalesPrev = 0;
    let totalMoRM = 0, totalMoRMPrev = 0;
    let processCategoriesHTML = '';
    let materialCategoriesHTML = '';
    
    if (productPerformanceData) {
      const products = productPerformanceData.products || [];
      
      // Calculate totals
      products.forEach(p => {
        totalKgs += p.kgs || 0;
        totalKgsPrev += p.kgs_prev || 0;
        totalSales += p.sales || 0;
        totalSalesPrev += p.sales_prev || 0;
        totalMoRM += p.morm || 0;
        totalMoRMPrev += p.morm_prev || 0;
      });

      // Calculate top 3 products by sales with growth
      const productSales = products.map(p => ({
        name: p.name,
        sales: p.sales || 0,
        salesPrev: p.sales_prev || 0
      })).sort((a, b) => b.sales - a.sales);

      const top3 = productSales.slice(0, 3);
      
      topProductsHTML = top3.map((p, idx) => {
        const salesPercent = totalSales > 0 ? (p.sales / totalSales * 100).toFixed(1) : '0.0';
        const growthPercent = p.salesPrev > 0 ? ((p.sales - p.salesPrev) / p.salesPrev * 100) : 0;
        const isPositive = growthPercent > 0;
        const arrow = isPositive ? '▲' : '▼';
        const growthWord = isPositive ? 'growth' : 'decline';
        const arrowClass = isPositive ? 'arrow-positive' : 'arrow-negative';
        const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉';
        const borderStyle = idx < 2 ? 'border-bottom: 1px solid rgba(102, 126, 234, 0.1);' : '';
        
        return `
                  <div style="margin-bottom: 12px; display: flex; align-items: center; padding: 8px 0; ${borderStyle}">
                    <span style="font-size: 1.8em; margin-right: 12px; min-width: 32px; text-align: center;">${rankIcon}</span>
                    <div style="flex: 1;">
                      <div style="font-weight: 600; margin-bottom: 4px; font-size: 1.05em;">${p.name}</div>
                      <div style="display: flex; align-items: center; gap: 8px; font-size: 0.9em;">
                        <span>${salesPercent}% of sales</span>
                        <span class="${arrowClass}">${arrow} ${Math.abs(growthPercent).toFixed(1)}% ${growthWord}</span>
                      </div>
                    </div>
                  </div>`;
      }).join('');

      // Process Categories
      const processCategories = productPerformanceData.processCategories || {};
      const processCategoriesArray = Object.entries(processCategories)
        .filter(([name]) => name.toUpperCase() !== 'OTHERS');
      
      processCategoriesHTML = processCategoriesArray.map(([categoryName, data]) => {
        const totalCategorySales = Object.values(processCategories).reduce((sum, cat) => sum + (cat.sales || 0), 0);
        const salesPercentage = totalCategorySales > 0 ? (data.sales / totalCategorySales * 100).toFixed(0) : '0';
        const sellingPrice = data.kgs > 0 ? data.sales / data.kgs : 0;
        const morm = data.kgs > 0 ? data.morm / data.kgs : 0;

        // Calculate growth from previous period data
        const prevSales = data.sales_prev || 0;
        const prevKgs = data.kgs_prev || 0;
        const prevMorm = data.morm_prev || 0;
        
        const salesGrowth = prevSales > 0 ? ((data.sales - prevSales) / prevSales * 100) : 0;
        const prevSellingPrice = prevKgs > 0 ? prevSales / prevKgs : 0;
        const priceGrowth = prevSellingPrice > 0 ? ((sellingPrice - prevSellingPrice) / prevSellingPrice * 100) : 0;
        const prevMormPerKg = prevKgs > 0 ? prevMorm / prevKgs : 0;
        const mormGrowth = prevMormPerKg > 0 ? ((morm - prevMormPerKg) / prevMormPerKg * 100) : 0;

        const salesArrow = salesGrowth > 0 ? '▲' : '▼';
        const priceArrow = priceGrowth > 0 ? '▲' : '▼';
        const mormArrow = mormGrowth > 0 ? '▲' : '▼';
        const salesArrowClass = salesGrowth > 0 ? 'arrow-positive' : 'arrow-negative';
        const priceArrowClass = priceGrowth > 0 ? 'arrow-positive' : 'arrow-negative';
        const mormArrowClass = mormGrowth > 0 ? 'arrow-positive' : 'arrow-negative';

        return `
              <div class="kpi-card">
                <div class="kpi-label category-highlight">${categoryName.toUpperCase()}</div>
                <div class="kpi-value">
                  <div>
                    % of Sales: ${salesPercentage}% <span class="${salesArrowClass} growth-indicator">${salesArrow} ${Math.abs(salesGrowth).toFixed(1)}%</span>
                    <div class="kpi-trend">${salesGrowth > 0 ? 'Growth' : 'Decline'}</div>
                  </div>
                  <div>
                    AVG Selling Price: ${formatAEDPerKg(sellingPrice)} <span class="${priceArrowClass} growth-indicator">${priceArrow} ${Math.abs(priceGrowth).toFixed(1)}%</span>
                    <div class="kpi-trend">${priceGrowth > 0 ? 'Growth' : 'Decline'}</div>
                  </div>
                  <div>
                    AVG MoRM: ${formatAEDPerKg(morm)} <span class="${mormArrowClass} growth-indicator">${mormArrow} ${Math.abs(mormGrowth).toFixed(1)}%</span>
                    <div class="kpi-trend">${mormGrowth > 0 ? 'Growth' : 'Decline'}</div>
                  </div>
                </div>
              </div>`;
      }).join('');

      // Material Categories
      const materialCategories = productPerformanceData.materialCategories || {};
      const materialCategoriesArray = Object.entries(materialCategories)
        .filter(([name]) => name.toUpperCase() !== 'OTHERS');
      
      materialCategoriesHTML = materialCategoriesArray.map(([categoryName, data]) => {
        const totalCategorySales = Object.values(materialCategories).reduce((sum, cat) => sum + (cat.sales || 0), 0);
        const salesPercentage = totalCategorySales > 0 ? (data.sales / totalCategorySales * 100).toFixed(0) : '0';
        const sellingPrice = data.kgs > 0 ? data.sales / data.kgs : 0;
        const morm = data.kgs > 0 ? data.morm / data.kgs : 0;

        // Calculate growth from previous period data
        const prevSales = data.sales_prev || 0;
        const prevKgs = data.kgs_prev || 0;
        const prevMorm = data.morm_prev || 0;
        
        const salesGrowth = prevSales > 0 ? ((data.sales - prevSales) / prevSales * 100) : 0;
        const prevSellingPrice = prevKgs > 0 ? prevSales / prevKgs : 0;
        const priceGrowth = prevSellingPrice > 0 ? ((sellingPrice - prevSellingPrice) / prevSellingPrice * 100) : 0;
        const prevMormPerKg = prevKgs > 0 ? prevMorm / prevKgs : 0;
        const mormGrowth = prevMormPerKg > 0 ? ((morm - prevMormPerKg) / prevMormPerKg * 100) : 0;

        const salesArrow = salesGrowth > 0 ? '▲' : '▼';
        const priceArrow = priceGrowth > 0 ? '▲' : '▼';
        const mormArrow = mormGrowth > 0 ? '▲' : '▼';
        const salesArrowClass = salesGrowth > 0 ? 'arrow-positive' : 'arrow-negative';
        const priceArrowClass = priceGrowth > 0 ? 'arrow-positive' : 'arrow-negative';
        const mormArrowClass = mormGrowth > 0 ? 'arrow-positive' : 'arrow-negative';

        return `
              <div class="kpi-card">
                <div class="kpi-label category-highlight">${categoryName.toUpperCase()}</div>
                <div class="kpi-value">
                  <div>
                    % of Sales: ${salesPercentage}% <span class="${salesArrowClass} growth-indicator">${salesArrow} ${Math.abs(salesGrowth).toFixed(1)}%</span>
                    <div class="kpi-trend">${salesGrowth > 0 ? 'Growth' : 'Decline'}</div>
                  </div>
                  <div>
                    AVG Selling Price: ${formatAEDPerKg(sellingPrice)} <span class="${priceArrowClass} growth-indicator">${priceArrow} ${Math.abs(priceGrowth).toFixed(1)}%</span>
                    <div class="kpi-trend">${priceGrowth > 0 ? 'Growth' : 'Decline'}</div>
                  </div>
                  <div>
                    AVG MoRM: ${formatAEDPerKg(morm)} <span class="${mormArrowClass} growth-indicator">${mormArrow} ${Math.abs(mormGrowth).toFixed(1)}%</span>
                    <div class="kpi-trend">${mormGrowth > 0 ? 'Growth' : 'Decline'}</div>
                  </div>
                </div>
              </div>`;
      }).join('');
    }

    const avgSellingPrice = totalKgs > 0 ? totalSales / totalKgs : 0;
    const avgSellingPricePrev = totalKgsPrev > 0 ? totalSalesPrev / totalKgsPrev : 0;
    const avgMoRM = totalKgs > 0 ? totalMoRM / totalKgs : 0;
    const avgMoRMPrev = totalKgsPrev > 0 ? totalMoRMPrev / totalKgsPrev : 0;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${divisionName} - Divisional Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #e3f2fd; min-height: 100vh; }
    
    /* Card Grid - EXACT from DivisionalDashboardLanding.css */
    .dashboard-container { max-width: 1400px; margin: 0 auto; padding: 40px 20px 80px; }
    .cards-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 24px; }
    .cards-grid + .cards-grid { margin-top: 30px; }
    .cards-grid--single { grid-template-columns: minmax(280px, 400px); justify-content: center; margin-bottom: 32px; }
    .card {
      background: rgba(255,255,255,0.95); border-radius: 18px; padding: 30px 24px; text-align: center;
      box-shadow: 0 8px 20px rgba(15,40,87,0.1); border: 2px solid transparent; cursor: pointer;
      transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
      display: flex; flex-direction: column; align-items: center; min-height: 210px;
    }
    .card:hover { transform: translateY(-6px); box-shadow: 0 15px 40px rgba(15,40,87,0.2); border-color: #3498db; }
    .card-icon { font-size: 2.5rem; margin-bottom: 18px; }
    .card-title { font-size: 1.25rem; font-weight: 700; color: #2f3640; margin-bottom: 10px; }
    .card-copy { font-size: 0.95rem; color: #7f8c8d; line-height: 1.45; }
    
    /* Overlay */
    .overlay { display: none; position: fixed; inset: 0; background: linear-gradient(135deg, #0f2744 0%, #1a365d 50%, #234e70 100%); z-index: 1000; overflow-y: auto; }
    .overlay.active { display: block; }
    .overlay-close { position: fixed; top: 20px; left: 20px; z-index: 1001; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
    .overlay-close:hover { background: rgba(255,255,255,0.25); }
    .overlay-scroll { min-height: 100%; padding-top: 80px; }
    .overlay-banner { background: linear-gradient(135deg, #0d1f3d 0%, #1a3a6e 35%, #2d5a9e 70%, #4a7fc7 100%); padding: 32px 40px; display: flex; align-items: center; position: relative; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .overlay-banner-content { display: flex; align-items: center; gap: 16px; }
    .overlay-icon-container { width: 60px; height: 60px; background: rgba(255,255,255,0.15); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 3rem; flex-shrink: 0; }
    .overlay-title-group { display: flex; flex-direction: column; }
    .overlay-title { font-size: 2.2rem; font-weight: 700; color: #fff; line-height: 1.2; }
    .overlay-description { font-size: 0.9rem; color: rgba(255,255,255,0.7); margin-top: 4px; }
    .overlay-period-wrapper { position: absolute; left: 60%; top: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; gap: 12px; }
    .overlay-period { background: rgba(255,255,255,0.12); padding: 8px 18px; border-radius: 999px; font-weight: 600; color: #fff; font-size: 0.95rem; border: 1px solid rgba(255,255,255,0.32); backdrop-filter: blur(4px); }
    .overlay-period--secondary { background: rgba(255,255,255,0.08); }
    .overlay-period-divider { color: rgba(255,255,255,0.6); font-weight: 500; text-transform: lowercase; font-size: 0.8rem; }
    .overlay-close-fixed { position: fixed !important; top: 20px; right: 20px; z-index: 9999; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
    .overlay-close-fixed:hover { background: rgba(255,255,255,0.25); }
    .overlay-body { padding: 32px 40px; }
    
    /* KPI Dashboard - COMPLETE CSS from KPIExecutiveSummary.css */
    .kpi-dashboard { background: white; min-height: 100vh; padding: 24px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; width: 100%; max-width: 100%; box-sizing: border-box; overflow-x: hidden; }
    .kpi-dashboard > h2 { text-align: center; font-weight: 700; font-size: 1.5rem; margin-bottom: 8px; }
    .kpi-period-header { display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 16px; }
    .kpi-period-header > span { font-weight: 700; font-size: 18px; color: #1f2937; }
    .kpi-period-vs { font-weight: 700; font-size: 18px; color: #1f2937; }
    .kpi-section { background: #ffffff; border-radius: 16px; padding: clamp(16px, 2vw, 28px); margin-bottom: 32px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); border: 1px solid rgba(0, 0, 0, 0.06); position: relative; overflow: hidden; width: 100%; max-width: 100%; box-sizing: border-box; }
    .kpi-section-title { font-size: 1.4em; font-weight: 700; color: #1e293b; margin-bottom: 28px; text-align: center; border-bottom: 3px solid #667eea; padding-bottom: 16px; text-transform: uppercase; letter-spacing: 1px; position: relative; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .kpi-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; align-items: stretch; margin: 8px 0 0; width: 100%; overflow: hidden; }
    .kpi-cards .revenue-drivers { grid-column: 1 / -1; width: 100%; min-width: 100%; max-width: 100%; }
    .kpi-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid rgba(0, 0, 0, 0.08); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; min-height: 180px; display: flex; flex-direction: column; justify-content: space-between; backdrop-filter: blur(10px); }
    .kpi-card:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15); border-color: rgba(102, 126, 234, 0.3); }
    .kpi-card.large { grid-column: span 2; min-height: 170px; }
    .kpi-card::before { content: ''; position: absolute; top: 0; left: 0; height: 100%; width: 4px; background: linear-gradient(to bottom, #667eea, #764ba2); border-radius: 0 2px 2px 0; }
    .kpi-icon { display: flex; justify-content: center; align-items: center; font-size: 2.5rem; margin-bottom: 16px; }
    .kpi-label { text-align: center; font-size: 1.3rem; font-weight: 700; color: #444b54; letter-spacing: 0.04em; margin-top: 0; }
    .kpi-value { font-size: 1.4em; font-weight: 700; color: #1f2937; text-align: center; margin-bottom: 12px; line-height: 1.3; font-family: 'Segoe UI', sans-serif; }
    .kpi-trend { font-size: 0.88em; text-align: center; color: #6b7280; font-weight: 500; line-height: 1.4; padding: 4px 8px; background: rgba(102, 126, 234, 0.05); border-radius: 6px; border: 1px solid rgba(102, 126, 234, 0.1); }
    .kpi-card .kpi-value ol { text-align: center; margin: 0; padding-left: 0; line-height: 1.3; list-style: none; display: flex; flex-direction: column; align-items: center; width: 100%; font-weight: inherit; }
    .kpi-card .kpi-value ol li { margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; font-weight: inherit; padding: 8px 14px; background: rgba(102, 126, 234, 0.06); border-radius: 8px; border-left: 3px solid #667eea; width: 100%; text-align: left; color: inherit; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05); }
    .kpi-card .kpi-value ol li:hover { background: rgba(102, 126, 234, 0.1); transform: translateX(4px); }
    .arrow-positive { color: #007bff; font-weight: 700; }
    .arrow-negative { color: #dc3545; font-weight: 700; }
    .kpi-value > div { margin-bottom: 8px; }
    .growth-indicator { margin-left: 8px; }
    .category-highlight { font-size: 1.1em; margin-bottom: 12px; font-weight: 700; color: #1e40af; text-decoration: underline; text-decoration-color: #3b82f6; text-decoration-thickness: 2px; text-underline-offset: 3px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); letter-spacing: 0.8px; }
    .category-cards { display: grid; gap: 16px; margin-top: 20px; }
    .category-card { background: white; border-radius: 10px; padding: 16px; border-left: 4px solid #3b82f6; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06); min-height: 160px; display: flex; flex-direction: column; justify-content: space-between; }
    .category-title { font-weight: 700; color: #2d3748; margin-bottom: 10px; font-size: 1.1em; text-transform: uppercase; letter-spacing: 0.8px; }
    .category-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; font-size: 0.9em; }
    .category-metric { color: #4a5568; padding: 6px 0; border-bottom: 1px solid rgba(59, 130, 246, 0.2); font-weight: 500; }
    .uae-dirham-symbol { display: inline-block; vertical-align: -0.1em; width: 1em; height: 1em; margin-right: 0.2em; fill: currentColor; }
    .financial-performance-section .kpi-card:nth-child(1)::before { background: #10b981; }
    .financial-performance-section .kpi-card:nth-child(2)::before { background: #3b82f6; }
    .financial-performance-section .kpi-card:nth-child(3)::before { background: #8b5cf6; }
    .financial-performance-section .kpi-card:nth-child(4)::before { background: #f59e0b; }
    .product-performance-section .kpi-card::before { background: #ef4444; }
    .product-performance-section .kpi-card.large::before { background: #dc2626; }
    .product-performance-section .kpi-cards.category-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 28px; margin-top: 24px; margin-bottom: 24px; width: 100%; max-width: none; }
    .product-performance-section .kpi-cards.category-cards .kpi-card { min-height: 320px; max-height: 350px; background: linear-gradient(135deg, #fafafa 0%, #ffffff 100%); border: 2px solid rgba(102, 126, 234, 0.1); padding: 20px; display: flex; flex-direction: column; justify-content: space-between; }
    .product-performance-section .kpi-cards.category-cards .kpi-card .kpi-value { font-size: 1.4em; line-height: 1.6; flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; font-weight: 600; color: #1f2937; text-align: center; gap: 12px; margin-bottom: 10px; }
    .product-performance-section .kpi-cards.category-cards .kpi-card .kpi-label { font-size: 1.6em; margin-bottom: 16px; font-weight: 700; color: #1e40af; text-decoration: underline; text-align: center; letter-spacing: 1px; padding: 8px 12px; }
    .revenue-drivers { grid-column: 1 / -1; min-height: auto; width: 100%; max-width: 100%; display: flex; flex-direction: column; overflow: hidden; box-sizing: border-box; }
    .revenue-drivers .kpi-label { font-weight: 700; font-size: 1.05em; text-transform: uppercase; letter-spacing: 0.8px; text-align: center; margin-bottom: 20px; }
    .revenue-drivers .kpi-value { width: 100%; text-align: left; flex: 1; }
    .revenue-drivers > div { padding-left: 0; margin: 0; width: 100%; }
    .revenue-drivers > div > div { margin-bottom: 16px; display: flex; align-items: center; padding: 12px 16px; background: rgba(102, 126, 234, 0.05); border-radius: 8px; border-left: 4px solid #667eea; transition: all 0.2s ease; width: 100%; }
    .revenue-drivers > div > div:hover { background: rgba(102, 126, 234, 0.08); transform: translateX(4px); }
    .revenue-drivers > div > div:not(:last-child) { margin-bottom: 16px; }
    .revenue-drivers > div > div > span:first-child { font-size: 2.2em; margin-right: 16px; min-width: 40px; text-align: center; }
    .revenue-drivers > div > div > div { flex: 1; }
    .revenue-drivers > div > div > div > div:first-child { font-weight: 600; font-size: 1.1em; color: #1f2937; margin-bottom: 4px; }
    .revenue-drivers > div > div > div > div:last-child { font-size: 0.9em; color: #6b7280; }
    .revenue-drivers .arrow-positive, .revenue-drivers .arrow-negative { font-size: 0.85em; padding: 3px 8px; margin-left: 8px; }
    .geographic-distribution-section .kpi-card::before { background: #06b6d4; }
    .export-regions { display: flex !important; flex-wrap: nowrap !important; gap: 20px !important; width: 100% !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
    .export-regions .kpi-card { min-height: 140px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; flex: 1 1 0 !important; min-width: 0 !important; }
    .export-regions .kpi-card::before { background: linear-gradient(to bottom, #06b6d4, #0284c7); }
    .export-regions .kpi-card .kpi-trend { font-size: 0.8em; color: #64748b; }
    .export-connector { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-start; height: 40px; margin: 10px 0 15px 0; padding-right: 25%; position: relative; }
    .export-connector__arrow { width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 12px solid #6b7280; }
    .export-connector__bracket { position: absolute; top: 20px; left: 0; right: 0; height: 3px; background: #6b7280; box-shadow: 0 0 8px rgba(59, 130, 246, 0.6), 0 0 16px rgba(59, 130, 246, 0.4); }
    .export-connector__bracket::before, .export-connector__bracket::after { content: ''; position: absolute; width: 3px; height: 15px; background: #6b7280; box-shadow: 0 0 8px rgba(59, 130, 246, 0.6), 0 0 16px rgba(59, 130, 246, 0.4); }
    .export-connector__bracket::before { left: 0; top: 0; }
    .export-connector__bracket::after { right: 0; top: 0; }
    .uae-icon-container { width: 60px; height: 60px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: transparent; box-shadow: none; }
    .uae-icon { width: 50px; height: 50px; }
    .rotating-emoji-container { width: 60px; height: 60px; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: transparent; box-shadow: none; overflow: hidden; }
    .rotating-emoji { font-size: 40px; animation: rotate-emoji 20s linear infinite; }
    @keyframes rotate-emoji { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .region-globe-container { width: 50px; height: 50px; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: transparent; box-shadow: none; border: none; }
    .region-globe { font-size: 32px; animation: pulse-globe 3s ease-in-out infinite; filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2)); }
    @keyframes pulse-globe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    .customer-insights-section .kpi-card::before { background: #84cc16; }
    .customer-subtitle { font-weight: bold; font-size: 12px; margin-top: 1px; color: #666; text-align: center; }
    .customer-names-small { font-size: 0.9em; color: #666; font-weight: 500; margin-top: 12px; line-height: 1.3; }
    .customer-line { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; min-width: 0; }
    .customer-line span:first-child { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
    .customer-percentage { font-size: 0.8em; color: #666; font-weight: 600; flex-shrink: 0; }
    .customer-line-with-dots { display: flex; align-items: baseline; width: 100%; margin-bottom: 2px; }
    .customer-name { flex-shrink: 0; margin-right: 8px; }
    .customer-dots { flex: 1; border-bottom: 1px dotted #ccc; margin: 0 8px; height: 1px; align-self: flex-end; margin-bottom: 0.2em; }
    .kpi-error-state { padding: 32px; text-align: center; color: #888; }
    .kpi-trend { display: block !important; margin-top: 4px; }
    .back-button { position: absolute; top: 20px; left: 20px; background: #667eea; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); transition: all 0.3s ease; z-index: 10; }
    .back-button:hover { background: #5a6fcf; transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15); }
    @media (max-width: 1400px) { .kpi-cards { grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 18px; } .kpi-section { padding: 28px; margin-bottom: 28px; } }
    @media (max-width: 1200px) { .kpi-cards { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; } .kpi-card.large { grid-column: span 1; } .kpi-card { min-height: 160px; padding: 20px; } .kpi-label { font-size: 0.85em; } .kpi-value { font-size: 1.3em; } .kpi-icon { font-size: 2em; margin-bottom: 12px; } .export-regions { gap: 15px !important; } }
    @media (max-width: 1100px) { .kpi-cards { grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 14px; } }
    @media (max-width: 1000px) { .kpi-cards { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; } }
    @media (max-width: 768px) { .kpi-dashboard { padding: 16px; } .kpi-section { padding: 20px; margin-bottom: 20px; border-radius: 12px; } .kpi-cards { grid-template-columns: 1fr; gap: 16px; } .kpi-card { padding: 18px; min-height: 160px; border-radius: 10px; } .kpi-label { font-size: 0.85em; margin-bottom: 10px; } .kpi-value { font-size: 1.2em; margin-bottom: 10px; } .kpi-icon { font-size: 1.8em; margin-bottom: 12px; } .kpi-trend { font-size: 0.8em; padding: 3px 6px; } .export-regions { gap: 10px !important; } }
    @media (max-width: 480px) { .export-regions { gap: 8px !important; } }
    
    /* Chart Styles */
    .chart-card { background: #fff; border-radius: 16px; box-shadow: 0 8px 32px rgba(15,40,87,0.08); overflow: hidden; margin: 24px; }
    .legend-container { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; align-items: center; padding: 16px 24px; background: rgba(248,250,252,0.9); border-bottom: 1px solid #e5e7eb; }
    .legend-item { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .chart-wrapper { position: relative; padding: 24px; padding-bottom: 100px; background: #fff; }
    #salesVolumeChart { width: 100%; height: 450px; }
    .bottom-row { position: absolute; left: 20px; right: 20px; display: flex; align-items: center; }
    .bottom-row-label { font-weight: bold; font-size: 18px; white-space: nowrap; min-width: 200px; display: flex; align-items: center; gap: 4px; }
    .bottom-row-label .uae-symbol { width: 16px; height: 16px; }
    .bottom-row-values { flex: 1; display: flex; justify-content: space-around; }
    .bottom-row-value { font-weight: bold; font-size: 18px; text-align: center; min-width: 100px; }
    .sales-volume-row { bottom: 55px; }
    .sales-volume-row .bottom-row-label, .sales-volume-row .bottom-row-value { color: #8e44ad; }
    .sales-per-kg-row { bottom: 20px; }
    .sales-per-kg-row .bottom-row-label, .sales-per-kg-row .bottom-row-value { color: #2E865F; }
    .variance-note { text-align: center; font-size: 14px; color: #666; font-style: italic; padding: 16px 24px; background: rgba(248,250,252,0.8); }
  </style>
</head>
<body>
  <!-- Main Card Grid -->
  <div class="dashboard-container">
    <div class="cards-grid cards-grid--single">
      <div class="card" onclick="showOverlay('kpi')">
        <span class="card-icon">📈</span>
        <div class="card-title">Divisional KPIs</div>
        <p class="card-copy">Key performance indicators and metrics overview</p>
      </div>
    </div>
    <div class="cards-grid">
      <div class="card" onclick="showOverlay('sales-volume')">
        <span class="card-icon">📊</span>
        <div class="card-title">Sales & Volume Analysis</div>
        <p class="card-copy">Visual analysis of sales revenue and volume trends</p>
      </div>
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">📋</span><div class="card-title">Margin Analysis</div><p class="card-copy">Profit margins breakdown</p></div>
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">🏭</span><div class="card-title">Manufacturing Cost</div><p class="card-copy">Direct manufacturing costs</p></div>
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">📊</span><div class="card-title">Below GP Expenses</div><p class="card-copy">Operating expenses</p></div>
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">📈</span><div class="card-title">Cost & Profitability</div><p class="card-copy">Historical trends</p></div>
    </div>
    <div class="cards-grid">
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">💰</span><div class="card-title">P&L Statement</div><p class="card-copy">Financial breakdown</p></div>
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">📊</span><div class="card-title">Product Groups</div><p class="card-copy">Product performance</p></div>
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">🧑‍💼</span><div class="card-title">Sales Reps</div><p class="card-copy">Rep performance</p></div>
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">👥</span><div class="card-title">Customers</div><p class="card-copy">Customer analysis</p></div>
      <div class="card" onclick="alert('Coming soon')"><span class="card-icon">🌍</span><div class="card-title">Countries</div><p class="card-copy">Geographic distribution</p></div>
    </div>
  </div>

  <!-- KPI Overlay - EXACT REPLICA of KPIExecutiveSummary -->
  <div class="overlay" id="overlay-kpi">
    <div class="overlay-scroll">
      <div style="background: linear-gradient(135deg, #0d1f3d 0%, #1a3a6e 35%, #2d5a9e 70%, #4a7fc7 100%); padding: 24px 72px; position: relative;">
        <button onclick="hideOverlay('kpi')" style="position: fixed; top: 20px; right: 20px; z-index: 9999; background: rgba(255,255,255,0.95); color: #263238; border: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2); display: flex; align-items: center; gap: 8px;">← Back to Divisional Dashboard</button>
        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 16px; position: relative;">
          <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px;">
            <h2 style="color: white; margin: 0; font-size: 2.2rem; font-weight: 700; display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 3rem; display: inline-flex; background: rgba(255,255,255,0.15); padding: 8px; border-radius: 12px; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center;">📈</span>
              Divisional KPIs
            </h2>
            <p style="color: rgba(255,255,255,0.7); margin: 0; font-size: 0.9rem; line-height: 1.4; max-width: 400px;">Key performance indicators and metrics overview</p>
          </div>
          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; position: absolute; left: 60%; top: 50%; transform: translate(-50%, -50%);">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="padding: 8px 18px; border-radius: 999px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.32); font-weight: 600; color: white; backdrop-filter: blur(4px);">${periodText}</div>
              ${comparisonText ? `<div style="font-weight: 600; text-transform: lowercase; color: rgba(255,255,255,0.6); font-size: 0.8rem;">vs</div>
              <div style="padding: 8px 18px; border-radius: 999px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.32); font-weight: 600; color: white; backdrop-filter: blur(4px);">${comparisonText}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
      <div class="overlay-body">
        <!-- KPI Dashboard - EXACT structure from KPIExecutiveSummary -->
        <div class="kpi-dashboard">
          <h2>Executive Summary – ${divisionName}</h2>
          <div class="kpi-period-header">
            <span>${periodText}</span>
            ${comparisonText ? `<span class="kpi-period-vs">Vs</span><span>${comparisonText}</span>` : ''}
          </div>
          
          <!-- Financial Performance Section -->
          <div class="kpi-section financial-performance-section">
            <h3 class="kpi-section-title">💰 Financial Performance</h3>
            <div class="kpi-cards">
              <div class="kpi-card">
                <div class="kpi-icon">📈</div>
                <div class="kpi-label">Revenue</div>
                <div class="kpi-value">${formatM(kpiData.sales)}</div>
                <div class="kpi-trend">${growth(kpiData.sales, kpiData.salesPrev)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-icon">💵</div>
                <div class="kpi-label">Gross Profit</div>
                <div class="kpi-value">${formatM(kpiData.grossProfit)}</div>
                <div class="kpi-trend">${growth(kpiData.grossProfit, kpiData.grossProfitPrev)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-icon">💎</div>
                <div class="kpi-label">Net Income</div>
                <div class="kpi-value">${formatM(kpiData.netProfit)}</div>
                <div class="kpi-trend">${growth(kpiData.netProfit, kpiData.netProfitPrev)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-icon">⚡</div>
                <div class="kpi-label">EBITDA</div>
                <div class="kpi-value">${formatM(kpiData.ebitda)}</div>
                <div class="kpi-trend">${growth(kpiData.ebitda, kpiData.ebitdaPrev)}</div>
              </div>
            </div>
          </div>
          
          <!-- Product Performance Section -->
          <div class="kpi-section product-performance-section">
            <h3 class="kpi-section-title">📦 Product Performance</h3>
            <div class="kpi-cards">
              <div class="kpi-card revenue-drivers" style="grid-column: 1 / -1; min-height: auto;">
                <div class="kpi-icon">🏆</div>
                <div class="kpi-label">Top Revenue Drivers</div>
                <div class="kpi-value">
                  ${topProductsHTML || '<div style="text-align: center; color: #666;">No product data available</div>'}
                </div>
              </div>
            </div>
            <div class="kpi-cards">
              <div class="kpi-card">
                <div class="kpi-icon">📊</div>
                <div class="kpi-label">Total Sales Volume</div>
                <div class="kpi-value">${formatKgs(totalKgs)}</div>
                <div class="kpi-trend">${growth(totalKgs, totalKgsPrev)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-icon">⚡</div>
                <div class="kpi-label">Selling Price</div>
                <div class="kpi-value">${formatAEDPerKg(avgSellingPrice)}</div>
                <div class="kpi-trend">${growth(avgSellingPrice, avgSellingPricePrev)}</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-icon">🎯</div>
                <div class="kpi-label">MoRM</div>
                <div class="kpi-value">${formatAEDPerKg(avgMoRM)}</div>
                <div class="kpi-trend">${growth(avgMoRM, avgMoRMPrev)}</div>
              </div>
            </div>
            
            <!-- Process Categories Row -->
            ${processCategoriesHTML ? `
            <div class="kpi-cards category-cards">
              ${processCategoriesHTML}
            </div>
            ` : ''}
            
            <!-- Material Categories Row -->
            ${materialCategoriesHTML ? `
            <div class="kpi-cards category-cards">
              ${materialCategoriesHTML}
            </div>
            ` : ''}
          </div>
          
          <!-- Geographic Distribution Section -->
          <div class="kpi-section geographic-distribution-section">
            <h3 class="kpi-section-title">🌍 Geographic Distribution</h3>
            <div class="kpi-cards">
              <div class="kpi-card large">
                <div class="uae-icon-container">
                  <svg class="uae-icon" viewBox="0 0 900 600" xmlns="http://www.w3.org/2000/svg">
                    <rect width="900" height="200" fill="#00732f"/>
                    <rect width="900" height="200" y="200" fill="#ffffff"/>
                    <rect width="900" height="200" y="400" fill="#000000"/>
                    <rect width="300" height="600" fill="#ff0000"/>
                  </svg>
                </div>
                <div class="kpi-label">UAE</div>
                <div class="kpi-value">67.8%</div>
                <div class="kpi-trend">of total sales</div>
                <div style="color: #10b981; font-size: 14px; font-weight: 700; margin-top: 2px;">
                  <span style="font-weight: 900;">↑ 2.1%</span>
                  <div style="font-size: 10px; font-weight: 400; color: #666; margin-top: 2px;">Growth</div>
                </div>
              </div>
              <div class="kpi-card large">
                <div class="rotating-emoji-container">
                  <div class="rotating-emoji">🌍</div>
                </div>
                <div class="kpi-label">Export</div>
                <div class="kpi-value">32.2%</div>
                <div class="kpi-trend">of total sales</div>
                <div style="color: #ef4444; font-size: 14px; font-weight: 700; margin-top: 2px;">
                  <span style="font-weight: 900;">↓ 6.4%</span>
                  <div style="font-size: 10px; font-weight: 400; color: #666; margin-top: 2px;">Decline</div>
                </div>
              </div>
            </div>
            <div class="export-connector">
              <div class="export-connector__arrow"></div>
              <div class="export-connector__bracket"></div>
            </div>
            <div class="kpi-cards export-regions">
              <div class="kpi-card" style="background: linear-gradient(135deg, #1e40af, #1e40afcc); border-left: 4px solid #1e40af; box-shadow: 0 4px 12px rgba(30,64,175,0.26); color: white;">
                <div class="region-globe-container"><div class="region-globe">🌍</div></div>
                <div class="kpi-label" style="color: white; font-weight: 700;">Arabian Peninsula</div>
                <div class="kpi-value" style="color: white; font-weight: 800;">18.5%</div>
                <div class="kpi-trend" style="color: #e2e8f0;">57.4% of export</div>
              </div>
              <div class="kpi-card" style="background: linear-gradient(135deg, #3b82f6, #3b82f6cc); border-left: 4px solid #3b82f6; box-shadow: 0 4px 12px rgba(59,130,246,0.26); color: white;">
                <div class="region-globe-container"><div class="region-globe">🌍</div></div>
                <div class="kpi-label" style="color: white; font-weight: 700;">West Asia</div>
                <div class="kpi-value" style="color: white; font-weight: 800;">8.3%</div>
                <div class="kpi-trend" style="color: #e2e8f0;">25.8% of export</div>
              </div>
              <div class="kpi-card" style="background: linear-gradient(135deg, #60a5fa, #60a5facc); border-left: 4px solid #60a5fa; box-shadow: 0 4px 12px rgba(96,165,250,0.26); color: white;">
                <div class="region-globe-container"><div class="region-globe">🌍</div></div>
                <div class="kpi-label" style="color: white; font-weight: 700;">Southern Africa</div>
                <div class="kpi-value" style="color: white; font-weight: 800;">3.2%</div>
                <div class="kpi-trend" style="color: #e2e8f0;">9.9% of export</div>
              </div>
              <div class="kpi-card" style="background: linear-gradient(135deg, #93c5fd, #93c5fdcc); border-left: 4px solid #93c5fd; box-shadow: 0 4px 12px rgba(147,197,253,0.26); color: #1a365d;">
                <div class="region-globe-container"><div class="region-globe">🌐</div></div>
                <div class="kpi-label" style="color: #2d3748; font-weight: 700;">Others</div>
                <div class="kpi-value" style="color: #1a365d; font-weight: 800;">2.2%</div>
                <div class="kpi-trend" style="color: #4a5568;">6.8% of export</div>
              </div>
            </div>
          </div>
          
          <!-- Customer Insights Section -->
          <div class="kpi-section customer-insights-section">
            <h3 class="kpi-section-title">👥 Customer Insights</h3>
            <div class="kpi-cards">
              <div class="kpi-card">
                <div class="kpi-icon">🥇</div>
                <div class="kpi-label">Top 5 Customers</div>
                <div class="kpi-value">43.2%</div>
                <div class="customer-subtitle">of total sales</div>
                <div class="customer-names-small" style="text-align: left;">
                  <div class="customer-line"><span>1. COMPANY A</span><span class="customer-percentage">14.1%</span></div>
                  <div class="customer-line"><span>2. COMPANY B</span><span class="customer-percentage">10.0%</span></div>
                  <div class="customer-line"><span>3. COMPANY C</span><span class="customer-percentage">7.1%</span></div>
                  <div class="customer-line"><span>4. COMPANY D</span><span class="customer-percentage">6.5%</span></div>
                  <div class="customer-line"><span>5. COMPANY E</span><span class="customer-percentage">5.5%</span></div>
                </div>
              </div>
              <div class="kpi-card">
                <div class="kpi-icon">🔟</div>
                <div class="kpi-label">Top 10 Customers</div>
                <div class="kpi-value">62.8%</div>
                <div class="customer-subtitle">of total sales</div>
                <div class="customer-names-small" style="text-align: left;">
                  <div class="customer-line"><span>6. COMPANY F</span><span class="customer-percentage">4.8%</span></div>
                  <div class="customer-line"><span>7. COMPANY G</span><span class="customer-percentage">4.2%</span></div>
                  <div class="customer-line"><span>8. COMPANY H</span><span class="customer-percentage">3.9%</span></div>
                  <div class="customer-line"><span>9. COMPANY I</span><span class="customer-percentage">3.5%</span></div>
                  <div class="customer-line"><span>10. COMPANY J</span><span class="customer-percentage">3.1%</span></div>
                </div>
              </div>
              <div class="kpi-card">
                <div class="kpi-icon">🏆</div>
                <div class="kpi-label">Top 20 Customers</div>
                <div class="kpi-value">81.5%</div>
                <div class="customer-subtitle">of total sales</div>
                <div class="customer-names-small" style="text-align: left;">
                  <div class="customer-line"><span>11. COMPANY K</span><span class="customer-percentage">2.8%</span></div>
                  <div class="customer-line"><span>12. COMPANY L</span><span class="customer-percentage">2.5%</span></div>
                  <div class="customer-line"><span>13. COMPANY M</span><span class="customer-percentage">2.3%</span></div>
                  <div class="customer-line"><span>14. COMPANY N</span><span class="customer-percentage">2.1%</span></div>
                  <div class="customer-line"><span>15. COMPANY O</span><span class="customer-percentage">1.9%</span></div>
                </div>
              </div>
            </div>
            <div class="kpi-cards" style="margin-top: 20px;">
              <div class="kpi-card" style="grid-column: 1 / -1; max-width: 400px; margin: 0 auto;">
                <div class="kpi-icon">💰</div>
                <div class="kpi-label">AVG Sales per Customer</div>
                <div class="kpi-value"><span class="uae-symbol">${uaeSvg}</span>342K</div>
                <div class="kpi-trend">average value</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Sales Volume Overlay -->
  <div class="overlay" id="overlay-sales-volume">
    <button class="overlay-close" onclick="hideOverlay('sales-volume')">← Back to Divisional Dashboard</button>
    <div class="overlay-scroll">
      <div class="overlay-banner">
        <div class="overlay-heading">
          <h2 class="overlay-title"><span class="overlay-icon">📊</span>Sales & Volume Analysis</h2>
          <p class="overlay-description">Visual analysis of sales revenue and volume trends</p>
        </div>
        <div class="overlay-period-wrapper">
          <div class="overlay-period-group">
            <div class="overlay-period">${periodText}</div>
            ${comparisonText ? `<div class="overlay-period-divider">Vs</div><div class="overlay-period overlay-period--secondary">${comparisonText}</div>` : ''}
          </div>
        </div>
      </div>
      <div class="overlay-body">
        <div class="chart-card">
          <div class="legend-container" id="legendContainer"></div>
          <div class="chart-wrapper">
            <div id="salesVolumeChart"></div>
            <div class="bottom-row sales-volume-row">
              <span class="bottom-row-label">Sales Volume (MT)</span>
              <div class="bottom-row-values" id="salesVolumeValues"></div>
            </div>
            <div class="bottom-row sales-per-kg-row">
              <span class="bottom-row-label">Sales <span class="uae-symbol" style="color:#2E865F">${uaeSvg}</span> per Kg</span>
              <div class="bottom-row-values" id="salesPerKgValues"></div>
            </div>
          </div>
          <div class="variance-note">% variance based on sequential period comparison</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    var periodLabels = ${JSON.stringify(periodLabels)};
    var seriesData = ${JSON.stringify(seriesData)};
    var salesVolumeData = ${JSON.stringify(salesVolumeData)};
    var salesPerKgData = ${JSON.stringify(salesPerKgData)};
    var barColors = ${JSON.stringify(barColors)};
    var percentVarianceData = ${JSON.stringify(percentVarianceData)};
    var legendItems = ${JSON.stringify(legendItems)};
    
    var uaeSvgDataUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg viewBox="0 0 344.84 299.91" xmlns="http://www.w3.org/2000/svg" fill="#222"><path d="M342.14,140.96l2.7,2.54v-7.72c0-17-11.92-30.84-26.56-30.84h-23.41C278.49,36.7,222.69,0,139.68,0c-52.86,0-59.65,0-109.71,0,0,0,15.03,12.63,15.03,52.4v52.58h-27.68c-5.38,0-10.43-2.08-14.61-6.01l-2.7-2.54v7.72c0,17.01,11.92,30.84,26.56,30.84h18.44s0,29.99,0,29.99h-27.68c-5.38,0-10.43-2.07-14.61-6.01l-2.7-2.54v7.71c0,17,11.92,30.82,26.56,30.82h18.44s0,54.89,0,54.89c0,38.65-15.03,50.06-15.03,50.06h109.71c85.62,0,139.64-36.96,155.38-104.98h32.46c5.38,0,10.43,2.07,14.61,6l2.7,2.54v-7.71c0-17-11.92-30.83-26.56-30.83h-18.9c.32-4.88.49-9.87.49-15s-.18-10.11-.51-14.99h28.17c5.37,0,10.43,2.07,14.61,6.01ZM89.96,15.01h45.86c61.7,0,97.44,27.33,108.1,89.94l-153.96.02V15.01ZM136.21,284.93h-46.26v-89.98l153.87-.02c-9.97,56.66-42.07,88.38-107.61,90ZM247.34,149.96c0,5.13-.11,10.13-.34,14.99l-157.04.02v-29.99l157.05-.02c.22,4.84.33,9.83.33,15Z"/></svg>');
    
    function showOverlay(id) {
      document.getElementById('overlay-' + id).classList.add('active');
      document.body.style.overflow = 'hidden';
      if (id === 'sales-volume') setTimeout(initChart, 100);
    }
    function hideOverlay(id) {
      document.getElementById('overlay-' + id).classList.remove('active');
      document.body.style.overflow = '';
    }
    
    var legendContainer = document.getElementById('legendContainer');
    legendItems.forEach(function(item) {
      var div = document.createElement('div');
      div.className = 'legend-item';
      div.style.backgroundColor = item.color;
      div.style.color = item.textColor;
      div.textContent = item.label;
      legendContainer.appendChild(div);
    });
    
    var salesVolumeValuesContainer = document.getElementById('salesVolumeValues');
    var salesPerKgValuesContainer = document.getElementById('salesPerKgValues');
    
    periodLabels.forEach(function(label, index) {
      var volValue = document.createElement('div');
      volValue.className = 'bottom-row-value';
      volValue.textContent = Math.round(salesVolumeData[index] / 1000).toLocaleString() + ' MT';
      salesVolumeValuesContainer.appendChild(volValue);
      
      var perKgValue = document.createElement('div');
      perKgValue.className = 'bottom-row-value';
      perKgValue.textContent = salesPerKgData[index].toFixed(2);
      salesPerKgValuesContainer.appendChild(perKgValue);
    });
    
    function initChart() {
      var chartDom = document.getElementById('salesVolumeChart');
      if (!chartDom) return;
      var myChart = echarts.init(chartDom);
      
      var option = {
        grid: { left: '0%', right: '0%', bottom: 100, top: 25, containLabel: true },
        xAxis: {
          type: 'category', data: periodLabels, position: 'bottom',
          axisLabel: {
            rotate: 0, fontWeight: 'bold', fontSize: 18, color: '#000', margin: 30,
            formatter: function(value) {
              var parts = value.split('-');
              if (parts.length >= 3) {
                var year = parts[0];
                if (parts.length > 3) {
                  return year + '\\n' + parts.slice(1, -1).join('-') + '\\n' + parts[parts.length - 1];
                } else {
                  var month = parts[1];
                  return year + '\\n' + (month === 'Year' ? 'FY' : month) + '\\n' + parts[2];
                }
              }
              return value;
            }
          },
          axisLine: { lineStyle: { color: '#000', width: 2 } },
          axisTick: { alignWithLabel: true, length: 4, lineStyle: { color: '#ccc' } }
        },
        yAxis: [{ type: 'value', show: false, scale: true, max: function(value) { return value.max * 1.15; } }],
        series: [
          {
            name: '', data: seriesData, type: 'bar', barMaxWidth: '80%', barWidth: '80%', barCategoryGap: '0%',
            itemStyle: { color: function(params) { return barColors[params.dataIndex]; } },
            label: {
              show: true, position: 'top', fontWeight: 'bold', fontSize: 18, color: '#222',
              formatter: function(params) {
                var value = params.value;
                var formatted = value >= 1000000 ? (value / 1000000).toFixed(1) + 'M' : value >= 1000 ? (value / 1000).toFixed(1) + 'K' : value.toFixed(0);
                return '{uae|} {num|' + formatted + '}';
              },
              rich: {
                uae: { width: 16, height: 16, lineHeight: 18, padding: [-2, 4, 0, 0], align: 'center', verticalAlign: 'top', backgroundColor: { image: uaeSvgDataUrl } },
                num: { fontSize: 18, fontWeight: 'bold', color: '#222', verticalAlign: 'middle', lineHeight: 18 }
              }
            },
            emphasis: { focus: 'series' }, z: 2
          },
          {
            name: 'Percent Difference', type: 'custom',
            renderItem: function(params, api) {
              var idx = api.value(0);
              var value = api.value(1);
              var pct = percentVarianceData[idx];
              if (pct === null || pct === undefined) return null;
              var color = pct > 0 ? '#2E865F' : pct < 0 ? '#dc3545' : '#888';
              var x = api.coord([idx, value])[0];
              var y = api.coord([idx, value])[1];
              return { type: 'text', style: { text: (pct > 0 ? '+' : '') + pct.toFixed(1) + '%', fill: color, font: 'bold 16px sans-serif', textAlign: 'center', textVerticalAlign: 'bottom' }, position: [x, y - 36] };
            },
            data: periodLabels.map(function(_, idx) { return [idx, seriesData[idx]]; }), z: 3
          }
        ],
        tooltip: { show: false, trigger: 'none' }, animation: false
      };
      
      myChart.setOption(option);
      window.addEventListener('resize', function() { myChart.resize(); });
    }
  <\/script>
</body>
</html>`;
  }, [gatherExportData]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const htmlContent = await generateHTML();
      if (!htmlContent) {
        alert('Unable to generate export. Please ensure data is loaded.');
        return;
      }
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedDivision}_Divisional_Dashboard_${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  }, [generateHTML, selectedDivision, onClose]);

  return (
    <>
      <button onClick={onOpen} className="export-btn html-export" title="Export Divisional Dashboard">Divisional Export</button>
      {isVisible && (
        <div className="divisional-export-modal">
          <div className="divisional-export-content">
            <div className="divisional-export-header">
              <h2>📊 Export Divisional Dashboard</h2>
              <button className="divisional-export-close" onClick={onClose}>&times;</button>
            </div>
            <div className="divisional-export-body">
              <p>Export includes card grid, KPIs, and Sales & Volume chart.</p>
            </div>
            <div className="divisional-export-actions">
              <button className="divisional-export-btn cancel" onClick={onClose} disabled={isExporting}>Cancel</button>
              <button className="divisional-export-btn export" onClick={handleExport} disabled={isExporting}>{isExporting ? 'Exporting...' : 'Export HTML'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DivisionalDashboardExport;
