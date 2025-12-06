/**
 * Customer Merging Management Page
 *
 * AI-powered customer merge management interface
 * - View AI suggestions
 * - Approve/reject/edit merge suggestions
 * - Manage active merge rules
 * - Validate rules after database uploads
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Tabs,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Input,
  Select,
  message,
  Statistic,
  Row,
  Col,
  Badge,
  Tooltip,
  Popconfirm,
  Spin,
  Alert,
  Empty,
  Divider,
  Progress,
  Checkbox,
  Pagination
} from 'antd';
import {
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { useExcelData } from '../../../contexts/ExcelDataContext';
import axios from 'axios';
import './CustomerMergingPage.css';

const { TabPane } = Tabs;
const { TextArea } = Input;
const { Option } = Select;

const CustomerMergingPage = () => {
  const { selectedDivision } = useExcelData();

  // State
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [stats, setStats] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeRules, setActiveRules] = useState([]);
  const [needsValidation, setNeedsValidation] = useState([]);

  // Modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editRuleModalVisible, setEditRuleModalVisible] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);
  const [activeTab, setActiveTab] = useState('suggestions');
  const [selectedMergedRows, setSelectedMergedRows] = useState([]);
  const [divisionCustomers, setDivisionCustomers] = useState([]);
  const [divisionCustomersLoading, setDivisionCustomersLoading] = useState(false);
  const [divisionCustomersError, setDivisionCustomersError] = useState(null);
  const [manualSelectionKeys, setManualSelectionKeys] = useState([]);
  const [manualSuggestionModalVisible, setManualSuggestionModalVisible] = useState(false);
  const [manualSuggestionName, setManualSuggestionName] = useState('');
  const [manualSuggestionSubmitting, setManualSuggestionSubmitting] = useState(false);
  const [manualPage, setManualPage] = useState(1);
  const manualPageSize = 40;
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchRule, setCustomerSearchRule] = useState('');
  const [manualBrowserSearch, setManualBrowserSearch] = useState('');

  // Form states
  const [editForm, setEditForm] = useState({ mergedName: '', customers: [] });
  const [editRuleForm, setEditRuleForm] = useState({ mergedName: '', customers: [] });
  const [createForm, setCreateForm] = useState({ mergedName: '', customers: ['', ''] });

  // Helpers
  const toProperCase = (str) => {
    if (!str) return '';
    return str
      .toString()
      .trim()
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const normalizeName = (value) => (value || '').toString().trim().toLowerCase();

  // Load data on mount and when division changes
  useEffect(() => {
    if (selectedDivision) {
      loadAllData();
      setManualPage(1);
      setManualSelectionKeys([]);
    }
  }, [selectedDivision]);

  // ========================================================================
  // DATA LOADING
  // ========================================================================

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadSuggestions(),
        loadActiveRules(),
        loadNeedsValidation(),
        loadDivisionCustomers()
      ]);
    } catch (error) {
      message.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/api/division-merge-rules/stats?division=${selectedDivision}`);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/api/division-merge-rules/suggestions?division=${selectedDivision}&status=PENDING`);
      if (response.data.success) {
        setSuggestions(response.data.data);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const loadActiveRules = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/api/division-merge-rules/rules?division=${selectedDivision}`);
      if (response.data.success) {
        setActiveRules(response.data.data);
      }
    } catch (error) {
      console.error('Error loading rules:', error);
    }
  };

  const loadNeedsValidation = async () => {
    try {
      const response = await axios.get(`http://localhost:3001/api/division-merge-rules/rules/needs-validation?division=${selectedDivision}`);
      if (response.data.success) {
        setNeedsValidation(response.data.data);
      }
    } catch (error) {
      console.error('Error loading validation rules:', error);
    }
  };

  const loadDivisionCustomers = async () => {
    if (!selectedDivision) return;
    setDivisionCustomersLoading(true);
    try {
      const response = await axios.get(`http://localhost:3001/api/fp/all-customers?division=${selectedDivision}`);
      if (response.data.success && Array.isArray(response.data.data)) {
        setDivisionCustomers(response.data.data);
        setDivisionCustomersError(null);
      } else {
        setDivisionCustomers([]);
        setDivisionCustomersError(response.data?.error || 'Failed to load customers');
      }
    } catch (error) {
      console.error('Error loading division customers:', error);
      setDivisionCustomers([]);
      setDivisionCustomersError(error.response?.data?.message || error.response?.data?.error || 'Failed to load customers');
    } finally {
      setDivisionCustomersLoading(false);
    }
  };

  // ========================================================================
  // AI SCAN
  // ========================================================================

  const runAIScan = async () => {
    setScanning(true);
    try {
      const response = await axios.post('http://localhost:3001/api/division-merge-rules/scan', {
        division: selectedDivision,
        minConfidence: 0.35  // Lowered threshold to catch more potential duplicates (users manually approve each)
      });

      if (response.data.success) {
        message.success(`AI found ${response.data.count} potential merge groups!`);
        await loadAllData();
      }
    } catch (error) {
      message.error('AI scan failed');
      console.error(error);
    } finally {
      setScanning(false);
    }
  };

  // ========================================================================
  // SUGGESTION ACTIONS
  // ========================================================================

  const approveSuggestion = async (suggestionId) => {
    try {
      console.log('🔵 Approving suggestion:', suggestionId);
      const response = await axios.post(`http://localhost:3001/api/division-merge-rules/suggestions/${suggestionId}/approve`, {
        division: selectedDivision,
        approvedBy: 'Admin' // TODO: Get from user context
      });

      console.log('🔵 Approve response:', response.data);

      if (response.data.success) {
        message.success('Suggestion approved and rule created!');
        await loadAllData();
      } else {
        message.error(response.data.error || 'Failed to approve');
      }
    } catch (error) {
      message.error('Failed to approve suggestion: ' + (error.response?.data?.error || error.message));
      console.error('❌ Approve error:', error);
      console.error('❌ Error response:', error.response?.data);
    }
  };

  const rejectSuggestion = async (suggestionId, reason) => {
    try {
      const response = await axios.post(`http://localhost:3001/api/division-merge-rules/suggestions/${suggestionId}/reject`, {
        division: selectedDivision,
        rejectedBy: 'Admin',
        reason
      });

      if (response.data.success) {
        message.success('Suggestion rejected');
        await loadAllData();
      }
    } catch (error) {
      message.error('Failed to reject suggestion');
      console.error(error);
    }
  };

  const openEditSuggestion = (suggestion) => {
    setSelectedSuggestion(suggestion);
    setEditForm({
      mergedName: suggestion.suggested_merge_name,
      customers: suggestion.customer_group
    });
    setEditModalVisible(true);
  };

  const saveEditedSuggestion = async () => {
    try {
      console.log('🔵 Saving edited suggestion:', {
        id: selectedSuggestion.id,
        mergedName: editForm.mergedName,
        customers: editForm.customers
      });

      const response = await axios.post(`http://localhost:3001/api/division-merge-rules/suggestions/${selectedSuggestion.id}/edit-approve`, {
        division: selectedDivision,
        mergedName: editForm.mergedName,
        originalCustomers: editForm.customers,
        approvedBy: 'Admin'
      });

      console.log('🔵 Edit response:', response.data);

      if (response.data.success) {
        message.success('Edited suggestion approved!');
        setEditModalVisible(false);
        await loadAllData();
      } else {
        message.error(response.data.error || 'Failed to save');
      }
    } catch (error) {
      message.error('Failed to save edited suggestion: ' + (error.response?.data?.error || error.message));
      console.error('❌ Edit error:', error);
      console.error('❌ Error response:', error.response?.data);
    }
  };

  // ========================================================================
  // RULE ACTIONS
  // ========================================================================

  const editRule = (rule) => {
    setSelectedRule(rule);
    setEditRuleForm({
      mergedName: rule.merged_customer_name,
      customers: rule.original_customers
    });
    setEditRuleModalVisible(true);
  };

  const saveEditedRule = async () => {
    // Validation
    if (!editRuleForm.mergedName?.trim()) {
      message.error('Please enter a merged customer name');
      return;
    }
    
    const validCustomers = editRuleForm.customers.filter(c => c?.trim());
    if (validCustomers.length < 2) {
      message.error('Please add at least 2 customers to merge');
      return;
    }

    try {
      console.log('🔵 Saving edited rule:', {
        id: selectedRule.id,
        mergedName: editRuleForm.mergedName,
        customers: validCustomers
      });

      const response = await axios.put(`http://localhost:3001/api/division-merge-rules/rules/${selectedRule.id}`, {
        division: selectedDivision,
        mergedName: editRuleForm.mergedName.trim(),
        originalCustomers: validCustomers,
        updatedBy: 'Admin'
      });

      console.log('🔵 Edit rule response:', response.data);

      if (response.data.success) {
        message.success('Rule updated successfully!');
        setEditRuleModalVisible(false);
        await loadAllData();
      } else {
        message.error(response.data.error || 'Failed to update rule');
      }
    } catch (error) {
      message.error('Failed to update rule: ' + (error.response?.data?.error || error.message));
      console.error('❌ Edit rule error:', error);
      console.error('❌ Error response:', error.response?.data);
    }
  };

  const deleteRule = async (ruleId) => {
    try {
      const response = await axios.delete(`http://localhost:3001/api/division-merge-rules/rules/${ruleId}?division=${selectedDivision}`);

      if (response.data.success) {
        message.success('Rule deleted');
        await loadAllData();
      }
    } catch (error) {
      message.error('Failed to delete rule');
      console.error(error);
    }
  };

  const applyAIFix = async (ruleId, suggestionIndex) => {
    try {
      const response = await axios.post(`http://localhost:3001/api/division-merge-rules/rules/${ruleId}/apply-fix`, {
        division: selectedDivision,
        suggestionIndex,
        approvedBy: 'Admin'
      });

      if (response.data.success) {
        message.success('Rule fixed successfully!');
        await loadAllData();
      }
    } catch (error) {
      message.error('Failed to apply fix');
      console.error(error);
    }
  };

  const createManualRule = async () => {
    try {
      const validCustomers = createForm.customers.filter(c => c.trim() !== '');

      if (validCustomers.length < 2) {
        message.error('At least 2 customers are required');
        return;
      }

      const response = await axios.post('http://localhost:3001/api/division-merge-rules/rules/manual', {
        division: selectedDivision,
        mergedName: createForm.mergedName,
        originalCustomers: validCustomers,
        createdBy: 'Admin'
      });

      if (response.data.success) {
        message.success('Manual rule created!');
        setCreateModalVisible(false);
        setCreateForm({ mergedName: '', customers: ['', ''] });
        await loadAllData();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to create rule');
      console.error(error);
    }
  };

  const validateAllRules = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:3001/api/division-merge-rules/validate', {
        division: selectedDivision
      });

      if (response.data.success) {
        const summary = response.data.summary;
        message.success(
          `Validation complete: ${summary.valid} valid, ${summary.needsUpdate} need updates, ${summary.orphaned} orphaned`
        );
        await loadAllData();
      }
    } catch (error) {
      message.error('Validation failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // TABLE COLUMNS
  // ========================================================================

  const suggestionColumns = [
    {
      title: 'Confidence',
      dataIndex: 'confidence_score',
      key: 'confidence',
      width: 120,
      render: (score) => {
        const percent = (score * 100).toFixed(0);
        const color = score >= 0.9 ? 'success' : score >= 0.8 ? 'processing' : 'warning';
        return (
          <div>
            <Progress
              percent={percent}
              size="small"
              status={color === 'success' ? 'success' : 'active'}
              strokeColor={color === 'success' ? '#52c41a' : color === 'processing' ? '#1890ff' : '#faad14'}
            />
            <Tag color={color === 'success' ? 'green' : color === 'processing' ? 'blue' : 'orange'}>
              {percent}%
            </Tag>
          </div>
        );
      },
      sorter: (a, b) => b.confidence_score - a.confidence_score,
      defaultSortOrder: 'descend'
    },
    {
      title: 'Merged Name',
      dataIndex: 'suggested_merge_name',
      key: 'mergedName',
      render: (text) => <strong style={{ color: '#1890ff' }}>{toProperCase(text)}</strong>
    },
    {
      title: 'Customers to Merge',
      dataIndex: 'customer_group',
      key: 'customers',
      render: (customers) => (
        <div style={{ maxWidth: 400 }}>
          {customers.map((customer, index) => (
            <Tag key={index} style={{ marginBottom: 4 }}>
              {toProperCase(customer)}
            </Tag>
          ))}
          <Badge count={customers.length} style={{ backgroundColor: '#52c41a' }} />
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space>
          <Tooltip title="Approve">
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => approveSuggestion(record.id)}
              size="small"
            >
              Approve
            </Button>
          </Tooltip>
          <Tooltip title="Edit before approving">
            <Button
              icon={<EditOutlined />}
              onClick={() => openEditSuggestion(record)}
              size="small"
            >
              Edit
            </Button>
          </Tooltip>
          <Popconfirm
            title="Reject this suggestion?"
            onConfirm={() => rejectSuggestion(record.id, 'Not a match')}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Reject">
              <Button
                danger
                icon={<CloseCircleOutlined />}
                size="small"
              >
                Reject
              </Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const mergedCustomersTableData = useMemo(() => {
    if (!activeRules || activeRules.length === 0) {
      return [];
    }

    return [...activeRules]
      .map(rule => ({
        ...rule,
        displayMergedName: toProperCase(rule.merged_customer_name),
        displayOriginals: (rule.original_customers || []).map(toProperCase)
      }))
      .sort((a, b) => a.displayMergedName.localeCompare(b.displayMergedName));
  }, [activeRules]);

  const manualCustomerList = useMemo(() => {
    const mergedOriginalMap = new Map();
    (activeRules || []).forEach(rule => {
      (rule.original_customers || []).forEach(customer => {
        const normalized = normalizeName(customer);
        if (!mergedOriginalMap.has(normalized)) {
          mergedOriginalMap.set(normalized, rule);
        }
      });
    });

    // Only show unmerged individual customers (no merged groups)
    const singleEntries = (divisionCustomers || [])
      .filter(customer => !mergedOriginalMap.has(normalizeName(customer)))
      .map(customer => ({
        id: `single-${normalizeName(customer)}`,
        displayName: toProperCase(customer),
        type: 'single',
        badgeCount: 1,
        rawCustomers: [customer],
        source: 'INDIVIDUAL'
      }));

    return singleEntries.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [activeRules, divisionCustomers]);

  const manualSelectionEntries = useMemo(
    () => manualCustomerList.filter(entry => manualSelectionKeys.includes(entry.id)),
    [manualCustomerList, manualSelectionKeys]
  );

  const manualPreviewCustomers = useMemo(() => {
    const dedupe = new Map();
    manualSelectionEntries.forEach(entry => {
      (entry.rawCustomers || []).forEach(customer => {
        const normalized = normalizeName(customer);
        if (!dedupe.has(normalized)) {
          dedupe.set(normalized, customer);
        }
      });
    });
    return Array.from(dedupe.values());
  }, [manualSelectionEntries]);

  // Filter manual customer list by search
  const manualFilteredList = useMemo(() => {
    if (!manualBrowserSearch.trim()) return manualCustomerList;

    const searchTerm = manualBrowserSearch.toLowerCase();
    return manualCustomerList.filter(entry =>
      entry.displayName.toLowerCase().includes(searchTerm)
    );
  }, [manualCustomerList, manualBrowserSearch]);

  // Pagination for manual builder
  const manualPaginatedData = useMemo(() => {
    const start = (manualPage - 1) * manualPageSize;
    const end = start + manualPageSize;
    return manualFilteredList.slice(start, end);
  }, [manualFilteredList, manualPage]);

  const manualTotalPages = Math.ceil(manualFilteredList.length / manualPageSize);

  const handleManualPageChange = (page) => {
    setManualPage(page);
  };

  // Get unmerged customers for dropdown (excluding customers already in the form)
  const getAvailableCustomersForSuggestion = () => {
    const currentCustomers = new Set(editForm.customers.map(c => c.toLowerCase().trim()));
    return manualCustomerList
      .filter(entry => !currentCustomers.has(entry.displayName.toLowerCase()))
      .map(entry => entry.displayName);
  };

  const getAvailableCustomersForRule = () => {
    const currentCustomers = new Set(editRuleForm.customers.map(c => c.toLowerCase().trim()));
    return manualCustomerList
      .filter(entry => !currentCustomers.has(entry.displayName.toLowerCase()))
      .map(entry => entry.displayName);
  };

  const addCustomerToSuggestion = (customerName) => {
    if (customerName && !editForm.customers.includes(customerName)) {
      setEditForm({ ...editForm, customers: [...editForm.customers, customerName] });
      setCustomerSearch('');
    }
  };

  const addCustomerToRule = (customerName) => {
    if (customerName && !editRuleForm.customers.includes(customerName)) {
      setEditRuleForm({ ...editRuleForm, customers: [...editRuleForm.customers, customerName] });
      setCustomerSearchRule('');
    }
  };

  const toggleManualSelection = (id) => {
    setManualSelectionKeys(prev => 
      prev.includes(id) 
        ? prev.filter(key => key !== id)
        : [...prev, id]
    );
  };

  const openManualSuggestionModal = () => {
    if (manualSelectionKeys.length < 2) {
      message.warning('Select at least two customers or groups to create a suggestion');
      return;
    }
    const firstName = manualSelectionEntries[0]?.displayName?.replace(/\*$/, '') || '';
    setManualSuggestionName(firstName);
    setManualSuggestionModalVisible(true);
  };

  const handleSubmitManualSuggestion = async () => {
    if (manualSelectionEntries.length < 2) {
      message.error('Please select at least two customers or groups.');
      return;
    }

    const trimmedName = manualSuggestionName.trim();
    if (!trimmedName) {
      message.error('Please provide a merged customer name.');
      return;
    }

    const flattenedCustomers = [];
    const dedupeMap = new Map();

    manualSelectionEntries.forEach(entry => {
      (entry.rawCustomers || []).forEach(customer => {
        const normalized = normalizeName(customer);
        if (!dedupeMap.has(normalized)) {
          dedupeMap.set(normalized, customer);
          flattenedCustomers.push(customer);
        }
      });
    });

    if (flattenedCustomers.length < 2) {
      message.error('Need at least two unique customers to send a suggestion.');
      return;
    }

    setManualSuggestionSubmitting(true);
    try {
      const response = await axios.post('http://localhost:3001/api/division-merge-rules/suggestions/manual', {
        division: selectedDivision,
        mergedName: trimmedName,
        customerGroup: flattenedCustomers,
        createdBy: 'Admin'
      });

      if (response.data.success) {
        message.success('Manual suggestion sent successfully!');
        
        // Remove sent customers from the divisionCustomers list
        const sentCustomerNames = new Set(flattenedCustomers.map(c => normalizeName(c)));
        setDivisionCustomers(prev => 
          prev.filter(customer => !sentCustomerNames.has(normalizeName(customer)))
        );
        
        setManualSuggestionModalVisible(false);
        setManualSelectionKeys([]);
        setManualSuggestionName('');
        setManualPage(1); // Reset to first page after removal
        await loadSuggestions();
      } else {
        message.error(response.data.error || 'Failed to create suggestion');
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to send suggestion');
      console.error('Error sending manual suggestion:', error);
    } finally {
      setManualSuggestionSubmitting(false);
    }
  };

  const renderRuleSourceTag = (source) => {
    const config = {
      'AI_SUGGESTED': { color: 'purple', text: '🤖 AI' },
      'ADMIN_CREATED': { color: 'blue', text: '👤 Admin' },
      'ADMIN_EDITED': { color: 'orange', text: '✏️ Edited' },
      'MIGRATED_FROM_SALES_REP': { color: 'default', text: '📦 Migrated' }
    };
    const c = config[source] || { color: 'default', text: source || 'Unknown' };
    return <Tag color={c.color}>{c.text}</Tag>;
  };

  const activeRulesColumns = [
    {
      title: 'Status',
      dataIndex: 'validation_status',
      key: 'status',
      width: 100,
      filters: [
        { text: 'Valid', value: 'VALID' },
        { text: 'Needs Update', value: 'NEEDS_UPDATE' },
        { text: 'Orphaned', value: 'ORPHANED' }
      ],
      onFilter: (value, record) => record.validation_status === value,
      render: (status) => {
        const config = {
          'VALID': { color: 'success', icon: <CheckCircleOutlined />, text: 'Valid' },
          'NEEDS_UPDATE': { color: 'warning', icon: <WarningOutlined />, text: 'Needs Update' },
          'ORPHANED': { color: 'error', icon: <CloseCircleOutlined />, text: 'Orphaned' },
          'NOT_VALIDATED': { color: 'default', icon: <InfoCircleOutlined />, text: 'Not Validated' }
        };
        const c = config[status] || config['NOT_VALIDATED'];
        return (
          <Tag color={c.color} icon={c.icon}>
            {c.text}
          </Tag>
        );
      }
    },
    {
      title: 'Merged Name',
      dataIndex: 'merged_customer_name',
      key: 'mergedName',
      render: (text) => <strong>{toProperCase(text)}</strong>
    },
    {
      title: 'Original Customers',
      dataIndex: 'original_customers',
      key: 'customers',
      render: (customers) => (
        <div>
          {customers.map((customer, index) => (
            <Tag key={index} style={{ marginBottom: 4 }}>
              {toProperCase(customer)}
            </Tag>
          ))}
        </div>
      )
    },
    {
      title: 'Source',
      dataIndex: 'rule_source',
      key: 'source',
      width: 150,
      render: renderRuleSourceTag
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit rule">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => editRule(record)}
            >
              Edit
            </Button>
          </Tooltip>
          <Popconfirm
            title="Delete this rule?"
            description="This will unmerge the customers."
            onConfirm={() => deleteRule(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger icon={<DeleteOutlined />} size="small">
              Delete
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const mergedCustomersColumns = [
    {
      title: 'Merged Customer',
      dataIndex: 'displayMergedName',
      key: 'mergedName',
      render: (text) => <strong>{text}</strong>
    },
    {
      title: 'Original Customers',
      dataIndex: 'displayOriginals',
      key: 'originalCustomers',
      render: (customers) => (
        <div>
          {customers.map((customer, index) => (
            <Tag key={`${customer}-${index}`} style={{ marginBottom: 4 }}>
              {customer}
            </Tag>
          ))}
        </div>
      )
    },
    {
      title: 'Total Customers',
      dataIndex: 'displayOriginals',
      key: 'totalCustomers',
      width: 140,
      sorter: (a, b) => a.displayOriginals.length - b.displayOriginals.length,
      render: (customers) => (
        <Tag color="blue" style={{ fontSize: 14 }}>
          {customers.length}
        </Tag>
      )
    },
    {
      title: 'Source',
      dataIndex: 'rule_source',
      key: 'source',
      width: 150,
      render: renderRuleSourceTag
    }
  ];

  const mergedCustomerRowSelection = {
    selectedRowKeys: selectedMergedRows,
    onChange: (selectedKeys) => setSelectedMergedRows(selectedKeys)
  };

  const handleNavigateToSuggestions = () => {
    if (selectedMergedRows.length > 0) {
      const selectedNames = mergedCustomersTableData
        .filter(rule => selectedMergedRows.includes(rule.id))
        .map(rule => rule.displayMergedName);
      message.info(`Reviewing ${selectedNames.length} selected merge${selectedNames.length > 1 ? 's' : ''} in AI suggestions`);
    }
    setActiveTab('suggestions');
  };

  const validationColumns = [
    {
      title: 'Rule Name',
      dataIndex: 'merged_customer_name',
      key: 'name',
      render: (text) => <strong>{toProperCase(text)}</strong>
    },
    {
      title: 'Issue',
      dataIndex: 'validation_status',
      key: 'issue',
      render: (status, record) => {
        const notes = record.validation_notes;
        if (!notes) return '-';

        const missing = notes.missing || [];
        const found = notes.found || [];

        return (
          <div>
            <div>✓ Found: {found.length} customers</div>
            <div style={{ color: '#ff4d4f' }}>✗ Missing: {missing.length} customers</div>
            {missing.map((m, i) => (
              <Tag key={i} color="red" style={{ marginTop: 4 }}>{toProperCase(m)}</Tag>
            ))}
          </div>
        );
      }
    },
    {
      title: 'AI Suggestions',
      dataIndex: 'validation_notes',
      key: 'suggestions',
      render: (notes, record) => {
        if (!notes || !notes.suggestions || notes.suggestions.length === 0) {
          return <Tag color="default">No suggestions</Tag>;
        }

        return (
          <div>
            {notes.suggestions.map((sugg, index) => (
              <div key={index} style={{ marginBottom: 8 }}>
                <div>Replace: <Tag color="red">{toProperCase(sugg.missing)}</Tag></div>
                <div>With: <Tag color="green">{toProperCase(sugg.replacement)}</Tag> ({sugg.confidence})</div>
                <Button
                  type="link"
                  size="small"
                  onClick={() => applyAIFix(record.id, index)}
                >
                  Apply Fix
                </Button>
              </div>
            ))}
          </div>
        );
      }
    }
  ];

  // ========================================================================
  // RENDER
  // ========================================================================

  if (!selectedDivision) {
    return (
      <Card>
        <Empty description="Please select a division first" />
      </Card>
    );
  }

  return (
    <div className="customer-merging-page">
      {/* Header */}
      <Card className="header-card">
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <h1 style={{ margin: 0 }}>
              <RobotOutlined style={{ marginRight: 12, color: '#1890ff' }} />
              AI-Powered Customer Merge Management
            </h1>
            <p style={{ margin: '8px 0 0 0', color: '#666' }}>
              Division: <strong>{selectedDivision}</strong>
            </p>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                Create Manual Rule
              </Button>
              <Button
                icon={<SyncOutlined />}
                onClick={validateAllRules}
                loading={loading}
              >
                Validate All Rules
              </Button>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={runAIScan}
                loading={scanning}
                size="large"
              >
                Run AI Scan
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Statistics */}
      {stats && (
        <Card style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Active Rules"
                value={stats.rules.active_rules}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Pending AI Suggestions"
                value={stats.suggestions.pending}
                prefix={<RobotOutlined style={{ color: '#1890ff' }} />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Needs Validation"
                value={parseInt(stats.rules.needs_update) + parseInt(stats.rules.orphaned)}
                prefix={<WarningOutlined style={{ color: '#faad14' }} />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Approved Suggestions"
                value={stats.suggestions.approved}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Card style={{ marginTop: 16 }}>
        <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)}>
          <TabPane
            tab={
              <Badge count={suggestions.length} offset={[10, 0]}>
                <span>🤖 AI Suggestions</span>
              </Badge>
            }
            key="suggestions"
          >
            {suggestions.length === 0 ? (
              <Empty
                description="No pending AI suggestions. Run an AI scan to find duplicates!"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={runAIScan}
                  loading={scanning}
                >
                  Run AI Scan Now
                </Button>
              </Empty>
            ) : (
              <>
                <Alert
                  message="AI-Generated Merge Suggestions"
                  description="These customers appear to be duplicates based on AI analysis. Review and approve/reject each suggestion."
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Table
                  columns={suggestionColumns}
                  dataSource={suggestions}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </>
            )}
          </TabPane>

          <TabPane
            tab={
              <span>📋 Merged Customers ({mergedCustomersTableData.length})</span>
            }
            key="mergedCustomers"
          >
            {mergedCustomersTableData.length === 0 ? (
              <Empty description="No merged customers yet. Approve AI suggestions to see them here." />
            ) : (
              <>
                <Alert
                  message="Merged Customers Overview"
                  description="Review all active merged customers sorted alphabetically. Select any rows and jump to the AI Suggestions tab to refine them."
                  type="success"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Space style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    disabled={selectedMergedRows.length === 0}
                    onClick={handleNavigateToSuggestions}
                  >
                    Review Selected in Suggestions
                  </Button>
                  {selectedMergedRows.length > 0 && (
                    <Tag color="blue">{selectedMergedRows.length} selected</Tag>
                  )}
                  <Button onClick={() => setSelectedMergedRows([])} disabled={selectedMergedRows.length === 0}>
                    Clear Selection
                  </Button>
                </Space>
                <Table
                  rowSelection={mergedCustomerRowSelection}
                  columns={mergedCustomersColumns}
                  dataSource={mergedCustomersTableData}
                  rowKey="id"
                  pagination={{ pageSize: 15 }}
                  loading={loading}
                />
              </>
            )}
          </TabPane>

          <TabPane
            tab={
              <span>🧩 Manual Builder</span>
            }
            key="manual"
          >
            <Alert
              message="Manual Merge Suggestions"
              description="Select unmerged customers and send them to the AI Suggestions queue for review. Selected customers will be removed from this list after sending."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            {divisionCustomersError && (
              <Alert
                type="warning"
                showIcon
                message="Customer list unavailable"
                description={divisionCustomersError}
                style={{ marginBottom: 16 }}
              />
            )}
            <Input
              placeholder="Search unmerged customers..."
              value={manualBrowserSearch}
              onChange={(e) => {
                setManualBrowserSearch(e.target.value);
                setManualPage(1); // Reset to first page when searching
              }}
              prefix={<span style={{ color: '#9ca3af' }}>🔍</span>}
              allowClear
              style={{ marginBottom: 16 }}
              size="large"
            />
            <Space style={{ marginBottom: 16 }} wrap>
              <Button
                type="primary"
                disabled={manualSelectionKeys.length < 2}
                onClick={openManualSuggestionModal}
              >
                Send Selected to Suggestions
              </Button>
              <Button
                onClick={() => {
                  setManualSelectionKeys([]);
                  setManualPage(1);
                }}
                disabled={manualSelectionKeys.length === 0}
              >
                Clear Selection
              </Button>
              {manualSelectionKeys.length > 0 && (
                <Tag color="blue">{manualSelectionKeys.length} selected</Tag>
              )}
            </Space>
            {divisionCustomersLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
              </div>
            ) : manualFilteredList.length === 0 ? (
              <Empty description={manualBrowserSearch ? `No customers found matching "${manualBrowserSearch}"` : "No customers found"} />
            ) : (
              <>
                {manualBrowserSearch && (
                  <div style={{ marginBottom: 12, padding: 8, backgroundColor: '#f0f9ff', borderRadius: 4, border: '1px solid #bae6fd' }}>
                    <span style={{ color: '#0284c7', fontWeight: 500 }}>
                      Showing {manualFilteredList.length} of {manualCustomerList.length} customers matching "{manualBrowserSearch}"
                    </span>
                  </div>
                )}
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  {manualPaginatedData.map((entry, index) => {
                    const isSelected = manualSelectionKeys.includes(entry.id);
                    const serialNumber = (manualPage - 1) * manualPageSize + index + 1;
                    return (
                      <Col span={12} key={entry.id}>
                        <Card
                          size="small"
                          style={{
                            cursor: 'pointer',
                            border: isSelected ? '2px solid #1890ff' : '1px solid #d9d9d9',
                            backgroundColor: isSelected ? '#e6f7ff' : '#fff',
                            textAlign: 'left'
                          }}
                          onClick={() => toggleManualSelection(entry.id)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleManualSelection(entry.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ textAlign: 'left', width: '100%' }}
                          >
                            <span style={{ marginRight: 8, color: '#666', fontWeight: 500 }}>
                              {serialNumber}.
                            </span>
                            <strong>{entry.displayName}</strong>
                          </Checkbox>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Pagination
                    current={manualPage}
                    total={manualFilteredList.length}
                    pageSize={manualPageSize}
                    onChange={handleManualPageChange}
                    showSizeChanger={false}
                    showTotal={(total, range) => `${range[0]}-${range[1]} of ${total} customers`}
                  />
                </div>
              </>
            )}
          </TabPane>

          <TabPane
            tab={
              <span>✅ Active Rules ({activeRules.length})</span>
            }
            key="active"
          >
            <Table
              columns={activeRulesColumns}
              dataSource={activeRules}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 20 }}
            />
          </TabPane>

          <TabPane
            tab={
              <Badge count={needsValidation.length} offset={[10, 0]}>
                <span>⚠️ Needs Validation</span>
              </Badge>
            }
            key="validation"
          >
            {needsValidation.length === 0 ? (
              <Empty description="All rules are valid! 🎉" />
            ) : (
              <>
                <Alert
                  message="Rules Requiring Attention"
                  description="These rules have issues after the latest database upload. Review AI suggestions to fix them."
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
                <Table
                  columns={validationColumns}
                  dataSource={needsValidation}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </>
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* Manual Suggestion Modal */}
      <Modal
        title="Send to AI Suggestions"
        open={manualSuggestionModalVisible}
        onOk={handleSubmitManualSuggestion}
        onCancel={() => setManualSuggestionModalVisible(false)}
        confirmLoading={manualSuggestionSubmitting}
        okText="Send"
      >
        <div style={{ marginBottom: 16 }}>
          <label>Suggested merged name</label>
          <Input
            value={manualSuggestionName}
            onChange={(e) => setManualSuggestionName(e.target.value)}
            placeholder="Enter merged customer name"
            style={{ marginTop: 8 }}
          />
        </div>
        <div>
          <label>Customers in this group ({manualPreviewCustomers.length}):</label>
          <div style={{ marginTop: 8 }}>
            {manualPreviewCustomers.map((customer) => (
              <Tag key={customer} style={{ marginBottom: 8 }}>
                {toProperCase(customer)}
              </Tag>
            ))}
          </div>
        </div>
      </Modal>

      {/* Edit Suggestion Modal */}
      <Modal
        title="Edit Merge Suggestion"
        open={editModalVisible}
        onOk={saveEditedSuggestion}
        onCancel={() => {
          setEditModalVisible(false);
          setCustomerSearch('');
        }}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <label>Merged Customer Name:</label>
          <Input
            value={editForm.mergedName}
            onChange={(e) => setEditForm({ ...editForm, mergedName: e.target.value })}
            placeholder="Enter merged customer name"
            style={{ marginTop: 8 }}
          />
        </div>
        <div>
          <label>Customers to Merge:</label>
          {editForm.customers.map((customer, index) => (
            <div key={index} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Input
                value={customer}
                onChange={(e) => {
                  const newCustomers = [...editForm.customers];
                  newCustomers[index] = e.target.value;
                  setEditForm({ ...editForm, customers: newCustomers });
                }}
                placeholder={`Customer ${index + 1}`}
              />
              <Button
                danger
                onClick={() => {
                  const newCustomers = editForm.customers.filter((_, i) => i !== index);
                  setEditForm({ ...editForm, customers: newCustomers });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <Divider style={{ margin: '16px 0' }} />
          <div style={{ marginBottom: 12 }}>
            <label>Add from unmerged customers ({getAvailableCustomersForSuggestion().length} available):</label>
            <Select
              showSearch
              value={customerSearch}
              placeholder="Search and select customer to add..."
              style={{ width: '100%', marginTop: 8 }}
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onSelect={(value) => addCustomerToSuggestion(value)}
              onChange={setCustomerSearch}
              allowClear
            >
              {getAvailableCustomersForSuggestion().map((customer) => (
                <Option key={customer} value={customer}>
                  {customer}
                </Option>
              ))}
            </Select>
          </div>
          <Button
            type="dashed"
            onClick={() => {
              setEditForm({ ...editForm, customers: [...editForm.customers, ''] });
            }}
            style={{ width: '100%' }}
            icon={<PlusOutlined />}
          >
            Add Empty Field (Manual Entry)
          </Button>
        </div>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal
        title="Edit Merge Rule"
        open={editRuleModalVisible}
        onOk={saveEditedRule}
        onCancel={() => {
          setEditRuleModalVisible(false);
          setCustomerSearchRule('');
        }}
        width={700}
        okButtonProps={{
          disabled: !editRuleForm.mergedName?.trim() || 
                    editRuleForm.customers.filter(c => c?.trim()).length < 2
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <label>Merged Customer Name:</label>
          <Input
            value={editRuleForm.mergedName}
            onChange={(e) => setEditRuleForm({ ...editRuleForm, mergedName: e.target.value })}
            placeholder="Enter merged customer name"
            style={{ marginTop: 8 }}
          />
        </div>
        <div>
          <label>Customers to Merge:</label>
          {editRuleForm.customers.map((customer, index) => (
            <div key={index} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Input
                value={customer}
                onChange={(e) => {
                  const newCustomers = [...editRuleForm.customers];
                  newCustomers[index] = e.target.value;
                  setEditRuleForm({ ...editRuleForm, customers: newCustomers });
                }}
                placeholder={`Customer ${index + 1}`}
              />
              <Button
                danger
                onClick={() => {
                  const newCustomers = editRuleForm.customers.filter((_, i) => i !== index);
                  setEditRuleForm({ ...editRuleForm, customers: newCustomers });
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <Divider style={{ margin: '16px 0' }} />
          <div style={{ marginBottom: 12 }}>
            <label>Add from unmerged customers ({getAvailableCustomersForRule().length} available):</label>
            <Select
              showSearch
              value={customerSearchRule}
              placeholder="Search and select customer to add..."
              style={{ width: '100%', marginTop: 8 }}
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              onSelect={(value) => addCustomerToRule(value)}
              onChange={setCustomerSearchRule}
              allowClear
            >
              {getAvailableCustomersForRule().map((customer) => (
                <Option key={customer} value={customer}>
                  {customer}
                </Option>
              ))}
            </Select>
          </div>
          <Button
            type="dashed"
            onClick={() => {
              setEditRuleForm({ ...editRuleForm, customers: [...editRuleForm.customers, ''] });
            }}
            style={{ width: '100%' }}
            icon={<PlusOutlined />}
          >
            Add Empty Field (Manual Entry)
          </Button>
        </div>
      </Modal>

      {/* Create Manual Rule Modal */}
      <Modal
        title="Create Manual Merge Rule"
        open={createModalVisible}
        onOk={createManualRule}
        onCancel={() => {
          setCreateModalVisible(false);
          setCreateForm({ mergedName: '', customers: ['', ''] });
        }}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <label>Merged Customer Name:</label>
          <Input
            value={createForm.mergedName}
            onChange={(e) => setCreateForm({ ...createForm, mergedName: e.target.value })}
            placeholder="Enter merged customer name"
            style={{ marginTop: 8 }}
          />
        </div>
        <div>
          <label>Customers to Merge (minimum 2):</label>
          {createForm.customers.map((customer, index) => (
            <div key={index} style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <Input
                value={customer}
                onChange={(e) => {
                  const newCustomers = [...createForm.customers];
                  newCustomers[index] = e.target.value;
                  setCreateForm({ ...createForm, customers: newCustomers });
                }}
                placeholder={`Customer ${index + 1}`}
              />
              {createForm.customers.length > 2 && (
                <Button
                  danger
                  onClick={() => {
                    const newCustomers = createForm.customers.filter((_, i) => i !== index);
                    setCreateForm({ ...createForm, customers: newCustomers });
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => {
              setCreateForm({ ...createForm, customers: [...createForm.customers, ''] });
            }}
            style={{ marginTop: 8, width: '100%' }}
          >
            Add Customer
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerMergingPage;
