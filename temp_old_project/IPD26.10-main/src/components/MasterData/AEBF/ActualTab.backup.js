import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Upload, Select, Radio, Modal, Spin, Tag, Statistic, Row, Col, Card, Tabs, Input } from 'antd';
import { UploadOutlined, DownloadOutlined, ReloadOutlined, FileExcelOutlined, WarningOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useExcelData } from '../../../contexts/ExcelDataContext';
import { useFilter } from '../../../contexts/FilterContext';
import axios from 'axios';

const { Option } = Select;
const { Search } = Input;

/**
 * ActualTab Component
 * Manages actual financial performance data with Excel upload
 * Step 6: Frontend ActualTab Updates
 */
const ActualTab = () => {
  const { selectedDivision } = useExcelData();
  const { basePeriodIndex, columnOrder } = useFilter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState('year');
  const [sortOrder, setSortOrder] = useState('desc');
  
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
  
  // Result modal state
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  // Summary stats
  const [summary, setSummary] = useState(null);
  
  // Search text for filtering
  const [searchText, setSearchText] = useState('');
  const [searchedColumn, setSearchedColumn] = useState('');

  // Get unique values for column filters (now from filterOptions state)
  const getUniqueValues = (dataIndex) => {
    return filterOptions[dataIndex] || [];
  };
  
  // Fetch filter options (all unique values from database)
  const fetchFilterOptions = async () => {
    if (!selectedDivision) return;
    
    try {
      const response = await axios.get('http://localhost:3001/api/aebf/filter-options', {
        params: { division: selectedDivision, type: 'Actual' }
      });
      
      if (response.data.success) {
        setFilterOptions(response.data.filterOptions);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  // Table columns definition - compact for no horizontal scroll with built-in filters
  const columns = [
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 60,
      filters: getUniqueValues('year').map(value => ({ text: value, value })),
      onFilter: (value, record) => record.year === value,
    },
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 60,
      filters: getUniqueValues('month').map(value => ({ text: value, value })),
      onFilter: (value, record) => record.month === value,
    },
    {
      title: 'Sales Rep',
      dataIndex: 'salesrepname',
      key: 'salesrepname',
      ellipsis: true,
      filters: getUniqueValues('salesrepname').map(value => ({ text: value, value })),
      onFilter: (value, record) => record.salesrepname === value,
      filterSearch: true,
    },
    {
      title: 'Customer',
      dataIndex: 'customername',
      key: 'customername',
      ellipsis: true,
      filters: getUniqueValues('customername').map(value => ({ text: value, value })),
      onFilter: (value, record) => record.customername === value,
      filterSearch: true,
    },
    {
      title: 'Country',
      dataIndex: 'countryname',
      key: 'countryname',
      width: 100,
      ellipsis: true,
      filters: getUniqueValues('countryname').map(value => ({ text: value, value })),
      onFilter: (value, record) => record.countryname === value,
      filterSearch: true,
    },
    {
      title: 'Product Group',
      dataIndex: 'productgroup',
      key: 'productgroup',
      ellipsis: true,
      filters: getUniqueValues('productgroup').map(value => ({ text: value, value })),
      onFilter: (value, record) => record.productgroup === value,
      filterSearch: true,
    },
    {
      title: 'Material',
      dataIndex: 'material',
      key: 'material',
      width: 80,
      ellipsis: true,
      filters: getUniqueValues('material').map(value => ({ text: value, value })),
      onFilter: (value, record) => record.material === value,
      filterSearch: true,
    },
    {
      title: 'Process',
      dataIndex: 'process',
      key: 'process',
      width: 80,
      ellipsis: true,
      filters: getUniqueValues('process').map(value => ({ text: value, value })),
      onFilter: (value, record) => record.process === value,
      filterSearch: true,
    },
    {
      title: 'Values Type',
      dataIndex: 'values_type',
      key: 'values_type',
      width: 90,
      filters: [
        { text: 'AMOUNT', value: 'AMOUNT' },
        { text: 'KGS', value: 'KGS' },
        { text: 'MORM', value: 'MORM' },
      ],
      onFilter: (value, record) => record.values_type === value,
      render: (text) => (
        <Tag color={text === 'AMOUNT' ? 'green' : text === 'KGS' ? 'blue' : 'orange'}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'values',
      key: 'values',
      width: 110,
      align: 'right',
      render: (value) => (
        <span style={{ color: value < 0 ? 'red' : 'inherit' }}>
          {value ? value.toLocaleString('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
          }) : '-'}
        </span>
      ),
    },
  ];

  // Fetch actual data from API
  const fetchData = async (page = 1, pageSize = 50) => {
    if (!selectedDivision) {
      message.warning('Please select a division first');
      return;
    }
    
    setLoading(true);
    try {
      const params = {
        division: selectedDivision,
        page,
        pageSize,
        sortBy,
        sortOrder,
        ...filters
      };
      
      const response = await axios.get('http://localhost:3001/api/aebf/actual', { params });
      
      if (response.data.success) {
        setData(response.data.data.map(item => ({ ...item, key: item.id })));
        setPagination({
          current: response.data.pagination.page,
          pageSize: response.data.pagination.pageSize,
          total: response.data.pagination.total,
        });
        message.success(`Loaded ${response.data.data.length} records`);
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
  
  // Fetch summary statistics
  const fetchSummary = async () => {
    if (!selectedDivision) return;
    
    try {
      const response = await axios.get('http://localhost:3001/api/aebf/summary', {
        params: { division: selectedDivision, type: 'Actual' }
      });
      
      if (response.data.success) {
        setSummary(response.data.summary);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  useEffect(() => {
    if (selectedDivision) {
      fetchFilterOptions(); // Fetch filter options first
      fetchData();
      fetchSummary();
    }
  }, [selectedDivision, filters, sortBy, sortOrder]);
  
  // Handle table change (pagination, sorting)
  const handleTableChange = (paginationConfig, filtersConfig, sorterConfig) => {
    if (sorterConfig.field) {
      setSortBy(sorterConfig.field);
      setSortOrder(sorterConfig.order === 'ascend' ? 'asc' : 'desc');
    }
    fetchData(paginationConfig.current, paginationConfig.pageSize);
  };

  // Handle file selection
  const handleFileSelect = (file) => {
    // Validate file type
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (!isExcel) {
      message.error('Please upload an Excel file (.xlsx or .xls)');
      return false;
    }
    
    setSelectedFile(file);
    setUploadModalVisible(true);
    return false; // Prevent auto upload
  };
  
  // Handle Transform & Load
  const handleTransformLoad = async () => {
    console.log('🔵 Transform & Load clicked!', {
      selectedFile,
      uploadedBy,
      selectedDivision,
      uploadMode
    });
    
    if (!selectedFile) {
      message.error('Please select a file');
      return;
    }
    
    if (!uploadedBy.trim()) {
      message.error('Please enter your name');
      return;
    }
    
    if (!selectedDivision) {
      message.error('Please select a division');
      return;
    }
    
    console.log('✅ Validation passed, starting upload...');
    setUploading(true);
    
    try {
      // Call PowerShell script via backend API
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('division', selectedDivision);
      formData.append('uploadMode', uploadMode);
      formData.append('uploadedBy', uploadedBy);
      
      console.log('📤 Sending upload request to backend...');
      
      const response = await axios.post('http://localhost:3001/api/aebf/upload-actual', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300000, // 5 minutes timeout
      });
      
      console.log('📥 Received response:', response.data);
      
      if (response.data.success) {
        console.log('✅ Upload successful!');
        setUploadResult(response.data);
        setUploadModalVisible(false);
        setResultModalVisible(true);
        fetchFilterOptions(); // Refresh filter options after upload
        fetchData();
        fetchSummary();
      } else {
        console.error('❌ Upload failed:', response.data.error);
        message.error(response.data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      message.error(error.response?.data?.error || 'Upload failed. Please check the logs.');
    } finally {
      console.log('🔄 Upload process finished, setting uploading=false');
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
        sortBy,
        sortOrder,
        ...filters
      };
      
      // Open export URL in new window
      const queryString = new URLSearchParams(params).toString();
      window.open(`http://localhost:3001/api/aebf/export?${queryString}`, '_blank');
      
      message.success('Export started. File will download shortly.');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Export failed');
    }
  };

  return (
    <div className="actual-tab" style={{ padding: '0', width: '100%' }}>
      <div className="tab-header" style={{ marginBottom: '20px', padding: '0 10px' }}>
        <h3>Actual Financial Data - {selectedDivision || 'No Division Selected'}</h3>
        <p style={{ color: '#666' }}>
          View and manage actual financial performance data. Upload Excel files to update records.
        </p>
      </div>

      {/* Summary Statistics */}
      {summary && summary.length > 0 && (
        <Row gutter={16} style={{ marginBottom: '20px', padding: '0 10px' }}>
          {summary.slice(0, 3).map((item) => (
            <Col span={8} key={item.values_type}>
              <Card>
                <Statistic
                  title={`${item.values_type} (${item.type})`}
                  value={item.total_values}
                  precision={2}
                  valueStyle={{ color: item.total_values < 0 ? '#cf1322' : '#3f8600' }}
                  suffix={`(${item.record_count} records)`}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Space style={{ marginBottom: '16px', padding: '0 10px' }}>
        <Upload
          accept=".xlsx,.xls"
          showUploadList={false}
          beforeUpload={handleFileSelect}
        >
          <Button icon={<UploadOutlined />} type="primary" disabled={!selectedDivision}>
            Upload Excel
          </Button>
        </Upload>
        
        <Button 
          icon={<DownloadOutlined />} 
          onClick={handleExport}
          disabled={!selectedDivision}
        >
          Export
        </Button>
        
        <Button 
          icon={<ReloadOutlined />} 
          onClick={() => fetchData()}
          disabled={!selectedDivision}
        >
          Refresh
        </Button>
      </Space>

      <div style={{ width: '100%', overflowX: 'auto' }}>
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
          style={{ width: '100%', minWidth: '100%' }}
        />
      </div>

      {/* Upload Modal */}
      <Modal
        title={
          <Space>
            <FileExcelOutlined style={{ color: '#1890ff' }} />
            <span>Transform & Load Excel to Database</span>
          </Space>
        }
        visible={uploadModalVisible}
        onOk={handleTransformLoad}
        onCancel={() => {
          setUploadModalVisible(false);
          setSelectedFile(null);
        }}
        okText="Transform & Load"
        cancelText="Cancel"
        confirmLoading={uploading}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <p><strong>Selected File:</strong> {selectedFile?.name}</p>
            <p><strong>Division:</strong> {selectedDivision}</p>
          </div>

          <div>
            <p><strong>Upload Mode:</strong></p>
            <Radio.Group value={uploadMode} onChange={(e) => setUploadMode(e.target.value)}>
              <Space direction="vertical">
                <Radio value="upsert">
                  <strong>UPSERT</strong> - Update existing records, insert new ones (Recommended)
                </Radio>
                <Radio value="replace">
                  <strong>REPLACE</strong> - Delete existing data and insert fresh (⚠️ Creates backup first)
                </Radio>
              </Space>
            </Radio.Group>
          </div>

          {uploadMode === 'replace' && (
            <div style={{ padding: '10px', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: '4px' }}>
              <Space>
                <WarningOutlined style={{ color: '#fa8c16' }} />
                <span>
                  <strong>Warning:</strong> REPLACE mode will delete all Actual data for {selectedDivision} 
                  matching the years/months in your Excel file, then insert fresh data. 
                  A backup will be created first.
                </span>
              </Space>
            </div>
          )}

          <div>
            <p><strong>Uploaded By:</strong></p>
            <input
              type="text"
              placeholder="Enter your name (e.g., john.doe)"
              value={uploadedBy}
              onChange={(e) => setUploadedBy(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
              }}
            />
          </div>

          {uploading && (
            <div style={{ textAlign: 'center' }}>
              <Spin size="large" />
              <p style={{ marginTop: '10px', color: '#1890ff' }}>
                Transforming and uploading data... This may take a few minutes.
              </p>
            </div>
          )}
        </Space>
      </Modal>

      {/* Result Modal */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>Upload Completed Successfully</span>
          </Space>
        }
        visible={resultModalVisible}
        onOk={() => setResultModalVisible(false)}
        onCancel={() => setResultModalVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setResultModalVisible(false)}>
            OK
          </Button>
        ]}
        width={700}
      >
        {uploadResult && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <p><strong>Records Processed:</strong> {uploadResult.recordsAffected}</p>
              <p><strong>Mode:</strong> {uploadResult.uploadMode}</p>
              <p><strong>Division:</strong> {uploadResult.division}</p>
            </div>

            {uploadResult.qcSummary && (
              <div>
                <p><strong>QC Summary:</strong></p>
                <ul>
                  <li>Years: {uploadResult.qcSummary.years?.join(', ')}</li>
                  <li>Months: {uploadResult.qcSummary.months?.join(', ')}</li>
                  <li>Total AMOUNT: {uploadResult.qcSummary.totalAmount?.toLocaleString()}</li>
                  <li>Total KGS: {uploadResult.qcSummary.totalKGS?.toLocaleString()}</li>
                </ul>
              </div>
            )}

            {uploadResult.logFile && (
              <div>
                <p><strong>Log File:</strong> {uploadResult.logFile}</p>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default ActualTab;
