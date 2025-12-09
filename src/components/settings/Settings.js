import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency, currencyMapping, getCountryList } from '../../contexts/CurrencyContext';
import axios from 'axios';
import PeriodConfiguration from './PeriodConfiguration';
import MasterDataSettings from './MasterDataSettings';
import ThemeSelector from './ThemeSelector';
import UAEDirhamSymbol from '../dashboard/UAEDirhamSymbol';
import './Settings.css';

// Custom Currency Dropdown Component with SVG support for UAE Dirham
const CurrencyDropdown = ({ value, onChange, countries, currencyMapping }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const filteredCountries = countries.filter(country => 
    country.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currencyMapping[country]?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currencyMapping[country]?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderCurrencySymbol = (country) => {
    const curr = currencyMapping[country];
    if (!curr) return null;
    
    // Use UAEDirhamSymbol SVG for UAE
    if (curr.code === 'AED') {
      return <UAEDirhamSymbol style={{ width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '0.3em' }} />;
    }
    
    // For other currencies, show text symbol
    return <span style={{ marginRight: '0.3em', fontWeight: '600' }}>{curr.symbol}</span>;
  };

  const getDisplayText = (country) => {
    const curr = currencyMapping[country];
    if (!curr) return country;
    return `${country} - ${curr.code}`;
  };

  const selectedCurrency = currencyMapping[value];

  return (
    <div className="currency-dropdown-container" ref={dropdownRef}>
      <div 
        className={`currency-dropdown-selected ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {value ? (
          <div className="currency-dropdown-value">
            {renderCurrencySymbol(value)}
            <span>{getDisplayText(value)}</span>
          </div>
        ) : (
          <span className="currency-dropdown-placeholder">Select Country for Currency...</span>
        )}
        <svg 
          className={`currency-dropdown-arrow ${isOpen ? 'open' : ''}`}
          width="12" 
          height="12" 
          viewBox="0 0 12 12" 
          fill="currentColor"
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      
      {isOpen && (
        <div className="currency-dropdown-menu">
          <div className="currency-dropdown-search">
            <input
              ref={searchRef}
              type="text"
              placeholder="Search country or currency..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="currency-dropdown-options">
            {filteredCountries.length === 0 ? (
              <div className="currency-dropdown-no-results">No currencies found</div>
            ) : (
              filteredCountries.map((country) => {
                const curr = currencyMapping[country];
                return (
                  <div
                    key={country}
                    className={`currency-dropdown-option ${value === country ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(country);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                  >
                    {renderCurrencySymbol(country)}
                    <span className="currency-country-name">{country}</span>
                    <span className="currency-code">({curr.code})</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Settings = () => {
  const { user, token, updatePreferences, refreshUser } = useAuth();
  const { companyCurrency: globalCurrency, setCurrencyByCountry, setCompanyCurrency: setGlobalCurrency } = useCurrency();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('company');
  
  // Check for active tab in location state
  useEffect(() => {
    if (location.state && location.state.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location]);
  
  // Company settings
  const [companyName, setCompanyName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [currentLogo, setCurrentLogo] = useState(null);
  const [selectedCurrencyCountry, setSelectedCurrencyCountry] = useState('United Arab Emirates');
  
  // Division settings
  const [divisions, setDivisions] = useState([]);
  const [divisionBackups, setDivisionBackups] = useState([]);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoreNewCode, setRestoreNewCode] = useState('');
  const [restoreNewName, setRestoreNewName] = useState('');
  const [restoring, setRestoring] = useState(false);
  
  // User preferences
  const [userDivisions, setUserDivisions] = useState([]);
  const [defaultDivision, setDefaultDivision] = useState('');
  const [divisionNames, setDivisionNames] = useState({});
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    // Only load data if user AND token are available (auth fully initialized)
    if (user && token) {
      loadAllData();
    }
  }, [user, token]);

  const loadAllData = async () => {
    const loadedDivisions = await loadSettings();
    await loadUserPreferences(loadedDivisions);
  };

  const loadSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/settings/company`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (response.data.success) {
        const settings = response.data.settings;
        setCompanyName(settings.companyName || '');
        setCurrentLogo(settings.logoUrl);
        setDivisions(settings.divisions || []);
        
        // Load currency setting
        if (settings.currency && settings.currency.country) {
          setSelectedCurrencyCountry(settings.currency.country);
          setGlobalCurrency(settings.currency);
        }
        
        // Load division names
        const divs = settings.divisions || [];
        const nameMap = {};
        divs.forEach(div => {
          nameMap[div.code] = div.name;
        });
        setDivisionNames(nameMap);
        
        return settings.divisions || [];
      }
      return [];
    } catch (error) {
      console.error('Error loading settings:', error);
      return [];
    }
  };
  const loadUserPreferences = async (loadedDivisions = []) => {
    // ALWAYS set user divisions first, regardless of auth status
    if (user?.role === 'admin') {
      // For admin, use all divisions from loaded settings
      const divCodes = loadedDivisions.map(d => d.code).filter(code => code);
      setUserDivisions(divCodes);
    } else {
      // For regular users, use their assigned divisions
      setUserDivisions(user?.divisions || []);
    }
    
    // Now try to load preferences (requires auth)
    // Token is now from React state, guaranteed to be in sync
    try {
      if (!token) {
        console.log('No auth token, skipping preferences load');
        return;
      }
      
      const response = await axios.get(`${API_BASE_URL}/api/auth/preferences`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setDefaultDivision(response.data.preferences.default_division || '');
      }
      
      // Load backups for admin (only if we have a valid token)
      if (user?.role === 'admin') {
        await loadDivisionBackups();
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const loadDivisionBackups = async () => {
    try {
      if (!token) {
        console.log('No token for backup loading');
        return;
      }
      const response = await axios.get(`${API_BASE_URL}/api/settings/division-backups`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setDivisionBackups(response.data.backups || []);
      }
    } catch (error) {
      console.error('Error loading division backups:', error);
    }
  };

  const handleRestoreDivision = async () => {
    if (!selectedBackup) return;
    
    setRestoring(true);
    setMessage({ type: '', text: '' });
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/settings/restore-division`, {
        backupFolder: selectedBackup.folderName,
        newCode: restoreNewCode || null,
        newName: restoreNewName || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setMessage({ 
          type: 'success', 
          text: `Division ${response.data.result.divisionCode} restored! ${response.data.result.tablesRestored} tables, ${response.data.result.rowsRestored} rows.` 
        });
        setShowRestoreModal(false);
        setSelectedBackup(null);
        setRestoreNewCode('');
        setRestoreNewName('');
        // Reload settings to show new division
        await loadAllData();
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to restore division' 
      });
    } finally {
      setRestoring(false);
    }
  };

  const openRestoreModal = (backup) => {
    setSelectedBackup(backup);
    setRestoreNewCode('');
    setRestoreNewName('');
    setShowRestoreModal(true);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Please select an image file' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
        return;
      }

      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setLogoPreview(reader.result);
      reader.readAsDataURL(file);
      setMessage({ type: '', text: '' });
    }
  };

  const handleSaveCompanySettings = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('companyName', companyName);
      if (logoFile) {
        formData.append('logo', logoFile);
      }
      
      // Add currency if selected
      if (selectedCurrencyCountry && currencyMapping[selectedCurrencyCountry]) {
        const currencyData = {
          country: selectedCurrencyCountry,
          ...currencyMapping[selectedCurrencyCountry]
        };
        formData.append('currency', JSON.stringify(currencyData));
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/settings/company`,
        formData,
        {
          headers: { 
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Company settings saved successfully!' });
        setCurrentLogo(response.data.settings.logoUrl);
        setLogoFile(null);
        setLogoPreview(null);
        
        // Update global currency context
        if (response.data.settings.currency) {
          setGlobalCurrency(response.data.settings.currency);
        }
        
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to save settings' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDivisions = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/settings/divisions`,
        { divisions },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        const { deleted, added } = response.data;
        let successMsg = 'Divisions saved successfully!';
        
        if (deleted && deleted.length > 0) {
          successMsg += ` Deleted: ${deleted.join(', ')}.`;
        }
        if (added && added.length > 0) {
          successMsg += ` Added: ${added.map(d => d.name).join(', ')}.`;
        }
        
        setMessage({ type: 'success', text: successMsg });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
        
        // Reload settings to update division names for My Preferences tab
        await loadSettings();
        
        // Reload user preferences to refresh default division options
        await loadUserPreferences();
        
        // Refresh user data to update divisions in header dropdown
        await refreshUser();
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to save divisions' 
      });
    } finally {
      setLoading(false);
    }
  };

  const addDivision = () => {
    setDivisions([...divisions, { code: '', name: '' }]);
  };

  const updateDivision = (index, field, value) => {
    const updated = [...divisions];
    updated[index][field] = value;
    setDivisions(updated);
  };

  const removeDivision = async (index) => {
    const division = divisions[index];
    
    // Check if it's an existing division (has data)
    if (division.code) {
      try {
        // Get impact analysis
        const response = await axios.get(
          `${API_BASE_URL}/api/settings/divisions/impact/${division.code}`
        );
        
        if (response.data.success) {
          const impact = response.data.impact;
          
          // Build detailed warning message
          let warningMessage = `⚠️ WARNING: Deleting Division "${division.name}" (${division.code})\n\n`;
          warningMessage += `═══════════════════════════════════════════\n\n`;
          warningMessage += `📋 WHAT WILL BE DELETED:\n\n`;
          
          warningMessage += `🗄️ ENTIRE DATABASE: "${division.code.toLowerCase()}_database"\n`;
          warningMessage += `   This includes ALL tables with all data:\n`;
          warningMessage += `   • main_data (financial records)\n`;
          warningMessage += `   • budgets (budget data)\n`;
          warningMessage += `   • customer_insights (customer analytics)\n`;
          warningMessage += `   • sales_reps (sales representatives)\n`;
          warningMessage += `   • And all other division tables\n\n`;
          
          if (impact.affectedUsers > 0 || impact.usersWithDefault > 0) {
            warningMessage += `👥 USER ASSIGNMENTS:\n`;
            if (impact.affectedUsers > 0) {
              warningMessage += `   • ${impact.affectedUsers} user(s) will lose access to this division\n`;
            }
            if (impact.usersWithDefault > 0) {
              warningMessage += `   • ${impact.usersWithDefault} user(s) have this as default division (will be reset)\n`;
            }
            warningMessage += `\n`;
          }
          
          if (impact.hasMainData || impact.hasBudgetData) {
            warningMessage += `📊 DATA RECORDS:\n`;
            if (impact.hasMainData) {
              warningMessage += `   • ${impact.mainDataRecords.toLocaleString()} financial record(s)\n`;
            }
            if (impact.hasBudgetData) {
              warningMessage += `   • ${impact.budgetRecords.toLocaleString()} budget record(s)\n`;
            }
            warningMessage += `\n`;
          }
          
          if (impact.totalImpact === 0) {
            warningMessage = `Delete Division "${division.name}" (${division.code})?\n\n`;
            warningMessage += `📋 WHAT WILL BE DELETED:\n\n`;
            warningMessage += `🗄️ DATABASE: "${division.code.toLowerCase()}_database"\n`;
            warningMessage += `   (Currently empty - no data or users assigned)\n\n`;
            warningMessage += `This will remove the division and its database structure.\n\n`;
            warningMessage += `Continue with deletion?`;
          } else {
            warningMessage += `⛔ THIS ACTION CANNOT BE UNDONE!\n`;
            warningMessage += `   All data will be permanently lost.\n\n`;
            warningMessage += `═══════════════════════════════════════════\n\n`;
            warningMessage += `Type "DELETE" to confirm, or Cancel to abort.`;
            
            const userConfirmation = window.prompt(warningMessage);
            
            if (userConfirmation === 'DELETE') {
              setDivisions(divisions.filter((_, i) => i !== index));
              setMessage({ 
                type: 'success', 
                text: `Division "${division.name}" marked for deletion. Click "Save Divisions" to permanently delete the database.` 
              });
              return;
            } else if (userConfirmation !== null) {
              setMessage({ 
                type: 'error', 
                text: 'Deletion cancelled. You must type "DELETE" to confirm.' 
              });
              return;
            }
            return; // User cancelled
          }
          
          if (window.confirm(warningMessage)) {
            setDivisions(divisions.filter((_, i) => i !== index));
            setMessage({ 
              type: 'success', 
              text: `Division "${division.name}" marked for deletion. Click "Save Divisions" to confirm.` 
            });
          }
        }
      } catch (error) {
        console.error('Error checking division impact:', error);
        const warningMessage = `Delete division "${division.name}" (${division.code})?\n\n` +
          `⚠️ WARNING: Unable to check impact.\n\n` +
          `This will delete the entire "${division.code.toLowerCase()}_database" including:\n` +
          `• All tables and data\n` +
          `• User assignments\n` +
          `• All related records\n\n` +
          `Continue anyway?`;
        
        if (window.confirm(warningMessage)) {
          setDivisions(divisions.filter((_, i) => i !== index));
        }
      }
    } else {
      // New division not yet saved, just remove it
      setDivisions(divisions.filter((_, i) => i !== index));
    }
  };

  const handleSaveDefaultDivision = async (divisionCode = null) => {
    const codeToSave = divisionCode || defaultDivision;
    console.log('handleSaveDefaultDivision called, saving:', codeToSave);
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      console.log('Calling updatePreferences...');
      const result = await updatePreferences({
        default_division: codeToSave
      });
      console.log('updatePreferences result:', result);

      if (result.success) {
        if (divisionCode) {
          setDefaultDivision(divisionCode);
        }
        setMessage({ type: 'success', text: `Default division set to ${codeToSave}!` });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        console.error('updatePreferences failed:', result.error);
        setMessage({ type: 'error', text: result.error || 'Failed to save default division' });
      }
    } catch (error) {
      console.error('handleSaveDefaultDivision error:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to save default division' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getDivisionLabel = (code) => {
    return divisionNames[code] ? `${divisionNames[code]} (${code})` : code;
  };

  // Set default tab based on role - non-admin users go to periods tab
  useEffect(() => {
    if (user?.role !== 'admin' && activeTab === 'company') {
      setActiveTab('periods');
    }
  }, [user, activeTab]);

  // Reload settings when switching to company tab
  useEffect(() => {
    if (activeTab === 'company') {
      loadAllData();
    }
  }, [activeTab]);

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>{user?.role === 'admin' ? 'Company Settings' : 'My Settings'}</h1>
        <button onClick={() => window.location.href = '/dashboard'} className="btn-back-header">
          ← Back to Dashboard
        </button>
      </div>

      {/* Tabs */}
      <div className="settings-tabs">
        {user?.role === 'admin' && (
          <button 
            className={`tab-button ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => setActiveTab('company')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
            Company Info
          </button>
        )}
        <button 
          className={`tab-button ${activeTab === 'periods' ? 'active' : ''}`}
          onClick={() => setActiveTab('periods')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
          </svg>
          Period Configuration
        </button>
        <button 
          className={`tab-button ${activeTab === 'masterdata' ? 'active' : ''}`}
          onClick={() => setActiveTab('masterdata')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
            <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
            <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
          </svg>
          Master Data
        </button>
        <button 
          className={`tab-button ${activeTab === 'appearance' ? 'active' : ''}`}
          onClick={() => setActiveTab('appearance')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clipRule="evenodd" />
          </svg>
          Appearance
        </button>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-content">
        {/* Company Info Tab */}
        {activeTab === 'company' && (
          <div className="settings-section">
            <div className="company-info-grid">
              {/* Left Column - Company Name & Logo */}
              <div className="company-info-card">
                <div className="section-header">
                  <h2>Company Information</h2>
                  <p className="section-description">
                    Customize your company name and logo. This will appear in the header for all users.
                  </p>
                </div>

                <div className="form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="companyName">Company Name</label>
                    <input
                      type="text"
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Enter your company name"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group full-width">
                    <label htmlFor="companyCurrency">Company Currency</label>
                    <CurrencyDropdown
                      value={selectedCurrencyCountry}
                      onChange={setSelectedCurrencyCountry}
                      countries={getCountryList()}
                      currencyMapping={currencyMapping}
                    />
                    <p className="help-text">
                      This currency symbol will be used everywhere in the application for all amount-related figures.
                    </p>
                  </div>

                  <div className="form-group full-width">
                    <label>Company Logo</label>
                    <div className="logo-upload-section">
                      <div className="current-logo-preview">
                        {currentLogo || logoPreview ? (
                          <img 
                            src={logoPreview || currentLogo} 
                            alt="Company Logo" 
                            className="logo-preview-img"
                          />
                        ) : (
                          <div className="no-logo-preview">
                            <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                            <p>No logo uploaded</p>
                          </div>
                        )}
                      </div>

                      <div className="file-input-wrapper">
                        <label htmlFor="logo-upload" className="file-input-label">
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" />
                            <path d="M9 13h2v5a1 1 0 11-2 0v-5z" />
                          </svg>
                          Choose Image
                        </label>
                        <input
                          type="file"
                          id="logo-upload"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="file-input"
                        />
                        <span className="file-name">
                          {logoFile ? logoFile.name : 'No file selected'}
                        </span>
                      </div>

                      <p className="help-text">
                        Max 5MB. Formats: JPG, PNG, SVG, GIF. Recommended: Transparent PNG, 200-400px width
                      </p>
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    onClick={handleSaveCompanySettings}
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Saving...' : 'Save Company Settings'}
                  </button>
                </div>
              </div>

              {/* Right Column - Division Management */}
              {user?.role === 'admin' && (
                <div className="company-info-card division-management-card">
                  <div className="section-header">
                    <h2>Division Management</h2>
                    <p className="section-description">
                      Manage your company's divisions. Click the star to set your default division.
                    </p>
                  </div>

                  <div className="divisions-list">
                    {divisions.map((division, index) => (
                      <div key={index} className={`division-item ${defaultDivision === division.code ? 'is-default' : ''}`}>
                        <button
                          type="button"
                          className={`btn-set-default ${defaultDivision === division.code ? 'is-selected' : ''}`}
                          onClick={() => {
                            setDefaultDivision(division.code);
                            handleSaveDefaultDivision(division.code);
                          }}
                          title={defaultDivision === division.code ? 'Current default' : 'Set as default'}
                        >
                          {defaultDivision === division.code ? (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          )}
                        </button>
                        <div className="division-code-group">
                          <label>Code</label>
                          <input
                            type="text"
                            value={division.code}
                            onChange={(e) => updateDivision(index, 'code', e.target.value.toUpperCase())}
                            placeholder="FP"
                            maxLength="10"
                            className="form-input code-input"
                          />
                        </div>
                        <div className="division-name-group">
                          <label>Division Name</label>
                          <input
                            type="text"
                            value={division.name}
                            onChange={(e) => updateDivision(index, 'name', e.target.value)}
                            placeholder="Food Packaging"
                            className="form-input name-input"
                          />
                        </div>
                        <button
                          onClick={() => removeDivision(index)}
                          className="btn-remove-division"
                          title="Remove division"
                        >
                          <svg width="28" height="28" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  <button onClick={addDivision} className="btn-add-division">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Division
                  </button>

                  <div className="form-actions">
                    <button
                      onClick={handleSaveDivisions}
                      disabled={loading}
                      className="btn-primary"
                    >
                      {loading ? 'Saving...' : 'Save Divisions'}
                    </button>
                  </div>

                  {/* Import from Backup Section */}
                  {divisionBackups.length > 0 && (
                    <div className="backup-restore-section">
                      <div className="section-divider-line"></div>
                      <h3>Restore from Backup</h3>
                      <div className="backup-list">
                        {divisionBackups.slice(0, 3).map((backup, index) => (
                          <div key={index} className="backup-item">
                            <div className="backup-info">
                              <span className="backup-code">{backup.divisionCode}</span>
                              <span className="backup-date">
                                {new Date(backup.completedAt || backup.timestamp).toLocaleDateString()}
                              </span>
                              <span className="backup-stats">
                                {backup.totalTables} tables
                              </span>
                            </div>
                            <button
                              onClick={() => openRestoreModal(backup)}
                              className="btn-restore-small"
                              title="Restore this backup"
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Period Configuration Tab */}
        {activeTab === 'periods' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Period Configuration</h2>
              <p className="section-description">
                Configure the periods (Years, Months, Quarters) you want to see in the dashboard.
                {user?.role === 'admin' ? ' You can save these as global defaults or just for yourself.' : ' These settings will apply only to you.'}
              </p>
            </div>
            <PeriodConfiguration />
          </div>
        )}

        {/* Master Data Tab */}
        {activeTab === 'masterdata' && (
          <div className="settings-section master-data-section">
            <MasterDataSettings />
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="settings-section">
            <div className="section-header">
              <h2>Appearance Settings</h2>
              <p className="section-description">
                Customize the look and feel of your dashboard. Choose from 4 beautiful themes.
              </p>
            </div>
            <ThemeSelector />
          </div>
        )}
      </div>

      {/* Restore Division Modal */}
      {showRestoreModal && selectedBackup && (
        <div className="modal-overlay" onClick={() => setShowRestoreModal(false)}>
          <div className="modal-content restore-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Restore Division</h2>
              <button className="modal-close" onClick={() => setShowRestoreModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="backup-details">
                <h3>Backup Details</h3>
                <p><strong>Original Code:</strong> {selectedBackup.divisionCode}</p>
                <p><strong>Backup Date:</strong> {new Date(selectedBackup.completedAt || selectedBackup.timestamp).toLocaleString()}</p>
                <p><strong>Data:</strong> {selectedBackup.totalTables} tables, {selectedBackup.totalRows} rows</p>
                <p><strong>User Access:</strong> {selectedBackup.userAccess} users</p>
              </div>
              
              <div className="restore-options">
                <h3>Restore Options</h3>
                <p className="help-text">
                  Leave blank to use original values, or enter new code/name.
                </p>
                
                <div className="form-group">
                  <label>New Division Code (optional)</label>
                  <input
                    type="text"
                    value={restoreNewCode}
                    onChange={(e) => setRestoreNewCode(e.target.value.toUpperCase())}
                    placeholder={selectedBackup.divisionCode}
                    maxLength="4"
                    className="form-input"
                  />
                  <p className="field-hint">2-4 uppercase letters</p>
                </div>
                
                <div className="form-group">
                  <label>New Division Name (optional)</label>
                  <input
                    type="text"
                    value={restoreNewName}
                    onChange={(e) => setRestoreNewName(e.target.value)}
                    placeholder="Original name will be used"
                    className="form-input"
                  />
                </div>
              </div>
              
              <div className="warning-box">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>
                  {restoreNewCode && restoreNewCode !== selectedBackup.divisionCode 
                    ? 'User permissions will NOT be restored when using a different code.'
                    : 'This will create a new division with all the backed up data.'}
                </span>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowRestoreModal(false)}
                disabled={restoring}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleRestoreDivision}
                disabled={restoring}
              >
                {restoring ? 'Restoring...' : 'Restore Division'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
