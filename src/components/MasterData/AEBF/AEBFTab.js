import React, { useState } from 'react';
import { Tabs } from 'antd';
import ActualTab from './ActualTab';
import EstimateTab from './EstimateTab';
import BudgetTab from './BudgetTab';
import ForecastTab from './ForecastTab';
import AEBFWorkflow from './AEBFWorkflow';

/**
 * AEBF Component - Master Data Management
 * 
 * AEBF = Actual, Estimate, Budget, Forecast
 * Main container with 4 subtabs for managing different financial data types
 */
const AEBFTab = () => {
  const [activeKey, setActiveKey] = useState('actual');

  const handleTabChange = (key) => {
    setActiveKey(key);
  };

  const tabItems = [
    {
      key: 'actual',
      label: (
        <span>
          <span style={{ fontWeight: 'bold', color: '#1890ff' }}>A</span>ctual
        </span>
      ),
      children: <ActualTab />
    },
    {
      key: 'estimate',
      label: (
        <span>
          <span style={{ fontWeight: 'bold', color: '#52c41a' }}>E</span>stimate
        </span>
      ),
      children: <EstimateTab />
    },
    {
      key: 'budget',
      label: (
        <span>
          <span style={{ fontWeight: 'bold', color: '#faad14' }}>B</span>udget
        </span>
      ),
      children: <BudgetTab />
    },
    {
      key: 'forecast',
      label: (
        <span>
          <span style={{ fontWeight: 'bold', color: '#722ed1' }}>F</span>orecast
        </span>
      ),
      children: <ForecastTab />
    },
    {
      key: 'workflow',
      label: (
        <span>
          <span style={{ fontWeight: 'bold', color: '#eb2f96' }}>📊</span> Workflow
        </span>
      ),
      children: <AEBFWorkflow />
    }
  ];

  return (
    <div className="aebf-container" style={{ padding: '8px 16px' }}>
      <Tabs 
        activeKey={activeKey} 
        onChange={handleTabChange}
        type="card"
        size="middle"
        items={tabItems}
        style={{ marginBottom: 0 }}
      />
    </div>
  );
};

export default AEBFTab;
