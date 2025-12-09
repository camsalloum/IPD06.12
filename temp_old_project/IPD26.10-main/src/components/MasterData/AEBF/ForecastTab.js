import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Upload } from 'antd';
import { UploadOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';

/**
 * ForecastTab Component
 * Manages forecast prediction data
 */
const ForecastTab = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const columns = [
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 80,
      sorter: (a, b) => a.year - b.year,
    },
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 80,
      sorter: (a, b) => a.month - b.month,
    },
    {
      title: 'Customer',
      dataIndex: 'customername',
      key: 'customername',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Country',
      dataIndex: 'countryname',
      key: 'countryname',
      width: 120,
    },
    {
      title: 'Product Group',
      dataIndex: 'productgroup',
      key: 'productgroup',
      width: 150,
    },
    {
      title: 'Material',
      dataIndex: 'material',
      key: 'material',
      width: 120,
    },
    {
      title: 'Values Type',
      dataIndex: 'values_type',
      key: 'values_type',
      width: 120,
    },
    {
      title: 'Value',
      dataIndex: 'values',
      key: 'values',
      width: 120,
      align: 'right',
      render: (value) => value ? value.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }) : '-',
    },
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/aebf/forecast');
      const result = await response.json();
      setData(result.data || []);
      message.success('Forecast data loaded successfully');
    } catch (error) {
      console.error('Error fetching forecast data:', error);
      message.error('Failed to load forecast data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImport = (info) => {
    if (info.file.status === 'done') {
      message.success(`${info.file.name} imported successfully`);
      fetchData();
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} import failed`);
    }
  };

  const handleExport = () => {
    message.info('Export functionality will be implemented');
  };

  return (
    <div className="forecast-tab" style={{ padding: '20px' }}>
      <div className="tab-header" style={{ marginBottom: '20px' }}>
        <h3>Forecast Sales Data</h3>
        <p style={{ color: '#666' }}>
          View and manage sales forecast predictions and projections
        </p>
      </div>

      <Space style={{ marginBottom: '16px' }}>
        <Upload
          accept=".xlsx,.xls"
          showUploadList={false}
          onChange={handleImport}
          customRequest={({ file, onSuccess }) => {
            setTimeout(() => onSuccess("ok"), 0);
          }}
        >
          <Button icon={<UploadOutlined />} type="primary">
            Import Excel
          </Button>
        </Upload>
        
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          Export Excel
        </Button>
        
        <Button icon={<ReloadOutlined />} onClick={fetchData}>
          Refresh
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} records`,
        }}
        scroll={{ x: 1200, y: 600 }}
        size="small"
        bordered
      />
    </div>
  );
};

export default ForecastTab;
