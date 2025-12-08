import React, { createContext, useState, useContext, useCallback, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';

const ExcelDataContext = createContext();

export const useExcelData = () => useContext(ExcelDataContext);

export const ExcelDataProvider = ({ children }) => {
  const [excelData, setExcelData] = useState({});
  const [divisions, setDivisions] = useState([]);
  const [divisionMetadata, setDivisionMetadata] = useState([]);
  const [selectedDivision, setSelectedDivision] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const loadingRef = useRef(false);
  const divisionsLoadedRef = useRef(false);
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Load divisions from Settings API AND user's default division preference
  useEffect(() => {
    const loadDivisionsAndDefault = async () => {
      // Prevent duplicate loading
      if (divisionsLoadedRef.current) return;
      divisionsLoadedRef.current = true;
      
      try {
        // 1. Load available divisions from company settings
        const settingsResponse = await axios.get(`${API_BASE_URL}/api/settings/company`);
        if (!settingsResponse.data.success || !settingsResponse.data.settings.divisions) {
          console.error('Failed to load divisions from settings');
          return;
        }
        
        const providedDivisions = settingsResponse.data.settings.divisions;
        const divisionCodes = providedDivisions
          .map(d => d.code)
          .filter(Boolean);

        setDivisions(divisionCodes);
        setDivisionMetadata(providedDivisions);
        
        // 2. Try to load user's default division preference
        let userDefaultDivision = null;
        const token = localStorage.getItem('auth_token');
        
        if (token) {
          try {
            const prefsResponse = await axios.get(`${API_BASE_URL}/api/auth/preferences`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (prefsResponse.data.success && prefsResponse.data.preferences?.default_division) {
              userDefaultDivision = prefsResponse.data.preferences.default_division;
            }
          } catch (prefError) {
            console.log('Could not load user preferences, using first division');
          }
        }
        
        // 3. Set division: user's preference if valid, otherwise first available
        if (userDefaultDivision && divisionCodes.includes(userDefaultDivision)) {
          setSelectedDivision(userDefaultDivision);
          console.log(`✅ Loaded user's default division: ${userDefaultDivision}`);
        } else if (divisionCodes.length > 0) {
          setSelectedDivision(divisionCodes[0]);
          console.log(`✅ Using first available division: ${divisionCodes[0]}`);
        }
      } catch (error) {
        console.error('Error loading divisions:', error);
      }
    };
    
    loadDivisionsAndDefault();
  }, [API_BASE_URL]);
  
  // Function to load Excel file for a specific division
  const loadExcelData = useCallback(async (division = null) => {
    // Use provided division or fall back to selectedDivision
    const targetDivision = division || selectedDivision;
    
    if (!targetDivision) {
      console.log('No division selected, skipping Excel load');
      return;
    }
    
    // Prevent loading if we're already loading
    if (loadingRef.current) {
      return;
    }
    
    const url = `/api/financials/${targetDivision.toLowerCase()}.xlsx`;
    console.log(`Loading Excel data for division ${targetDivision} from:`, url);
    
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(url);
      
      if (!res.ok) {
        if (res.status === 404) {
          // Excel file not found for this division
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || `No financial data available for division ${targetDivision}`);
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const buffer = await res.arrayBuffer();
      
      if (buffer.byteLength === 0) {
        throw new Error('Received empty file');
      }
      
      // Parse Excel data using xlsx library
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      console.log('Workbook sheets:', workbook.SheetNames);
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in Excel file');
      }
      
      // Get all sheet names - but divisions now come from Settings API, not Excel sheets
      const sheetNames = workbook.SheetNames;
      
      // Convert sheets to JSON
      const parsedData = {};
      sheetNames.forEach(name => {
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
        if (!sheetData || sheetData.length === 0) {
          // console.warn(`Warning: Sheet ${name} is empty`);
        }
        parsedData[name] = sheetData;
      });
      
      setExcelData(parsedData);
      setDataLoaded(true);
      
      return parsedData;
    } catch (err) {
      console.error('Error loading Excel data:', err);
      setError('Failed to load Excel data: ' + err.message);
      throw err; // Re-throw to allow component to handle the error
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [selectedDivision]);
  
  // Auto-load Excel data when division changes
  useEffect(() => {
    if (selectedDivision) {
      loadExcelData(selectedDivision);
    }
  }, [selectedDivision, loadExcelData]);
  
  const divisionNameMap = useMemo(() => {
    return divisionMetadata.reduce((acc, div) => {
      if (!div) return acc;
      const code = div.code || div.abbreviation;
      const name = div.name || div.displayName || code;
      if (code) {
        acc[code] = name;
      }
      if (div.abbreviation && !acc[div.abbreviation]) {
        acc[div.abbreviation] = name;
      }
      return acc;
    }, {});
  }, [divisionMetadata]);

  const getDivisionDisplayName = useCallback((code) => {
    if (!code) return '';
    if (divisionNameMap[code]) return divisionNameMap[code];
    const normalized = typeof code === 'string' && code.includes('-') ? code.split('-')[0] : code;
    if (divisionNameMap[normalized]) return divisionNameMap[normalized];
    const upperCode = typeof code === 'string' ? code.toUpperCase() : code;
    if (divisionNameMap[upperCode]) return divisionNameMap[upperCode];
    const upperNorm = typeof normalized === 'string' ? normalized.toUpperCase() : normalized;
    if (divisionNameMap[upperNorm]) return divisionNameMap[upperNorm];
    return normalized || code;
  }, [divisionNameMap]);

  // Values to expose in the context
  const value = {
    excelData,
    divisions,
    divisionMetadata,
    divisionNameMap,
    getDivisionDisplayName,
    selectedDivision,
    setSelectedDivision,
    loading,
    error,
    loadExcelData,
    dataLoaded
  };
  
  return (
    <ExcelDataContext.Provider value={value}>
      {children}
    </ExcelDataContext.Provider>
  );
}; 