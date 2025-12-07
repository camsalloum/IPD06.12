import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import PeriodConfiguration from './PeriodConfiguration';
import MasterDataSettings from './MasterDataSettings';
import ThemeSelector from './ThemeSelector';
import './Settings.css';

const Settings = () => {
  const { user, updatePreferences, refreshUser } = useAuth();
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
  
  // Division settings
  const [divisions, setDivisions] = useState([]);
  
  // User preferences
  const [userDivisions, setUserDivisions] = useState([]);
  const [defaultDivision, setDefaultDivision] = useState('');
  const [divisionNames, setDivisionNames] = useState({});
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    await loadSettings();
    await loadUserPreferences();
  };

  const loadSettings = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/settings/company`);
      if (response.data.success) {
        const settings = response.data.settings;
        setCompanyName(settings.companyName || '');
        setCurrentLogo(settings.logoUrl);
        setDivisions(settings.divisions || []);
        
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

  const loadUserPreferences = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/preferences`);
      if (response.data.success) {
        setDefaultDivision(response.data.preferences.default_division || '');
      }
      
      // Get user's accessible divisions from current divisions state
      if (user?.role === 'admin') {
        // For admin, get divisions from company settings (already loaded)
        const settingsResponse = await axios.get(`${API_BASE_URL}/api/settings/company`);
        if (settingsResponse.data.success) {
          const divCodes = (settingsResponse.data.settings.divisions || []).map(d => d.code).filter(code => code);
          setUserDivisions(divCodes);
        }
      } else {
        setUserDivisions(user?.divisions || []);
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
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

      const response = await axios.post(
        `${API_BASE_URL}/api/settings/company`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Company settings saved successfully!' });
        setCurrentLogo(response.data.settings.logoUrl);
        setLogoFile(null);
        setLogoPreview(null);
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
        { divisions }
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

  const handleSaveDefaultDivision = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await updatePreferences({
        default_division: defaultDivision
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Default division saved successfully!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      }
    } catch (error) {
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
                <div className="company-info-card">
                  <div className="section-header">
                    <h2>Division Management</h2>
                    <p className="section-description">
                      Manage your company's divisions. Each division needs a code and full name.
                    </p>
                  </div>

                  <div className="divisions-list">
                    {divisions.map((division, index) => (
                      <div key={index} className="division-item">
                        <div className="division-inputs">
                          <div className="form-group">
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
                          <div className="form-group flex-grow">
                            <label>Division Name</label>
                            <input
                              type="text"
                              value={division.name}
                              onChange={(e) => updateDivision(index, 'name', e.target.value)}
                              placeholder="Food Packaging"
                              className="form-input"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeDivision(index)}
                          className="btn-remove"
                          title="Remove division"
                        >
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>

                  <button onClick={addDivision} className="btn-add">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
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
                </div>
              )}
            </div>

            {/* Bottom Row - Default Division (Centered) */}
            <div className="default-division-container">
              <div className="company-info-card default-division-card">
                <div className="section-header">
                  <h2>Default Division</h2>
                  <p className="section-description">
                    Set your default division. This will be automatically selected when you login.
                  </p>
                </div>

                <div className="form-grid">
                  <div className="form-group full-width">
                    <label htmlFor="defaultDivision">Select Division</label>
                    <select
                      id="defaultDivision"
                      value={defaultDivision}
                      onChange={(e) => setDefaultDivision(e.target.value)}
                      className="form-input"
                    >
                      <option value="">-- Select a default division --</option>
                      {userDivisions.map(code => (
                        <option key={code} value={code}>
                          {getDivisionLabel(code)}
                        </option>
                      ))}
                    </select>
                    <p className="help-text">
                      Choose which division you want to see by default when you open the dashboard.
                    </p>
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    onClick={handleSaveDefaultDivision}
                    disabled={loading || !defaultDivision}
                    className="btn-primary"
                  >
                    {loading ? 'Saving...' : 'Save Default Division'}
                  </button>
                </div>
              </div>
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
    </div>
  );
};

export default Settings;
