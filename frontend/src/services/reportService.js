// frontend/src/services/reportService.js
// API service for accessibility reports

import { API_URL } from '../config';

/**
 * Submit a new accessibility report
 * @param {Object} reportData - Report data
 * @param {number} reportData.lat - Latitude
 * @param {number} reportData.lng - Longitude
 * @param {string} reportData.location_name - Optional location name
 * @param {string} reportData.issue_type - Issue type from list
 * @param {string} reportData.custom_description - Required if issue_type is 'other'
 * @param {number} reportData.severity - 1-3 (mild, moderate, severe)
 * @returns {Promise<Object>} API response
 */
export async function submitReport(reportData) {
  const token = sessionStorage.getItem('accessToken');
  
  if (!token) {
    throw new Error('You must be logged in to submit a report');
  }
  
  const response = await fetch(`${API_URL}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(reportData)
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit report');
  }
  
  return data;
}

/**
 * Get list of reports (admin only)
 * @param {string} status - 'pending', 'approved', 'rejected', or 'all'
 * @param {number} limit - Results per page
 * @param {number} offset - Pagination offset
 * @returns {Promise<Object>} Reports list
 */
export async function getReports(status = 'pending', limit = 50, offset = 0) {
  const token = sessionStorage.getItem('accessToken');
  
  const response = await fetch(
    `${API_URL}/api/reports?status=${status}&limit=${limit}&offset=${offset}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch reports');
  }
  
  return data;
}

/**
 * Get single report details (admin only)
 * @param {number} reportId - Report ID
 * @returns {Promise<Object>} Report details
 */
export async function getReport(reportId) {
  const token = sessionStorage.getItem('accessToken');
  
  const response = await fetch(`${API_URL}/api/reports/${reportId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch report');
  }
  
  return data;
}

/**
 * Approve or reject a report (admin only)
 * @param {number} reportId - Report ID
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} adminNotes - Optional notes
 * @returns {Promise<Object>} API response
 */
export async function updateReportStatus(reportId, status, adminNotes = '') {
  const token = sessionStorage.getItem('accessToken');
  
  const response = await fetch(`${API_URL}/api/reports/${reportId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status, admin_notes: adminNotes })
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to update report');
  }
  
  return data;
}

/**
 * Get report statistics for admin dashboard
 * @returns {Promise<Object>} Statistics
 */
export async function getReportStats() {
  const token = sessionStorage.getItem('accessToken');
  
  const response = await fetch(`${API_URL}/api/reports/stats/summary`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch statistics');
  }
  
  return data;
}