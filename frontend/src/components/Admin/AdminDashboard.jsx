// frontend/src/components/Admin/AdminDashboard.jsx
// Modern Admin Dashboard — Fully Responsive with clean icons, no gradients

import { useState, useEffect, useCallback } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { API_URL } from '../../config';
import './AdminDashboard.css';

// Clean SVG Icons - minimal, monochrome, no gradients
const Icons = {
  Dashboard: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Activity: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Logout: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Refresh: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
    </svg>
  ),
  TrendingUp: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  UsersIcon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  RouteIcon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  AlertIcon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  Menu: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Close: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  ChevronRight: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Flag: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Eye: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  MapPin: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
};

// Severity labels and colors
const SEVERITY_CONFIG = {
  1: { label: 'Mild', color: '#22c55e' },
  2: { label: 'Moderate', color: '#f59e0b' },
  3: { label: 'Severe', color: '#ef4444' }
};

const ISSUE_TYPE_LABELS = {
  blocked_ramp: 'Blocked Ramp',
  missing_curb: 'Missing Curb Cut',
  broken_surface: 'Broken / Uneven Surface',
  poor_lighting: 'Poor Lighting',
  construction: 'Construction / Road Closed',
  other: 'Other Issue'
};

export default function AdminDashboard() {
  const { getAuthHeader, logout, user } = useAuthContext();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [processingReport, setProcessingReport] = useState(null);
  const [showReportDetails, setShowReportDetails] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');

  const getHeaders = useCallback(() => {
    const token = sessionStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/reports?status=pending&limit=100`, {
        headers: getHeaders()
      });
      
      if (response.status === 401) {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        window.location.href = '/';
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('[Admin] Fetch reports error:', err);
    }
  }, [getHeaders]);

  const fetchData = useCallback(async () => {
    try {
      const headers = getHeaders();
      
      const [statsRes, usersRes, activityRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/admin/stats`, { headers }),
        fetch(`${API_URL}/admin/users`, { headers }),
        fetch(`${API_URL}/admin/activity`, { headers }),
        fetch(`${API_URL}/api/reports?status=pending&limit=100`, { headers })
      ]);
      
      if (statsRes.status === 401 || usersRes.status === 401 || activityRes.status === 401 || reportsRes.status === 401) {
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('user');
        window.location.href = '/';
        return;
      }
      
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const activityData = await activityRes.json();
      const reportsData = await reportsRes.json();
      
      const parsedActivity = (activityData.activity || []).map(item => {
        let parsedMeta = {};
        try {
          if (item.metadata) {
            parsedMeta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
          }
        } catch (e) {}
        return { ...item, parsedMetadata: parsedMeta };
      });
      
      setStats(statsData);
      setUsers(usersData.users || []);
      setActivity(parsedActivity);
      setReports(reportsData.reports || []);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      console.error('[Admin] Fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders]);

  const handleApproveReport = async (reportId, notes = '') => {
    setProcessingReport(reportId);
    try {
      const response = await fetch(`${API_URL}/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'approved', admin_notes: notes })
      });
      
      if (response.ok) {
        await fetchReports();
        setShowReportDetails(null);
        setAdminNotes('');
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to approve report');
      }
    } catch (err) {
      setError('Failed to approve report');
    } finally {
      setProcessingReport(null);
    }
  };

  const handleRejectReport = async (reportId, notes = '') => {
    setProcessingReport(reportId);
    try {
      const response = await fetch(`${API_URL}/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: 'rejected', admin_notes: notes })
      });
      
      if (response.ok) {
        await fetchReports();
        setShowReportDetails(null);
        setAdminNotes('');
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to reject report');
      }
    } catch (err) {
      setError('Failed to reject report');
    } finally {
      setProcessingReport(null);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatNumber = (num) => {
    if (!num || num === 0) return '0';
    if (num > 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num > 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getActivityDisplay = (activity) => {
    const meta = activity.parsedMetadata;
    switch (activity.activity_type) {
      case 'route_calculated':
        return `🗺️ Route: ${meta.start_location || '?'} → ${meta.end_location || '?'} (${meta.profile_used || 'standard'})`;
      case 'search':
        return `🔍 Searched: "${meta.query || '?'}" → ${meta.selected_result || '?'}`;
      case 'login':
        return `🔐 Logged in from ${meta.browser || 'device'}`;
      case 'register':
        return `📝 New user registered: ${meta.email || ''}`;
      default:
        return activity.activity_type;
    }
  };

  if (isLoading) {
    return (
      <div className="admin-loading">
        <div className="admin-loading-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <button 
        className="admin-mobile-menu-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <Icons.Close /> : <Icons.Menu />}
      </button>

      <aside className={`admin-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="#2563eb"/>
            </svg>
            <span>UG Navigator</span>
          </div>
          <p className="admin-sidebar-subtitle">Admin Portal</p>
        </div>
        
        <nav className="admin-nav">
          <button 
            className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => { setActiveTab('overview'); setMobileMenuOpen(false); }}
          >
            <Icons.Dashboard />
            <span>Overview</span>
          </button>
          <button 
            className={`admin-nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => { setActiveTab('reports'); setMobileMenuOpen(false); }}
          >
            <Icons.Flag />
            <span>Reports</span>
            {reports.length > 0 && <span className="report-badge">{reports.length}</span>}
          </button>
          <button 
            className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
          >
            <Icons.Users />
            <span>Users</span>
          </button>
          <button 
            className={`admin-nav-item ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => { setActiveTab('activity'); setMobileMenuOpen(false); }}
          >
            <Icons.Activity />
            <span>Activity</span>
          </button>
        </nav>
        
        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-user-avatar">
              {user?.username?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="admin-user-details">
              <span className="admin-user-name">{user?.username || 'Admin'}</span>
              <span className="admin-user-role">Administrator</span>
            </div>
          </div>
          <button onClick={logout} className="admin-logout-btn">
            <Icons.Logout />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-main-header">
          <div>
            <h1>
              {activeTab === 'overview' && 'Dashboard'}
              {activeTab === 'reports' && 'Accessibility Reports'}
              {activeTab === 'users' && 'User Management'}
              {activeTab === 'activity' && 'Activity Log'}
            </h1>
            <p>Welcome back, {user?.username || 'Admin'}</p>
          </div>
          <div className="admin-header-actions">
            <span className="admin-last-updated">
              Updated: {lastUpdated?.toLocaleTimeString() || '--:--:--'}
            </span>
            <button onClick={fetchData} className="admin-refresh-btn">
              <Icons.Refresh />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="admin-error">
            <Icons.AlertIcon />
            <span>{error}</span>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <div className="admin-stats-grid">
              <div className="stat-card">
                <div className="stat-card-icon blue">
                  <Icons.UsersIcon />
                </div>
                <div className="stat-card-content">
                  <span className="stat-card-value">{formatNumber(stats?.users?.total)}</span>
                  <span className="stat-card-label">Total Users</span>
                </div>
                <div className="stat-card-trend positive">
                  +{stats?.users?.newThisWeek || 0} this week
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-icon green">
                  <Icons.TrendingUp />
                </div>
                <div className="stat-card-content">
                  <span className="stat-card-value">{stats?.users?.activeToday || 0}</span>
                  <span className="stat-card-label">Active Today</span>
                </div>
                <div className="stat-card-trend">
                  {stats?.users?.activeWeek || 0} active this week
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-icon purple">
                  <Icons.RouteIcon />
                </div>
                <div className="stat-card-content">
                  <span className="stat-card-value">{stats?.routes?.today || 0}</span>
                  <span className="stat-card-label">Routes Today</span>
                </div>
                <div className="stat-card-trend">
                  {formatNumber(stats?.routes?.total)} total routes
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-card-icon orange">
                  <Icons.Flag />
                </div>
                <div className="stat-card-content">
                  <span className="stat-card-value">{reports.length}</span>
                  <span className="stat-card-label">Pending Reports</span>
                </div>
              </div>
            </div>

            <div className="admin-two-col">
              <div className="admin-card">
                <h3>Route Preferences</h3>
                <div className="profile-stats">
                  {stats?.profilePreferences?.length > 0 ? (
                    stats.profilePreferences.map((p) => (
                      <div key={p.profile_used} className="profile-bar">
                        <div className="profile-bar-header">
                          <span className="profile-name">{p.profile_used}</span>
                          <span className="profile-percent">
                            {stats.routes?.total ? ((p.count / stats.routes.total) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div 
                            className="progress-fill"
                            style={{ width: stats.routes?.total ? `${(p.count / stats.routes.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <div className="profile-count">{p.count} routes</div>
                      </div>
                    ))
                  ) : (
                    <div className="no-data">No route data yet. Users need to calculate routes.</div>
                  )}
                </div>
              </div>

              <div className="admin-card">
                <h3>Top Destinations</h3>
                <div className="destinations-list">
                  {stats?.topDestinations?.length > 0 ? (
                    stats.topDestinations.slice(0, 5).map((d, i) => (
                      <div key={d.end_location} className="destination-item">
                        <span className="destination-rank">{i + 1}</span>
                        <span className="destination-name">{d.end_location || 'Unknown'}</span>
                        <span className="destination-count">{d.count} trips</span>
                      </div>
                    ))
                  ) : (
                    <div className="no-data">No destination data yet</div>
                  )}
                </div>
              </div>
            </div>

            <div className="admin-card full-width">
              <h3>Recent Activity</h3>
              <div className="activity-timeline">
                {activity.slice(0, 10).map((a) => (
                  <div key={a.id} className="activity-item">
                    <div className="activity-dot" />
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-user">{a.username || a.email}</span>
                        <span className="activity-time">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <p className="activity-type">{getActivityDisplay(a)}</p>
                    </div>
                  </div>
                ))}
                {activity.length === 0 && (
                  <div className="no-data">No activity yet. Users need to interact with the app.</div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Reports Tab - NEW */}
        {activeTab === 'reports' && (
          <div className="admin-card full-width">
            <div className="admin-table-header">
              <h3>Pending Accessibility Reports</h3>
              <span className="admin-table-stats">{reports.length} reports awaiting review</span>
            </div>
            
            {reports.length === 0 ? (
              <div className="no-data">No pending reports. All clear! 🎉</div>
            ) : (
              <div className="reports-list">
                {reports.map((report) => (
                  <div key={report.id} className="report-card">
                    <div className="report-card-header">
                      <div className="report-id">Report #{report.id}</div>
                      <div 
                        className="report-severity" 
                        style={{ color: SEVERITY_CONFIG[report.severity]?.color }}
                      >
                        {SEVERITY_CONFIG[report.severity]?.label}
                      </div>
                    </div>
                    
                    <div className="report-card-body">
                      <div className="report-detail-row">
                        <Icons.MapPin className="report-icon" />
                        <span className="report-detail-label">Location:</span>
                        <span className="report-detail-value">
                          {report.lat?.toFixed(6)}, {report.lng?.toFixed(6)}
                        </span>
                      </div>
                      
                      <div className="report-detail-row">
                        <span className="report-detail-label">Issue:</span>
                        <span className="report-detail-value">
                          {ISSUE_TYPE_LABELS[report.issue_type] || report.issue_type}
                        </span>
                      </div>
                      
                      {report.location_name && (
                        <div className="report-detail-row">
                          <span className="report-detail-label">Place:</span>
                          <span className="report-detail-value">{report.location_name}</span>
                        </div>
                      )}
                      
                      {report.custom_description && (
                        <div className="report-detail-row">
                          <span className="report-detail-label">Description:</span>
                          <span className="report-detail-value report-description">
                            {report.custom_description}
                          </span>
                        </div>
                      )}
                      
                      <div className="report-detail-row">
                        <span className="report-detail-label">Reported:</span>
                        <span className="report-detail-value">
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    {showReportDetails === report.id && (
                      <div className="report-notes-section">
                        <label className="report-notes-label">Admin Notes (optional):</label>
                        <textarea
                          className="report-notes-input"
                          rows="2"
                          placeholder="Add notes about your decision..."
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                        />
                      </div>
                    )}
                    
                    <div className="report-card-actions">
                      <button
                        className="report-btn view-btn"
                        onClick={() => {
                          if (showReportDetails === report.id) {
                            setShowReportDetails(null);
                            setAdminNotes('');
                          } else {
                            setShowReportDetails(report.id);
                            setAdminNotes(report.admin_notes || '');
                          }
                        }}
                      >
                        <Icons.Eye />
                        {showReportDetails === report.id ? 'Hide Notes' : 'Add Notes'}
                      </button>
                      <button
                        className="report-btn approve-btn"
                        onClick={() => handleApproveReport(report.id, adminNotes)}
                        disabled={processingReport === report.id}
                      >
                        <Icons.Check />
                        {processingReport === report.id ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        className="report-btn reject-btn"
                        onClick={() => handleRejectReport(report.id, adminNotes)}
                        disabled={processingReport === report.id}
                      >
                        <Icons.X />
                        {processingReport === report.id ? 'Processing...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="admin-card full-width">
            <div className="admin-table-header">
              <h3>All Users</h3>
              <span className="admin-table-stats">{users.length} total users</span>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Joined</th>
                    <th>Routes</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar-small">
                            {u.username?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <span className="user-name">{u.username}</span>
                          {u.is_admin === 1 && <span className="admin-badge">Admin</span>}
                        </div>
                      </td>
                      <td className="user-email">{u.email}</td>
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="user-routes">{u.route_count || 0}</td>
                      <td>{u.last_active ? new Date(u.last_active).toLocaleDateString() : 'Never'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="admin-card full-width">
            <div className="admin-table-header">
              <h3>Full Activity Log</h3>
            </div>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Activity</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((a) => (
                    <tr key={a.id}>
                      <td data-label="User">{a.username || a.email}</td>
                      <td data-label="Activity">{getActivityDisplay(a)}</td>
                      <td data-label="Time">{new Date(a.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {activity.length === 0 && (
                    <tr>
                      <td colSpan="3" className="no-data">No activity recorded</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}