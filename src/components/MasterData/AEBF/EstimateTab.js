import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Modal, Spin, Tag, Statistic, Row, Col, Card, Tabs, Input, Checkbox, InputNumber, Tooltip, Alert } from 'antd';
import { DownloadOutlined, ReloadOutlined, CalculatorOutlined, CheckCircleOutlined, PercentageOutlined, PlusOutlined, MinusOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { useExcelData } from '../../../contexts/ExcelDataContext';
import { useFilter } from '../../../contexts/FilterContext';
import axios from 'axios';

const { Search } = Input;

/**
 * EstimateTab Component - Financial Estimates Management
 * Calculates estimates based on Actual data averages per dimension
 */
const EstimateTab = () => {
  const { selectedDivision } = useExcelData();
  const { basePeriodIndex, columnOrder } = useFilter();
  
  // Data and loading state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  
  // Year tabs
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearSummary, setYearSummary] = useState(null);
  
  // Global search
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Create Estimate modal
  const [estimateModalVisible, setEstimateModalVisible] = useState(false);
  const [estimateStep, setEstimateStep] = useState(1); // 1=month selection, 2=review
  const [estimateYear, setEstimateYear] = useState(null);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [calculating, setCalculating] = useState(false);
  const [calculatedEstimates, setCalculatedEstimates] = useState(null);
  const [editableEstimates, setEditableEstimates] = useState({});
  const [approving, setApproving] = useState(false);
  const [existingEstimateCount, setExistingEstimateCount] = useState(0);
  const [clearing, setClearing] = useState(false);
  const [confirmReplaceVisible, setConfirmReplaceVisible] = useState(false);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Fetch available years
  const fetchAvailableYears = async () => {
    if (!selectedDivision) return;
    
    try {
      const response = await axios.get('http://localhost:3001/api/aebf/filter-options', {
        params: { division: selectedDivision, type: 'Estimate' }
      });
      
      if (response.data.success) {
        const years = response.data.data.filterOptions.year || [];
        setAvailableYears(years.sort((a, b) => b - a));
        
        if (years.length > 0 && !selectedYear) {
          let defaultYear = years[0];
          if (basePeriodIndex !== null && basePeriodIndex >= 0 && columnOrder.length > basePeriodIndex) {
            const basePeriod = columnOrder[basePeriodIndex];
            if (basePeriod && basePeriod.year) {
              defaultYear = basePeriod.year;
            }
          }
          setSelectedYear(defaultYear);
        }
      }
    } catch (error) {
      console.error('Error fetching years:', error);
    }
  };

  // Fetch year-specific summary
  const fetchYearSummary = async (year, searchFilter = '') => {
    if (!selectedDivision) return;
    
    try {
      const params = { 
        division: selectedDivision, 
        types: 'Actual,Estimate' // Fetch BOTH for full year (FY) view
      };
      
      if (searchFilter && searchFilter.trim()) {
        params.search = searchFilter.trim();
      } else {
        if (year) {
          params.year = year;
        }
      }
      
      const response = await axios.get('http://localhost:3001/api/aebf/year-summary', { params });
      
      if (response.data.success) {
        setYearSummary(response.data.data.summary);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  // Fetch data
  const fetchData = async (page = 1, pageSize = 50, searchFilter = null) => {
    if (!selectedDivision) {
      message.warning('Please select a division first');
      return;
    }
    
    setLoading(true);
    try {
      const params = {
        division: selectedDivision,
        types: 'Actual,Estimate', // Fetch both Actual and Estimate data
        page,
        pageSize,
        sortBy: 'year',
        sortOrder: 'desc',
      };
      
      const search = searchFilter !== null ? searchFilter : globalSearch;
      if (search && search.trim()) {
        params.search = search.trim();
      } else {
        if (selectedYear) params.year = selectedYear;
      }
      
      const response = await axios.get('http://localhost:3001/api/aebf/actual', { params });
      
      if (response.data.success) {
        setData(response.data.data.data.map(item => ({ ...item, key: item.id })));
        setPagination({
          current: response.data.data.pagination.page,
          pageSize: response.data.data.pagination.pageSize,
          total: response.data.data.pagination.total,
        });
      } else {
        message.error('Failed to load data');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Year change handler
  const handleYearChange = (year) => {
    setSelectedYear(parseInt(year));
    setGlobalSearch('');
  };

  // Search handlers
  const handleSearch = (value) => {
    setGlobalSearch(value);
    setPagination({ ...pagination, current: 1 });
    if (selectedYear) fetchYearSummary(selectedYear, value);
    fetchData(1, pagination.pageSize, value);
  };
  
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setGlobalSearch(value);
    if (value === '') {
      if (selectedYear) fetchYearSummary(selectedYear, '');
      fetchData(1, pagination.pageSize, '');
    }
  };

  // Open estimate modal
  const openEstimateModal = async () => {
    let defaultYear = new Date().getFullYear();
    if (basePeriodIndex !== null && basePeriodIndex >= 0 && columnOrder.length > basePeriodIndex) {
      const basePeriod = columnOrder[basePeriodIndex];
      if (basePeriod && basePeriod.year) defaultYear = basePeriod.year;
    }
    
    setEstimateYear(defaultYear);
    setEstimateStep(1);
    setSelectedMonths([]);
    setCalculatedEstimates(null);
    setEditableEstimates({});
    setExistingEstimateCount(0);
    
    await fetchAvailableActualMonths(defaultYear);
    await fetchExistingEstimateCount(defaultYear);
    setEstimateModalVisible(true);
  };

  // Fetch existing estimate count for the year
  const fetchExistingEstimateCount = async (year) => {
    try {
      const response = await axios.get('http://localhost:3001/api/aebf/year-summary', {
        params: {
          division: selectedDivision,
          type: 'Estimate',
          year
        }
      });
      
      if (response.data.success && response.data.data.summary.length > 0) {
        // Sum up record counts from all values_type
        const totalCount = response.data.data.summary.reduce((sum, item) => sum + parseInt(item.record_count), 0);
        setExistingEstimateCount(totalCount);
      } else {
        setExistingEstimateCount(0);
      }
    } catch (error) {
      console.error('Error fetching estimate count:', error);
      setExistingEstimateCount(0);
    }
  };

  // Fetch available Actual months
  const fetchAvailableActualMonths = async (year) => {
    try {
      const response = await axios.get('http://localhost:3001/api/aebf/available-months', {
        params: {
          division: selectedDivision,
          year
        }
      });
      
      if (response.data.success) {
        const months = response.data.data.months.sort((a, b) => a - b);
        setAvailableMonths(months);
        console.log('Available Actual months:', months);
      }
    } catch (error) {
      console.error('Error fetching actual months:', error);
      message.error('Failed to fetch available months');
    }
  };

  // Clear old estimates for the year
  const handleClearEstimates = async () => {
    Modal.confirm({
      title: 'Clear All Estimates',
      content: `Are you sure you want to delete ALL estimate records for ${estimateYear}? This cannot be undone.`,
      okText: 'Yes, Clear All',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const response = await axios.delete('http://localhost:3001/api/aebf/clear-estimates', {
            params: {
              division: selectedDivision,
              year: estimateYear
            }
          });
          
          if (response.data.success) {
            message.success(response.data.data.message || `Cleared ${response.data.data.deletedCount} estimate records`);
            // Refresh the data
            fetchAvailableYears();
            fetchData();
            if (selectedYear) fetchYearSummary(selectedYear);
          } else {
            message.error('Failed to clear estimates');
          }
        } catch (error) {
          console.error('Error clearing estimates:', error);
          message.error('Failed to clear estimates');
        }
      }
    });
  };

  // Toggle month selection
  const handleMonthToggle = (month) => {
    if (selectedMonths.includes(month)) {
      setSelectedMonths(selectedMonths.filter(m => m !== month));
    } else {
      setSelectedMonths([...selectedMonths, month].sort((a, b) => a - b));
    }
  };

  // Calculate estimates (auto-clears old estimates if any exist)
  const handleCalculateEstimate = async () => {
    if (selectedMonths.length === 0) {
      message.warning('Please select at least one month to estimate');
      return;
    }
    
    // If there are existing estimates, show confirmation modal
    if (existingEstimateCount > 0) {
      setConfirmReplaceVisible(true);
    } else {
      // No existing estimates, just calculate
      await performCalculation(false);
    }
  };

  // Handle confirm replace
  const handleConfirmReplace = async () => {
    setConfirmReplaceVisible(false);
    await performCalculation(true);
  };

  // Perform the actual calculation
  const performCalculation = async (clearFirst) => {
    setCalculating(true);
    try {
      // Step 1: Clear existing estimates if needed
      if (clearFirst) {
        const clearResponse = await axios.delete('http://localhost:3001/api/aebf/clear-estimates', {
          params: {
            division: selectedDivision,
            year: estimateYear
          }
        });
        
        if (clearResponse.data.success) {
          message.info(`Cleared ${clearResponse.data.data.deletedCount} old estimate records`);
        }
      }
      
      // Step 2: Calculate new estimates
      const response = await axios.post('http://localhost:3001/api/aebf/calculate-estimate', {
        division: selectedDivision,
        year: estimateYear,
        selectedMonths,
        createdBy: 'Current User'
      });
      
      if (response.data.success) {
        setCalculatedEstimates(response.data.data.estimates);
        const editable = {};
        response.data.data.estimates.forEach(est => {
          editable[est.month] = {
            amount: est.amount,
            kgs: est.kgs,
            morm: est.morm
          };
        });
        setEditableEstimates(editable);
        setEstimateStep(2);
        setExistingEstimateCount(0); // Reset count after clearing
        message.success('Estimates calculated successfully');
      } else {
        message.error(response.data.error || 'Failed to calculate estimates');
      }
    } catch (error) {
      console.error('Error calculating:', error);
      message.error('Failed to calculate estimates');
    } finally {
      setCalculating(false);
    }
  };

  // Approve and save estimates
  const handleApproveEstimates = async () => {
    setApproving(true);
    try {
      const response = await axios.post('http://localhost:3001/api/aebf/save-estimate', {
        division: selectedDivision,
        year: estimateYear,
        estimates: editableEstimates,
        approvedBy: 'Current User'
      });
      
      if (response.data.success) {
        message.success('Estimates saved successfully');
        setEstimateModalVisible(false);
        fetchAvailableYears();
        fetchData();
        if (selectedYear) fetchYearSummary(selectedYear);
      } else {
        message.error(response.data.error || 'Failed to save estimates');
      }
    } catch (error) {
      console.error('Error saving:', error);
      message.error('Failed to save estimates');
    } finally {
      setApproving(false);
    }
  };

  // Apply percentage adjustment to all estimates
  const applyPercentageAdjustment = (percentage) => {
    const multiplier = 1 + (percentage / 100);
    const adjusted = {};
    
    Object.keys(editableEstimates).forEach(month => {
      adjusted[month] = {
        amount: Math.round((editableEstimates[month]?.amount || 0) * multiplier),
        kgs: Math.round((editableEstimates[month]?.kgs || 0) * multiplier),
        morm: Math.round((editableEstimates[month]?.morm || 0) * multiplier)
      };
    });
    
    setEditableEstimates(adjusted);
    message.success(`Applied ${percentage > 0 ? '+' : ''}${percentage}% adjustment to all values`);
  };

  // Export handler
  const handleExport = async () => {
    if (!selectedDivision) {
      message.warning('Please select a division first');
      return;
    }
    
    try {
      const params = { 
        division: selectedDivision, 
        types: 'Actual,Estimate' // Export both Actual and Estimate
      };
      if (selectedYear) params.year = selectedYear;
      if (globalSearch.trim()) params.search = globalSearch.trim();
      
      const queryString = new URLSearchParams(params).toString();
      window.open(`http://localhost:3001/api/aebf/export?${queryString}`, '_blank');
      
      message.success('Export started');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Export failed');
    }
  };

  // Table columns
  const columns = [
    { title: 'Year', dataIndex: 'year', key: 'year', width: 65, sorter: (a, b) => a.year - b.year },
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 80,
      sorter: (a, b) => a.month - b.month,
      render: (month) => <Tag color="cyan">{month} Estimate</Tag>
    },
    { title: 'Sales Rep', dataIndex: 'salesrepname', key: 'salesrepname', ellipsis: true },
    { title: 'Customer', dataIndex: 'customername', key: 'customername', ellipsis: true },
    { title: 'Country', dataIndex: 'countryname', key: 'countryname', width: 100, ellipsis: true },
    { title: 'Product Group', dataIndex: 'productgroup', key: 'productgroup', ellipsis: true },
    { title: 'Material', dataIndex: 'material', key: 'material', width: 85, ellipsis: true },
    { title: 'Process', dataIndex: 'process', key: 'process', width: 85, ellipsis: true },
    {
      title: 'Values Type',
      dataIndex: 'values_type',
      key: 'values_type',
      width: 100,
      render: (text) => {
        const color = text === 'AMOUNT' ? 'green' : text === 'KGS' ? 'blue' : 'orange';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Value',
      dataIndex: 'values',
      key: 'values',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.values - b.values,
      render: (value) => value ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'
    },
  ];

  // Effects
  useEffect(() => {
    if (selectedDivision) fetchAvailableYears();
  }, [selectedDivision]);

  useEffect(() => {
    if (selectedYear) {
      fetchYearSummary(selectedYear);
      fetchData();
    }
  }, [selectedYear]);

  const handleTableChange = (paginationConfig) => {
    fetchData(paginationConfig.current, paginationConfig.pageSize);
  };

  return (
    <div className="estimate-tab" style={{ padding: '0', width: '100%' }}>
      {/* Header */}
      <div className="tab-header" style={{ marginBottom: '16px', padding: '0 10px' }}>
        <h3>Estimate Sales Data - {selectedDivision || 'No Division Selected'}</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Create sales estimates based on actual data averages. Review and approve before saving.
        </p>
      </div>

      {/* Year Tabs */}
      {availableYears.length > 0 && (
        <Tabs
          activeKey={selectedYear?.toString()}
          onChange={handleYearChange}
          style={{ marginBottom: '16px', padding: '0 10px' }}
          items={availableYears.map(year => ({
            key: year.toString(),
            label: `${year} FY Estimate`
          }))}
        />
      )}

      {/* Summary Cards */}
      {yearSummary && yearSummary.length > 0 && (
        <Row gutter={16} style={{ marginBottom: '20px', padding: '0 10px' }}>
          {yearSummary.map((item) => (
            <Col span={8} key={item.values_type}>
              <Card>
                <Statistic
                  title={item.values_type}
                  value={Math.round(item.total_values)}
                  precision={0}
                  valueStyle={{ color: '#3f8600' }}
                  suffix={
                    <span style={{ fontSize: '14px', color: '#999' }}>
                      ({item.record_count.toLocaleString()} records)
                    </span>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Action Bar */}
      <Space style={{ marginBottom: '16px', padding: '0 10px', width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button 
            icon={<CalculatorOutlined />} 
            type="primary"
            onClick={openEstimateModal}
            disabled={!selectedDivision}
          >
            Create Estimate
          </Button>
          
          <Button icon={<DownloadOutlined />} onClick={handleExport} disabled={!selectedDivision}>
            Export Excel
          </Button>
          
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()} disabled={!selectedDivision}>
            Refresh
          </Button>
        </Space>

        <Search
          placeholder="Search (customer, country, product, sales rep...)"
          allowClear
          enterButton="Search"
          style={{ width: 400 }}
          onSearch={handleSearch}
          onChange={handleSearchChange}
          value={globalSearch}
        />
      </Space>

      {/* Data Table */}
      <div style={{ width: '100%', overflowX: 'auto', padding: '0 10px' }}>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total.toLocaleString()} (records)`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          onChange={handleTableChange}
          scroll={{ y: 500 }}
          size="small"
          bordered
        />
      </div>

      {/* Create Estimate Modal */}
      <Modal
        title={
          <Space>
            <CalculatorOutlined style={{ color: '#1890ff' }} />
            <span>{estimateStep === 1 ? 'Select Months to Estimate' : 'Review & Approve Estimates'}</span>
          </Space>
        }
        open={estimateModalVisible}
        onCancel={() => setEstimateModalVisible(false)}
        width={estimateStep === 1 ? 600 : 800}
        footer={
          estimateStep === 1 ? [
            <Button key="cancel" onClick={() => setEstimateModalVisible(false)}>Cancel</Button>,
            <Button 
              key="calculate" 
              type="primary" 
              loading={calculating}
              onClick={handleCalculateEstimate}
              disabled={selectedMonths.length === 0}
            >
              Calculate Estimate ({selectedMonths.length} months)
            </Button>
          ] : [
            <Button key="back" onClick={() => setEstimateStep(1)}>Back</Button>,
            <Button key="cancel" onClick={() => setEstimateModalVisible(false)}>Cancel</Button>,
            <Button 
              key="approve" 
              type="primary" 
              loading={approving}
              onClick={handleApproveEstimates}
              icon={<CheckCircleOutlined />}
            >
              Approve & Save
            </Button>
          ]
        }
      >
        {estimateStep === 1 ? (
          /* Step 1: Month Selection */
          <Spin spinning={calculating} tip="Calculating estimates...">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <p><strong>Year:</strong> {estimateYear} (Base Period Year)</p>
                <p><strong>Division:</strong> {selectedDivision}</p>
                <p style={{ color: '#666', fontSize: '12px' }}>
                  Estimates will be calculated based on average of Actual data months NOT selected
                </p>
              </div>

              {/* Existing Estimates Warning */}
              {existingEstimateCount > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  icon={<WarningOutlined />}
                  message={`${existingEstimateCount.toLocaleString()} existing estimate records found for ${estimateYear}`}
                  description="These will be automatically cleared when you click 'Calculate Estimates'. You'll be asked to confirm before proceeding."
                  style={{ marginBottom: '8px' }}
                />
              )}

              <div>
                <p><strong>Select Months to Estimate:</strong></p>
                <p style={{ color: '#999', fontSize: '12px', marginBottom: '12px' }}>
                  Available Actual months: {availableMonths.map(m => monthNames[m - 1]).join(', ')}
                </p>
                
                <Row gutter={[12, 12]}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                    <Col span={6} key={month}>
                      <Checkbox
                        checked={selectedMonths.includes(month)}
                        onChange={() => handleMonthToggle(month)}
                      >
                        {monthNames[month - 1]}
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
              </div>

              {selectedMonths.length > 0 && (
                <div style={{ padding: '12px', backgroundColor: '#e6f7ff', borderLeft: '3px solid #1890ff' }}>
                  <p><strong>Calculation Preview:</strong></p>
                  <p style={{ fontSize: '12px', margin: 0 }}>
                    Base months (for averaging): {availableMonths.filter(m => !selectedMonths.includes(m)).map(m => monthNames[m - 1]).join(', ') || 'None'}
                  </p>
                  <p style={{ fontSize: '12px', margin: 0 }}>
                    Estimate months: {selectedMonths.map(m => monthNames[m - 1]).join(', ')}
                  </p>
                </div>
              )}
            </Space>
          </Spin>
        ) : (
          /* Step 2: Review & Approve */
          <Spin spinning={approving} tip="Saving estimates...">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <p><strong>Year:</strong> {estimateYear}</p>
                <p style={{ color: '#666', fontSize: '12px' }}>
                  Review and adjust calculated estimates. Click on values to edit.
                </p>
              </div>

              {/* Percentage Adjustment Controls */}
              <div style={{ 
                padding: '12px', 
                backgroundColor: '#f5f5f5', 
                borderRadius: '6px',
                border: '1px solid #d9d9d9'
              }}>
                <Space wrap>
                  <span style={{ fontWeight: 500 }}>
                    <PercentageOutlined /> Adjust All Values:
                  </span>
                  <Tooltip title="Decrease by 10%">
                    <Button size="small" onClick={() => applyPercentageAdjustment(-10)} icon={<MinusOutlined />}>
                      10%
                    </Button>
                  </Tooltip>
                  <Tooltip title="Decrease by 5%">
                    <Button size="small" onClick={() => applyPercentageAdjustment(-5)} icon={<MinusOutlined />}>
                      5%
                    </Button>
                  </Tooltip>
                  <Tooltip title="Increase by 5%">
                    <Button size="small" onClick={() => applyPercentageAdjustment(5)} icon={<PlusOutlined />}>
                      5%
                    </Button>
                  </Tooltip>
                  <Tooltip title="Increase by 10%">
                    <Button size="small" onClick={() => applyPercentageAdjustment(10)} icon={<PlusOutlined />}>
                      10%
                    </Button>
                  </Tooltip>
                  <span style={{ borderLeft: '1px solid #d9d9d9', paddingLeft: 8 }}>
                    Custom:
                  </span>
                  <InputNumber
                    size="small"
                    placeholder="%"
                    style={{ width: 70 }}
                    addonAfter="%"
                    onPressEnter={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) applyPercentageAdjustment(val);
                    }}
                  />
                  <Button 
                    size="small" 
                    type="primary"
                    onClick={() => {
                      // Reset to original calculated values
                      const reset = {};
                      calculatedEstimates.forEach(est => {
                        reset[est.month] = {
                          amount: est.amount,
                          kgs: est.kgs,
                          morm: est.morm
                        };
                      });
                      setEditableEstimates(reset);
                      message.info('Reset to original calculated values');
                    }}
                  >
                    Reset
                  </Button>
                </Space>
              </div>

              <Table
                dataSource={calculatedEstimates}
                columns={[
                  {
                    title: 'Month',
                    dataIndex: 'month',
                    key: 'month',
                    render: (month) => monthNames[month - 1]
                  },
                  {
                    title: 'AMOUNT',
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (value, record) => (
                      <Input
                        type="number"
                        step="1"
                        value={Math.round(editableEstimates[record.month]?.amount || value)}
                        onChange={(e) => {
                          setEditableEstimates({
                            ...editableEstimates,
                            [record.month]: {
                              ...editableEstimates[record.month],
                              amount: Math.round(parseFloat(e.target.value) || 0)
                            }
                          });
                        }}
                        style={{ width: '100%' }}
                      />
                    )
                  },
                  {
                    title: 'KGS',
                    dataIndex: 'kgs',
                    key: 'kgs',
                    render: (value, record) => (
                      <Input
                        type="number"
                        step="1"
                        value={Math.round(editableEstimates[record.month]?.kgs || value)}
                        onChange={(e) => {
                          setEditableEstimates({
                            ...editableEstimates,
                            [record.month]: {
                              ...editableEstimates[record.month],
                              kgs: Math.round(parseFloat(e.target.value) || 0)
                            }
                          });
                        }}
                        style={{ width: '100%' }}
                      />
                    )
                  },
                  {
                    title: 'MORM',
                    dataIndex: 'morm',
                    key: 'morm',
                    render: (value, record) => (
                      <Input
                        type="number"
                        step="1"
                        value={Math.round(editableEstimates[record.month]?.morm || value)}
                        onChange={(e) => {
                          setEditableEstimates({
                            ...editableEstimates,
                            [record.month]: {
                              ...editableEstimates[record.month],
                              morm: Math.round(parseFloat(e.target.value) || 0)
                            }
                          });
                        }}
                        style={{ width: '100%' }}
                      />
                    )
                  }
                ]}
                pagination={false}
                size="small"
                rowKey="month"
              />
            </Space>
          </Spin>
        )}
      </Modal>

      {/* Confirmation Modal for Replace */}
      <Modal
        title="Replace Existing Estimates"
        open={confirmReplaceVisible}
        onCancel={() => setConfirmReplaceVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setConfirmReplaceVisible(false)}>
            Cancel
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirmReplace}>
            Yes, Replace
          </Button>
        ]}
      >
        <Alert
          type="warning"
          showIcon
          message={`${existingEstimateCount.toLocaleString()} existing estimate records will be deleted`}
          description={`Do you want to clear all existing estimates for ${estimateYear} and calculate new ones?`}
        />
      </Modal>
    </div>
  );
};

export default EstimateTab;
