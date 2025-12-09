import React, { useEffect } from 'react';
import { useExcelData } from '../../contexts/ExcelDataContext';
import axios from 'axios';

const DivisionSelector = () => {
  const { divisions, setSelectedDivision } = useExcelData();
  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    loadDefaultDivision();
  }, []);

  const loadDefaultDivision = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/auth/preferences`);
      if (response.data.success && response.data.preferences.default_division) {
        const defaultDiv = response.data.preferences.default_division;
        // Only set if user has access to this division
        if (divisions.includes(defaultDiv)) {
          setSelectedDivision(defaultDiv);
        }
      }
    } catch (error) {
      console.error('Error loading default division:', error);
    }
  };

  return null;
};

export default DivisionSelector;
