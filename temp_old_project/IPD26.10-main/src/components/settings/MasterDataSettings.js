import React, { useState, useEffect } from 'react';
import { useExcelData } from '../../contexts/ExcelDataContext';
import CountryReference from '../dashboard/CountryReference';
import MaterialPercentageManager from '../dashboard/MaterialPercentageManager';
import ProductGroupPricingManager from '../dashboard/ProductGroupPricingManager';
import AEBFTab from '../MasterData/AEBF/AEBFTab';
import CustomerMergingPage from '../MasterData/CustomerMerging/CustomerMergingPage';
import './MasterDataSettings.css';

const MasterDataSettings = () => {
  const { selectedDivision } = useExcelData();
  const [activeTab, setActiveTab] = useState('pricing');
  const [testMessage, setTestMessage] = useState('');

  // Sales Rep Management State
  const [availableReps, setAvailableReps] = useState([]);
  const [selectedReps, setSelectedReps] = useState([]);
  const [salesRepGroups, setSalesRepGroups] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAssignedReps, setShowAssignedReps] = useState(false);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    members: [],
    isEditing: false,
    originalName: ''
  });

  // Load sales rep data when division changes
  useEffect(() => {
    if (selectedDivision && activeTab === 'salesreps') {
      loadSalesRepData();
    }
  }, [selectedDivision, activeTab]);

  const loadSalesRepData = async () => {
    if (!selectedDivision) return;
    
    setLoading(true);
    let salesReps = [];
    
    try {
      const response = await fetch(`http://localhost:3001/api/sales-reps-universal?division=${selectedDivision}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          salesReps = data.data
            .filter(Boolean)
            .map(name => {
              if (!name) return name;
              return name.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
            });
          setAvailableReps(salesReps);
        } else {
          setAvailableReps([]);
        }
      } else {
        setAvailableReps([]);
      }

      const groupsResponse = await fetch(`http://localhost:3001/api/sales-rep-groups-universal?division=${selectedDivision}`);
      if (groupsResponse.ok) {
        const groupsData = await groupsResponse.json();
        const loadedGroups = groupsData.success ? groupsData.data : {};
        
        if (salesReps.length > 0) {
          const cleanedGroups = await cleanupOrphanedGroups(loadedGroups, salesReps);
          setSalesRepGroups(cleanedGroups);
        } else {
          setSalesRepGroups(loadedGroups);
        }
      } else {
        setSalesRepGroups({});
      }
    } catch (error) {
      console.error('Error loading sales rep data:', error);
      setTestMessage(`Error loading sales rep data: ${error.message}`);
      setAvailableReps([]);
      setSalesRepGroups({});
    } finally {
      setLoading(false);
    }
  };

  const cleanupOrphanedGroups = async (groups, currentSalesReps) => {
    if (!groups || Object.keys(groups).length === 0) return groups;
    
    const cleanedGroups = {};
    const groupsToDelete = [];
    const normalizedCurrentReps = currentSalesReps.map(rep => rep.toLowerCase().trim());
    
    for (const [groupName, members] of Object.entries(groups)) {
      const validMembers = members.filter(member => 
        normalizedCurrentReps.includes(member.toLowerCase().trim())
      );
      
      if (validMembers.length > 0) {
        cleanedGroups[groupName] = validMembers;
      } else {
        groupsToDelete.push(groupName);
      }
    }
    
    if (groupsToDelete.length > 0 || JSON.stringify(cleanedGroups) !== JSON.stringify(groups)) {
      try {
        for (const groupName of groupsToDelete) {
          await fetch(`http://localhost:3001/api/sales-rep-groups-universal?division=${selectedDivision}&groupName=${encodeURIComponent(groupName)}`, {
            method: 'DELETE',
          });
        }
        
        for (const [groupName, validMembers] of Object.entries(cleanedGroups)) {
          if (JSON.stringify(validMembers) !== JSON.stringify(groups[groupName])) {
            await fetch('http://localhost:3001/api/sales-rep-groups-universal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                division: selectedDivision,
                groupName: groupName,
                members: validMembers
              }),
            });
          }
        }
        
        if (groupsToDelete.length > 0) {
          setTestMessage(`🧹 Auto-cleanup: Removed ${groupsToDelete.length} group(s) with no valid members`);
          setTimeout(() => setTestMessage(''), 5000);
        }
      } catch (error) {
        console.error('Error during auto-cleanup:', error);
      }
    }
    
    return cleanedGroups;
  };

  // Sales Rep Group Management Functions
  const createSalesRepGroup = async () => {
    if (!groupFormData.name.trim() || groupFormData.members.length === 0) {
      setTestMessage('Please provide a group name and select at least one sales rep.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/sales-rep-groups-universal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          division: selectedDivision,
          groupName: groupFormData.name.trim(),
          members: groupFormData.members
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTestMessage(`✅ Sales rep group "${groupFormData.name}" created successfully!`);
        setGroupFormData({ name: '', members: [], isEditing: false, originalName: '' });
        setSelectedReps([]);
        await loadSalesRepData();
        setTimeout(() => setTestMessage(''), 3000);
      } else {
        throw new Error(result.message || 'Failed to create sales rep group');
      }
    } catch (error) {
      console.error('Error creating sales rep group:', error);
      setTestMessage(`❌ Error creating sales rep group: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteSalesRepGroup = async (groupName) => {
    if (!window.confirm(`Are you sure you want to delete the sales rep group "${groupName}"?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/api/sales-rep-groups-universal?division=${selectedDivision}&groupName=${encodeURIComponent(groupName)}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        setTestMessage(`✅ Sales rep group "${groupName}" deleted successfully!`);
        await loadSalesRepData();
        setTimeout(() => setTestMessage(''), 3000);
      } else {
        throw new Error(result.message || 'Failed to delete sales rep group');
      }
    } catch (error) {
      console.error('Error deleting sales rep group:', error);
      setTestMessage(`❌ Error deleting sales rep group: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const editSalesRepGroup = (groupName, members) => {
    setGroupFormData({
      name: groupName,
      members: members,
      isEditing: true,
      originalName: groupName
    });
  };

  const updateSalesRepGroup = async () => {
    if (!groupFormData.name.trim() || groupFormData.members.length === 0) {
      setTestMessage('Please provide a group name and select at least one sales rep.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/sales-rep-groups-universal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          division: selectedDivision,
          groupName: groupFormData.name.trim(),
          members: groupFormData.members,
          originalGroupName: groupFormData.originalName
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTestMessage(`✅ Sales rep group updated successfully!`);
        setGroupFormData({ name: '', members: [], isEditing: false, originalName: '' });
        setSelectedReps([]);
        await loadSalesRepData();
        setTimeout(() => setTestMessage(''), 3000);
      } else {
        throw new Error(result.message || 'Failed to update sales rep group');
      }
    } catch (error) {
      console.error('Error updating sales rep group:', error);
      setTestMessage(`❌ Error updating sales rep group: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setGroupFormData({ name: '', members: [], isEditing: false, originalName: '' });
    setSelectedReps([]);
  };

  const toggleSalesRepSelection = (repName) => {
    setSelectedReps(prev => {
      if (prev.includes(repName)) {
        return prev.filter(name => name !== repName);
      } else {
        return [...prev, repName];
      }
    });
  };

  const addSelectedRepsToGroup = () => {
    setGroupFormData(prev => ({
      ...prev,
      members: [...new Set([...prev.members, ...selectedReps])]
    }));
    setSelectedReps([]);
  };

  const removeRepFromGroup = (repName) => {
    setGroupFormData(prev => ({
      ...prev,
      members: prev.members.filter(name => name !== repName)
    }));
  };

  const getRepGroup = (repName) => {
    const normalizedRepName = repName.toLowerCase().trim();
    for (const [groupName, members] of Object.entries(salesRepGroups)) {
      if (members.some(member => member.toLowerCase().trim() === normalizedRepName)) {
        return groupName;
      }
    }
    return null;
  };

  const allGroupMembers = Object.values(salesRepGroups)
    .flat()
    .map(m => m.toLowerCase().trim());

  const unassignedReps = availableReps.filter(rep => !allGroupMembers.includes(rep.toLowerCase().trim()));
  const assignedReps = availableReps.filter(rep => allGroupMembers.includes(rep.toLowerCase().trim()));

  const filteredUnassignedReps = unassignedReps.filter(rep => 
    rep.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAssignedReps = assignedReps.filter(rep => 
    rep.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'pricing', label: 'Product Pricing', icon: '💹' },
    { id: 'materials', label: 'Material Percentages', icon: '📊' },
    { id: 'salesreps', label: 'Sales Rep Groups', icon: '🧑‍💼' },
    { id: 'countries', label: 'Country Reference', icon: '🌍' },
    { id: 'aebf', label: 'AEBF Data', icon: '📈' },
    { id: 'customer-merging', label: 'Customer Merging', icon: '🤖' },
  ];

  return (
    <div className="master-data-settings">
      <div className="master-data-header">
        <h2>📊 Master Data Management</h2>
        <p className="section-description">
          Manage your organization's master data including pricing, materials, sales reps, and more.
        </p>
      </div>

      {/* Sub-tabs navigation */}
      <div className="master-data-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`master-data-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="master-data-content">
        {/* Product Pricing Tab */}
        {activeTab === 'pricing' && (
          <ProductGroupPricingManager />
        )}

        {/* Material Percentages Tab */}
        {activeTab === 'materials' && (
          <MaterialPercentageManager />
        )}

        {/* Sales Rep Groups Tab */}
        {activeTab === 'salesreps' && (
          <div className="sales-rep-section">
            <h3>🧑‍💼 Sales Rep Groups for {selectedDivision || 'No Division Selected'}</h3>
            
            {!selectedDivision && (
              <div className="warning-banner">
                <strong>⚠️ Please select a division first</strong>
              </div>
            )}

            {selectedDivision && (
              <>
                {testMessage && (
                  <div className={`message-banner ${testMessage.includes('successfully') || testMessage.includes('✅') ? 'success' : 'error'}`}>
                    {testMessage}
                  </div>
                )}

                {/* Available Sales Reps Section */}
                <div className="available-reps-section">
                  <div className="section-header-bar">
                    <div className="section-icon">👥</div>
                    <div className="section-info">
                      <h4>Available Sales Reps</h4>
                      <p>{unassignedReps.length} unassigned • {assignedReps.length} already in groups</p>
                    </div>
                    <button
                      onClick={() => setShowAssignedReps(!showAssignedReps)}
                      className="toggle-btn"
                    >
                      {showAssignedReps ? '👁️ Hide Assigned' : '👁️‍🗨️ Show Assigned'}
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="search-container">
                    <span className="search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search sales reps..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="search-input"
                    />
                  </div>

                  {/* Sales Rep Cards Grid */}
                  <div className="reps-grid">
                    {filteredUnassignedReps.length === 0 && !showAssignedReps ? (
                      <div className="empty-state">
                        <div className="empty-icon">✅</div>
                        <p>All sales reps are assigned to groups</p>
                        <span>Click "Show Assigned" to see them</span>
                      </div>
                    ) : (
                      <>
                        {filteredUnassignedReps.map((rep) => {
                          const isSelected = selectedReps.includes(rep);
                          return (
                            <div
                              key={rep}
                              onClick={() => toggleSalesRepSelection(rep)}
                              className={`rep-card ${isSelected ? 'selected' : ''}`}
                            >
                              <div className="rep-avatar">👤</div>
                              <div className="rep-name">{rep}</div>
                              <div className={`rep-checkbox ${isSelected ? 'checked' : ''}`}>
                                {isSelected ? '✓' : ''}
                              </div>
                            </div>
                          );
                        })}

                        {showAssignedReps && filteredAssignedReps.map((rep) => {
                          const groupName = getRepGroup(rep);
                          const isSelected = selectedReps.includes(rep);
                          return (
                            <div
                              key={rep}
                              onClick={() => {
                                if (window.confirm(`"${rep}" is already in group "${groupName}". Do you want to move them to a different group?`)) {
                                  toggleSalesRepSelection(rep);
                                }
                              }}
                              className={`rep-card assigned ${isSelected ? 'selected-warning' : ''}`}
                            >
                              <div className="rep-avatar assigned">👤</div>
                              <div className="rep-info">
                                <div className="rep-name">{rep}</div>
                                <div className="rep-group">📁 {groupName}</div>
                              </div>
                              <div className="in-use-badge">{isSelected ? '⚠️' : 'In Use'}</div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* Add to Group Button */}
                  <div className="add-to-group-container">
                    <button
                      onClick={addSelectedRepsToGroup}
                      disabled={selectedReps.length === 0}
                      className={`add-to-group-btn ${selectedReps.length > 0 ? 'active' : ''}`}
                    >
                      ➕ Add to Group ({selectedReps.length} selected)
                    </button>
                  </div>
                </div>

                {/* Group Form */}
                <div className="group-form-section">
                  <h4>{groupFormData.isEditing ? 'Edit Group' : 'Create New Group'}</h4>
                  <div className="group-form">
                    <input
                      type="text"
                      placeholder="Group name"
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="group-name-input"
                    />
                    <button
                      onClick={groupFormData.isEditing ? updateSalesRepGroup : createSalesRepGroup}
                      disabled={loading}
                      className="save-group-btn"
                    >
                      {loading ? 'Saving...' : (groupFormData.isEditing ? 'Update' : 'Create')}
                    </button>
                    {groupFormData.isEditing && (
                      <button onClick={cancelEdit} className="cancel-btn">
                        Cancel
                      </button>
                    )}
                  </div>
                  
                  {groupFormData.members.length > 0 && (
                    <div className="group-members">
                      <h5>Group Members ({groupFormData.members.length}):</h5>
                      <div className="members-list">
                        {groupFormData.members.map(member => (
                          <span key={member} className="member-tag">
                            {member}
                            <button onClick={() => removeRepFromGroup(member)} className="remove-member">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Existing Groups */}
                <div className="existing-groups-section">
                  <div className="section-header-bar green">
                    <div className="section-icon">👥</div>
                    <div className="section-info">
                      <h4>Existing Groups</h4>
                      <p>{Object.keys(salesRepGroups).length} groups configured</p>
                    </div>
                  </div>
                  
                  {Object.keys(salesRepGroups).length === 0 ? (
                    <div className="empty-groups">
                      <div className="empty-icon">📁</div>
                      <p>No groups created yet</p>
                      <span>Create your first sales rep group above</span>
                    </div>
                  ) : (
                    <div className="groups-grid">
                      {Object.entries(salesRepGroups).map(([groupName, members]) => (
                        <div key={groupName} className="group-card">
                          <div className="group-header">
                            <div className="group-icon">👥</div>
                            <div className="group-info">
                              <h5>{groupName}</h5>
                              <p>{members.length} member{members.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="group-actions">
                              <button onClick={() => editSalesRepGroup(groupName, members)} className="edit-btn">
                                ✏️ Edit
                              </button>
                              <button onClick={() => deleteSalesRepGroup(groupName)} className="delete-btn">
                                🗑️ Delete
                              </button>
                            </div>
                          </div>
                          <div className="group-members-display">
                            {members.map((member) => (
                              <span key={member} className="member-badge">
                                👤 {member}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Country Reference Tab */}
        {activeTab === 'countries' && (
          <CountryReference />
        )}

        {/* AEBF Data Tab */}
        {activeTab === 'aebf' && (
          <AEBFTab />
        )}

        {/* Customer Merging Tab */}
        {activeTab === 'customer-merging' && (
          <CustomerMergingPage />
        )}
      </div>
    </div>
  );
};

export default MasterDataSettings;
