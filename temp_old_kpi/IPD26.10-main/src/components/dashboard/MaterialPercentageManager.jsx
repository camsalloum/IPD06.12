import React, { useState, useEffect } from 'react';
import { useExcelData } from '../../contexts/ExcelDataContext';
import './MaterialPercentageManager.css';

const MaterialPercentageManager = () => {
  const { selectedDivision } = useExcelData();
  const [productGroups, setProductGroups] = useState([]);
  const [materialPercentages, setMaterialPercentages] = useState({});
  const [materialProcessData, setMaterialProcessData] = useState({}); // { productGroup: { material: '', process: '' } }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const materialColumns = ['PE', 'PP', 'PET', 'Alu', 'Paper', 'PVC/PET'];

  // Load product groups and material percentages when division changes
  useEffect(() => {
    if (selectedDivision) {
      loadData();
    }
  }, [selectedDivision]);

  const loadData = async () => {
    if (!selectedDivision) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Get division code from selectedDivision (handle both formats like 'FP' or 'FP-Product Group')
      const divisionCode = selectedDivision.split('-')[0].toLowerCase();
      
      // Check if this division is supported
      const supportedDivisions = ['fp', 'sb', 'tf', 'hcm'];
      if (!supportedDivisions.includes(divisionCode)) {
        setProductGroups([]);
        setMaterialPercentages({});
        setMessage(`📝 Note: Material percentage management for ${selectedDivision} division is not yet supported.`);
        return;
      }

      // Load product groups
      const productGroupsResponse = await fetch(`http://localhost:3001/api/${divisionCode}/master-data/product-groups`);
      const productGroupsResult = await productGroupsResponse.json();
      
      if (!productGroupsResult.success) {
        throw new Error(productGroupsResult.message || `Failed to load product groups for ${divisionCode.toUpperCase()}`);
      }
      
      const groups = productGroupsResult.data || [];
      setProductGroups(groups);

      // Initialize Material and Process for all product groups
      const initialMaterialProcess = {};
      groups.forEach(group => {
        if (!materialProcessData[group]) {
          initialMaterialProcess[group] = {
            material: '',
            process: ''
          };
        }
      });
      if (Object.keys(initialMaterialProcess).length > 0) {
        setMaterialProcessData(prev => ({ ...prev, ...initialMaterialProcess }));
      }

      // Load material percentages
      const percentagesResponse = await fetch(`http://localhost:3001/api/${divisionCode}/master-data/material-percentages`);
      const percentagesResult = await percentagesResponse.json();
      
      if (!percentagesResult.success) {
        throw new Error(percentagesResult.message || `Failed to load material percentages for ${divisionCode.toUpperCase()}`);
      }

      // Convert array to object for easier access
      const percentagesObj = {};
      const materialProcessObj = {};
      (percentagesResult.data || []).forEach(item => {
        percentagesObj[item.product_group] = {
          PE: parseFloat(item.pe_percentage) || 0,
          PP: parseFloat(item.bopp_percentage) || 0,
          PET: parseFloat(item.pet_percentage) || 0,
          Alu: parseFloat(item.alu_percentage) || 0,
          Paper: parseFloat(item.paper_percentage) || 0,
          'PVC/PET': parseFloat(item.pvc_pet_percentage) || 0
        };
        // Initialize Material and Process (will be loaded from API if available)
        materialProcessObj[item.product_group] = {
          material: item.material || '',
          process: item.process || ''
        };
      });
      
      setMaterialPercentages(percentagesObj);
      setMaterialProcessData(materialProcessObj);

    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePercentageChange = (productGroup, material, value) => {
    const numValue = parseFloat(value) || 0;
    
    setMaterialPercentages(prev => ({
      ...prev,
      [productGroup]: {
        ...prev[productGroup],
        [material]: numValue
      }
    }));
  };

  const handleMaterialChange = (productGroup, value) => {
    setMaterialProcessData(prev => ({
      ...prev,
      [productGroup]: {
        ...prev[productGroup],
        material: value
      }
    }));
  };

  const handleProcessChange = (productGroup, value) => {
    setMaterialProcessData(prev => ({
      ...prev,
      [productGroup]: {
        ...prev[productGroup],
        process: value
      }
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setMessage('');
    setError('');
    
    try {
      const divisionCode = selectedDivision.split('-')[0].toLowerCase();
      
      for (const productGroup of productGroups) {
        // Check if total is 100%
        const total = calculateRowTotal(productGroup);
        if (total !== 100) {
          setError(`⚠️ ${productGroup}: Total is ${total.toFixed(1)}%. Please adjust to 100% before saving.`);
          setSaving(false);
          return;
        }
        
        const response = await fetch(`http://localhost:3001/api/${divisionCode}/master-data/material-percentages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productGroup,
            percentages: materialPercentages[productGroup],
            material: materialProcessData[productGroup]?.material || '',
            process: materialProcessData[productGroup]?.process || ''
          }),
        });

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.message || `Failed to save ${productGroup}`);
        }
      }
      
      setMessage(`✅ All material percentages saved successfully`);
      setTimeout(() => setMessage(''), 3000);
      
    } catch (error) {
      console.error('Error saving all material percentages:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = () => {
    if (window.confirm('Are you sure you want to reset all product groups?')) {
      const resetValues = {};
      productGroups.forEach(productGroup => {
        resetValues[productGroup] = {};
        materialColumns.forEach(material => {
          resetValues[productGroup][material] = 0;
        });
      });
      
      setMaterialPercentages(resetValues);
      
      // Reset Material and Process
      const resetMaterialProcess = {};
      productGroups.forEach(productGroup => {
        resetMaterialProcess[productGroup] = {
          material: '',
          process: ''
        };
      });
      setMaterialProcessData(resetMaterialProcess);
      
      setMessage('All fields have been reset');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const saveProductGroupPercentages = async (productGroup) => {
    if (!materialPercentages[productGroup]) return;
    
    // Check if total is 100%
    const total = calculateRowTotal(productGroup);
    if (total !== 100) {
      setError(`⚠️ Total percentage is ${total.toFixed(1)}%. Please adjust to 100% before saving.`);
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    setSaving(true);
    setMessage('');
    setError('');
    
    try {
      const divisionCode = selectedDivision.split('-')[0].toLowerCase();
      
      const response = await fetch(`http://localhost:3001/api/${divisionCode}/master-data/material-percentages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productGroup,
          percentages: materialPercentages[productGroup],
          material: materialProcessData[productGroup]?.material || '',
          process: materialProcessData[productGroup]?.process || ''
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to save material percentages');
      }
      
      setMessage(`✅ Material percentages saved for ${productGroup}`);
      setTimeout(() => setMessage(''), 3000);
      
    } catch (error) {
      console.error('Error saving material percentages:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };


  const calculateRowTotal = (productGroup) => {
    if (!materialPercentages[productGroup]) return 0;
    
    const total = materialColumns.reduce((total, material) => {
      const value = materialPercentages[productGroup][material];
      return total + (typeof value === 'number' ? value : 0);
    }, 0);
    
    return typeof total === 'number' ? total : 0;
  };

  const resetRow = (productGroup) => {
    const resetValues = {};
    materialColumns.forEach(material => {
      resetValues[material] = 0;
    });
    
    setMaterialPercentages(prev => ({
      ...prev,
      [productGroup]: resetValues
    }));
    
    // Reset Material and Process
    setMaterialProcessData(prev => ({
      ...prev,
      [productGroup]: {
        material: '',
        process: ''
      }
    }));
  };

  if (loading) {
    return (
      <div className="material-percentage-container">
        <div className="loading-state">
          <p>Loading material percentages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="material-percentage-container">
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={loadData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="material-percentage-container">
      <div className="material-percentage-header">
        <h3>Material Percentages - {selectedDivision}</h3>
        <div className="header-actions">
          <button 
            onClick={handleSaveAll}
            disabled={saving}
            className="save-all-button"
          >
            Save All
          </button>
          <button 
            onClick={handleResetAll}
            className="reset-all-button"
          >
            Reset All
          </button>
          <button 
            onClick={loadData}
            disabled={loading}
            className="refresh-button"
          >
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className="message-bar success">
          {message}
        </div>
      )}

      {error && (
        <div className="message-bar error">
          {error}
        </div>
      )}

      {productGroups.length === 0 && !loading ? (
        <div className="coming-soon-state">
          <p>📝 {message}</p>
        </div>
      ) : (
        <div className="material-percentage-table-container">
          <table className="material-percentage-table">
            <thead>
              <tr>
                <th className="product-group-header">Product Group</th>
                {materialColumns.map(material => (
                  <th key={material} className="material-header">{material}</th>
                ))}
                <th className="total-header">Total</th>
                <th className="material-column-header">Material</th>
                <th className="process-header">Process</th>
              </tr>
            </thead>
            <tbody>
              {productGroups.map(productGroup => (
                <tr key={productGroup} className="product-row">
                  <td className="product-group-cell">{productGroup}</td>
                  {materialColumns.map(material => {
                    const value = materialPercentages[productGroup]?.[material] || 0;
                    return (
                      <td key={material} className="material-cell">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={value}
                            onChange={(e) => handlePercentageChange(productGroup, material, e.target.value)}
                            className="percentage-input"
                          />
                          <span className="percentage-symbol">%</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className={`total-cell ${calculateRowTotal(productGroup) === 100 ? 'total-correct' : 'total-incorrect'}`}>
                    {calculateRowTotal(productGroup).toFixed(1)}%
                  </td>
                  <td className="material-input-cell">
                    <input
                      type="text"
                      value={materialProcessData[productGroup]?.material || ''}
                      onChange={(e) => handleMaterialChange(productGroup, e.target.value)}
                      placeholder="Enter material"
                      className="material-process-input"
                    />
                  </td>
                  <td className="process-input-cell">
                    <input
                      type="text"
                      value={materialProcessData[productGroup]?.process || ''}
                      onChange={(e) => handleProcessChange(productGroup, e.target.value)}
                      placeholder="Enter process"
                      className="material-process-input"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MaterialPercentageManager;
