import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Upload, Select, Radio, Modal, Spin, Tag, Statistic, Row, Col, Card, Tabs, Input } from 'antd';
import { UploadOutlined, DownloadOutlined, ReloadOutlined, FileExcelOutlined, WarningOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useExcelData } from '../../../contexts/ExcelDataContext';
import { useFilter } from '../../../contexts/FilterContext';
import axios from 'axios';

const { Option } = Select;
const { Search } = Input;

/**
 * ActualTab Component - Enhanced Version
 * Manages actual financial performance data with Excel upload
 * Features:
 * - Year tabs with base period pre-selection
 * - Year-specific summaries (AMOUNT, KGS, MORM)
 * - Global search across all fields
 * - Auto-width columns (no horizontal scroll)
 */
const ActualTab = () => {
  const { selectedDivision } = useExcelData();
  const { basePeriodIndex, columnOrder } = useFilter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  
  // All unique values for filters (from entire database, not just current page)
  const [filterOptions, setFilterOptions] = useState({});
  
  // Year tabs and summary
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [yearSummary, setYearSummary] = useState(null);
  
  // Global search
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Upload modal state
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploadMode, setUploadMode] = useState('upsert');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedBy, setUploadedBy] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // File preview and selection state
  const [uploadStep, setUploadStep] = useState(1); // 1: basic info, 2: year/month selection
  const [fileYearMonths, setFileYearMonths] = useState([]); // [{year, month, count}]
  const [selectedYearMonths, setSelectedYearMonths] = useState([]); // ['2025-1', '2025-2']
  const [selectiveMode, setSelectiveMode] = useState('all'); // 'all' or 'selective'
  const [analyzingFile, setAnalyzingFile] = useState(false);
  
  // Result modal state
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Fetch available years
  const fetchAvailableYears = async () => {
    if (!selectedDivision) return;
    
    try {
      const response = await axios.get('http://localhost:3001/api/aebf/filter-options', {
        params: { division: selectedDivision, type: 'Actual' }
      });
      
      if (response.data.success) {
        const years = response.data.filterOptions.year || [];
        setAvailableYears(years.sort((a, b) => b - a)); // Descending
        
        // Store all filter options for column filters
        setFilterOptions(response.data.filterOptions);
        
        // Set default year based on base period
        if (years.length > 0 && !selectedYear) {
          let defaultYear = years[0]; // Latest year by default
          
          // Try to get year from base period
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

  // Fetch year-specific summary (with optional search filter)
  const fetchYearSummary = async (year, searchFilter = '') => {
    if (!selectedDivision) return;
    
    try {
      const params = { 
        division: selectedDivision, 
        type: 'Actual'
      };
      
      if (searchFilter && searchFilter.trim()) {
        // When searching, get summary for ALL years
        params.search = searchFilter.trim();
      } else {
        // Only filter by year when NOT searching
        if (year) {
          params.year = year;
        }
      }
      
      const response = await axios.get('http://localhost:3001/api/aebf/year-summary', { params });
      
      if (response.data.success) {
        setYearSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error fetching year summary:', error);
    }
  };

  // Fetch data with year and search filters
  const fetchData = async (page = 1, pageSize = 50, searchFilter = null) => {
    if (!selectedDivision) {
      message.warning('Please select a division first');
      return;
    }
    
    setLoading(true);
    try {
      const params = {
        division: selectedDivision,
        type: 'Actual',
        page,
        pageSize,
        sortBy: 'year',
        sortOrder: 'desc',
      };
      
      // Add global search (use parameter if provided, otherwise use state)
      const search = searchFilter !== null ? searchFilter : globalSearch;
      if (search && search.trim()) {
        params.search = search.trim();
        // When searching, search ALL years (don't filter by selectedYear)
      } else {
        // Only filter by year when NOT searching
        if (selectedYear) {
          params.year = selectedYear;
        }
      }
      
      const response = await axios.get('http://localhost:3001/api/aebf/actual', { params });
      
      if (response.data.success) {
        setData(response.data.data.map(item => ({ ...item, key: item.id })));
        setPagination({
          current: response.data.pagination.page,
          pageSize: response.data.pagination.pageSize,
          total: response.data.pagination.total,
        });
      } else {
        message.error('Failed to load data');
      }
    } catch (error) {
      console.error('Error fetching actual data:', error);
      message.error('Failed to load actual data. Please check if server is running.');
    } finally {
      setLoading(false);
    }
  };

  // Handle year tab change
  const handleYearChange = (year) => {
    setSelectedYear(parseInt(year));
    setGlobalSearch(''); // Clear search when changing year
  };

  // Handle global search
  const handleSearch = (value) => {
    console.log('Search triggered:', value);
    setGlobalSearch(value);
    setPagination({ ...pagination, current: 1 }); // Reset to first page
    
    // Update summary with search filter
    if (selectedYear) {
      fetchYearSummary(selectedYear, value);
    }
    
    // Fetch data with search filter (pass value directly)
    fetchData(1, pagination.pageSize, value);
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setGlobalSearch(value);
    
    // If user clears the search box, trigger search immediately
    if (value === '') {
      if (selectedYear) {
        fetchYearSummary(selectedYear, '');
      }
      fetchData(1, pagination.pageSize, '');
    }
  };

  // Handle file selection
  const handleFileSelect = (file) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!isExcel) {
      message.error('Please upload an Excel file (.xlsx or .xls)');
      return false;
    }
    
    setSelectedFile(file);
    setUploadStep(1);
    setFileYearMonths([]);
    setSelectedYearMonths([]);
    setSelectiveMode('all');
    setUploadModalVisible(true);
    return false; // Prevent auto upload
  };
  
  // Analyze file to get year/month combinations
  const analyzeFile = async () => {
    if (!selectedFile) return;
    
    setAnalyzingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      const response = await axios.post('http://localhost:3001/api/aebf/analyze-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      
      if (response.data.success) {
        setFileYearMonths(response.data.yearMonths);
        // Pre-select all by default
        const allKeys = response.data.yearMonths.map(ym => `${ym.year}-${ym.month}`);
        setSelectedYearMonths(allKeys);
        setUploadStep(2);
      } else {
        message.error('Failed to analyze file');
      }
    } catch (error) {
      console.error('Error analyzing file:', error);
      message.error('Failed to analyze file structure');
    } finally {
      setAnalyzingFile(false);
    }
  };
  
  // Handle year/month selection
  const handleYearMonthToggle = (yearMonth) => {
    if (selectedYearMonths.includes(yearMonth)) {
      setSelectedYearMonths(selectedYearMonths.filter(ym => ym !== yearMonth));
    } else {
      setSelectedYearMonths([...selectedYearMonths, yearMonth]);
    }
  };
  
  // Select/Deselect all year/months
  const handleSelectAll = () => {
    const allKeys = fileYearMonths.map(ym => `${ym.year}-${ym.month}`);
    setSelectedYearMonths(allKeys);
  };
  
  const handleDeselectAll = () => {
    setSelectedYearMonths([]);
  };
  
  // Go to next step (analyze file)
  const handleNextStep = () => {
    if (selectiveMode === 'selective') {
      analyzeFile();
    } else {
      // All mode, go straight to upload
      handleTransformLoad();
    }
  };
  
  // Handle Transform & Load
  const handleTransformLoad = async () => {
    if (!selectedFile || !uploadedBy.trim() || !selectedDivision) {
      message.error('Please fill all required fields');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('division', selectedDivision);
      formData.append('uploadMode', uploadMode);
      formData.append('uploadedBy', uploadedBy);
      
      // Add selective year/month filter if in selective mode
      if (selectiveMode === 'selective' && selectedYearMonths.length > 0) {
        formData.append('selectiveMode', 'true');
        formData.append('selectedYearMonths', JSON.stringify(selectedYearMonths));
      }
      
      const response = await axios.post('http://localhost:3001/api/aebf/upload-actual', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 minutes
      });
      
      if (response.data.success) {
        setUploadResult(response.data);
        setUploadModalVisible(false);
        setResultModalVisible(true);
        fetchAvailableYears();
        fetchData();
        if (selectedYear) {
          fetchYearSummary(selectedYear);
        }
      } else {
        message.error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error(error.response?.data?.error || 'Upload failed. Please check the logs.');
    } finally {
      setUploading(false);
    }
  };

  // Handle Excel export
  const handleExport = async () => {
    if (!selectedDivision) {
      message.warning('Please select a division first');
      return;
    }
    
    try {
      const params = {
        division: selectedDivision,
        type: 'Actual',
      };
      
      if (selectedYear) {
        params.year = selectedYear;
      }
      
      if (globalSearch.trim()) {
        params.search = globalSearch.trim();
      }
      
      const queryString = new URLSearchParams(params).toString();
      window.open(`http://localhost:3001/api/aebf/export?${queryString}`, '_blank');
      
      message.success('Export started. File will download shortly.');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Export failed');
    }
  };

  // Get unique values for column filters (from filterOptions state)
  const getUniqueValues = (dataIndex) => {
    return filterOptions[dataIndex] || [];
  };

  // Optimized columns with content-based widths and header filters
  const columns = [
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 65,
      sorter: (a, b) => a.year - b.year,
    },
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 65,
      sorter: (a, b) => a.month - b.month,
    },
    {
      title: 'Sales Rep',
      dataIndex: 'salesrepname',
      key: 'salesrepname',
      ellipsis: true,
    },
    {
      title: 'Customer',
      dataIndex: 'customername',
      key: 'customername',
      ellipsis: true,
    },
    {
      title: 'Country',
      dataIndex: 'countryname',
      key: 'countryname',
      width: 100,
      ellipsis: true,
    },
    {
      title: 'Product Group',
      dataIndex: 'productgroup',
      key: 'productgroup',
      ellipsis: true,
    },
    {
      title: 'Material',
      dataIndex: 'material',
      key: 'material',
      width: 85,
      ellipsis: true,
    },
    {
      title: 'Process',
      dataIndex: 'process',
      key: 'process',
      width: 85,
      ellipsis: true,
    },
    {
      title: 'Values Type',
      dataIndex: 'values_type',
      key: 'values_type',
      width: 100,
      render: (text) => {
        const color = text === 'AMOUNT' ? 'green' : text === 'KGS' ? 'blue' : 'orange';
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: 'Value',
      dataIndex: 'values',
      key: 'values',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.values - b.values,
      render: (value) => value ? value.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }) : '-',
    },
  ];

  // Effects
  useEffect(() => {
    if (selectedDivision) {
      fetchAvailableYears();
    }
  }, [selectedDivision]);

  useEffect(() => {
    if (selectedYear) {
      fetchYearSummary(selectedYear, globalSearch);
      fetchData();
    }
  }, [selectedYear]);

  useEffect(() => {
    if (selectedDivision && !selectedYear) {
      // Initial load when no year is selected yet
      fetchData(pagination.current, pagination.pageSize);
    }
  }, [selectedDivision]);

  const handleTableChange = (paginationConfig) => {
    fetchData(paginationConfig.current, paginationConfig.pageSize);
  };

  return (
    <div className="actual-tab" style={{ padding: '0', width: '100%' }}>
      {/* Header */}
      <div className="tab-header" style={{ marginBottom: '16px', padding: '0 10px' }}>
        <h3>Actual Sales Data - {selectedDivision || 'No Division Selected'}</h3>
        <p style={{ color: '#666', fontSize: '14px' }}>
          View and manage actual sales performance data. Upload Excel files to update records.
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
            label: year.toString(),
          }))}
        />
      )}

      {/* Year Summary Cards */}
      {yearSummary && yearSummary.length > 0 && (
        <Row gutter={16} style={{ marginBottom: '16px', padding: '0 10px' }}>
          {yearSummary.map((item) => (
            <Col span={8} key={item.values_type}>
              <Card size="small">
                <Statistic
                  title={item.values_type}
                  value={item.total_values}
                  precision={0}
                  valueStyle={{ color: '#3f8600', fontSize: '20px' }}
                  suffix={<span style={{ fontSize: '12px', color: '#666' }}>({item.record_count} records)</span>}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Action Bar */}
      <Space style={{ marginBottom: '16px', padding: '0 10px', width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            beforeUpload={handleFileSelect}
          >
            <Button icon={<UploadOutlined />} type="primary">
              Upload Excel
            </Button>
          </Upload>
          
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Export Excel
          </Button>
          
          <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>
            Refresh
          </Button>
        </Space>

        {/* Global Search */}
        <Search
          placeholder="Search anything (customer, country, product, sales rep...)"
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
            showTotal: (total) => `Total ${total} records`,
            pageSizeOptions: ['20', '50', '100', '200'],
          }}
          onChange={handleTableChange}
          scroll={{ y: 500 }}
          size="small"
          bordered
        />
      </div>

      {/* Upload Modal - Two Steps */}
      <Modal
        title={
          <Space>
            <FileExcelOutlined style={{ color: '#1890ff' }} />
            <span>{uploadStep === 1 ? 'Upload Configuration' : 'Select Years & Months'}</span>
          </Space>
        }
        open={uploadModalVisible}
        onOk={uploadStep === 1 ? handleNextStep : handleTransformLoad}
        onCancel={() => {
          setUploadModalVisible(false);
          setSelectedFile(null);
          setUploadedBy('');
          setUploadStep(1);
          setFileYearMonths([]);
          setSelectedYearMonths([]);
          setSelectiveMode('all');
        }}
        okText={uploadStep === 1 ? 'Next' : 'Transform & Load'}
        cancelText={uploadStep === 1 ? 'Cancel' : 'Back'}
        onBack={uploadStep === 2 ? () => setUploadStep(1) : null}
        confirmLoading={uploading || analyzingFile}
        width={uploadStep === 1 ? 600 : 700}
        maskClosable={false}
        footer={uploadStep === 1 ? undefined : [
          <Button key="back" onClick={() => setUploadStep(1)}>
            Back
          </Button>,
          <Button key="cancel" onClick={() => {
            setUploadModalVisible(false);
            setSelectedFile(null);
            setUploadedBy('');
            setUploadStep(1);
          }}>
            Cancel
          </Button>,
          <Button 
            key="upload" 
            type="primary" 
            loading={uploading}
            onClick={handleTransformLoad}
            disabled={selectiveMode === 'selective' && selectedYearMonths.length === 0}
          >
            Transform & Load ({selectedYearMonths.length} periods)
          </Button>
        ]}
      >
        {uploadStep === 1 ? (
          // Step 1: Basic Configuration
          <Spin spinning={analyzingFile} tip="Analyzing file...">
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <p><strong>Selected File:</strong> {selectedFile?.name}</p>
                <p><strong>Division:</strong> {selectedDivision}</p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  <strong>Data Selection:</strong>
                </label>
                <Radio.Group value={selectiveMode} onChange={(e) => setSelectiveMode(e.target.value)}>
                  <Space direction="vertical">
                    <Radio value="all">
                      <strong>Upload All Data</strong> - Upload all years and months from the file
                    </Radio>
                    <Radio value="selective">
                      <strong>Select Specific Periods</strong> - Choose which years/months to upload
                      <Tag color="blue" style={{ marginLeft: '8px' }}>Recommended</Tag>
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  <strong>Upload Mode:</strong>
                </label>
                <Radio.Group value={uploadMode} onChange={(e) => setUploadMode(e.target.value)}>
                  <Space direction="vertical">
                    <Radio value="upsert">
                      <strong>UPSERT</strong> - Update overlapping periods, keep non-overlapping data
                    </Radio>
                    <Radio value="replace">
                      <strong>REPLACE</strong> - Delete ALL existing data and replace with new data
                      <Tag color="red" style={{ marginLeft: '8px' }}>Destructive</Tag>
                    </Radio>
                  </Space>
                </Radio.Group>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px' }}>
                  <strong>Uploaded By:</strong> <span style={{ color: 'red' }}>*</span>
                </label>
                <Input
                  placeholder="Enter your name"
                  value={uploadedBy}
                  onChange={(e) => setUploadedBy(e.target.value)}
                  maxLength={100}
                />
              </div>

              {uploadMode === 'replace' && (
                <div style={{ padding: '12px', backgroundColor: '#fff2e8', borderLeft: '3px solid #fa8c16' }}>
                  <Space>
                    <WarningOutlined style={{ color: '#fa8c16' }} />
                    <div>
                      <strong>Warning:</strong> REPLACE mode will delete ALL existing {selectedDivision} Actual data 
                      before uploading. A backup will be created automatically.
                    </div>
                  </Space>
                </div>
              )}
            </Space>
          </Spin>
        ) : (
          // Step 2: Year/Month Selection
          <Spin spinning={uploading} tip="Uploading and processing data...">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ marginBottom: '16px' }}>
                <p><strong>File contains the following periods:</strong></p>
                <p style={{ color: '#666', fontSize: '12px' }}>
                  Select which year/month combinations you want to upload
                </p>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <Space>
                  <Button size="small" onClick={handleSelectAll}>Select All</Button>
                  <Button size="small" onClick={handleDeselectAll}>Deselect All</Button>
                  <span style={{ marginLeft: '16px', color: '#666' }}>
                    {selectedYearMonths.length} of {fileYearMonths.length} periods selected
                  </span>
                </Space>
              </div>

              <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '12px' }}>
                <Row gutter={[8, 8]}>
                  {fileYearMonths.map((ym) => {
                    const key = `${ym.year}-${ym.month}`;
                    const isSelected = selectedYearMonths.includes(key);
                    return (
                      <Col span={8} key={key}>
                        <div
                          onClick={() => handleYearMonthToggle(key)}
                          style={{
                            padding: '8px 12px',
                            border: `2px solid ${isSelected ? '#1890ff' : '#d9d9d9'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                            transition: 'all 0.3s'
                          }}
                        >
                          <Space>
                            {isSelected ? <CheckCircleOutlined style={{ color: '#1890ff' }} /> : <div style={{ width: '14px' }} />}
                            <div>
                              <div style={{ fontWeight: 'bold' }}>
                                {new Date(ym.year, ym.month - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                              </div>
                              <div style={{ fontSize: '12px', color: '#666' }}>
                                {ym.count} records
                              </div>
                            </div>
                          </Space>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            </Space>
          </Spin>
        )}
      </Modal>

      {/* Result Modal */}
      <Modal
        title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /> Upload Successful</Space>}
        open={resultModalVisible}
        onOk={() => setResultModalVisible(false)}
        onCancel={() => setResultModalVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setResultModalVisible(false)}>
            OK
          </Button>
        ]}
      >
        {uploadResult && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <p><strong>Records Processed:</strong> {uploadResult.recordsProcessed}</p>
            <p><strong>Mode:</strong> {uploadResult.mode?.toUpperCase()}</p>
            <p><strong>Log File:</strong> {uploadResult.logFile}</p>
            {uploadResult.message && <p style={{ color: '#52c41a' }}>{uploadResult.message}</p>}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ActualTab;
