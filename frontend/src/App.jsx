import React, { useState, useEffect } from 'react';
import { 
  Ticket as TicketIcon, 
  LayoutDashboard, 
  PlusCircle, 
  MessageSquare, 
  Paperclip, 
  User, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  ArrowLeft, 
  UserCheck, 
  CheckCircle2, 
  Play, 
  XCircle, 
  Download,
  Upload,
  LogOut,
  Lock
} from 'lucide-react';

// Configurations - Dynamic API Gateway Resolution for Local vs Cloud
const GATEWAY_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8080'
  : `${window.location.protocol}//${window.location.hostname}`;

const USER_SERVICE_URL = `${GATEWAY_URL}/api/users`;
const TICKET_SERVICE_URL = `${GATEWAY_URL}/api/tickets`;
const COMMENT_SERVICE_URL = `${GATEWAY_URL}/api/comments`;
const ATTACHMENT_SERVICE_URL = `${GATEWAY_URL}/api/attachments`;

export default function App() {
  // Authentication states
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authRole, setAuthRole] = useState('CUSTOMER');

  // Navigation: dashboard, tickets, create
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // List of agents (for assignment dropdown)
  const [agents, setAgents] = useState([]);

  // Tickets state
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketDetails, setTicketDetails] = useState(null);
  
  // Filtering & Search
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  // Dashboard Aggregations
  const [dashboardMetrics, setDashboardMetrics] = useState({
    statusCounts: { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CLOSED: 0 },
    priorityCounts: { LOW: 0, MEDIUM: 0, HIGH: 0 }
  });

  // Comments and Attachments
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [uploadFile, setUploadFile] = useState(null);

  // Form states for creating tickets
  const [createTitle, setCreateTitle] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createPriority, setCreatePriority] = useState('MEDIUM');
  const [createDescription, setCreateDescription] = useState('');

  // UI Toast notifications
  const [notification, setNotification] = useState(null);

  // Trigger metrics and agents fetch when user logs in
  useEffect(() => {
    if (currentUser) {
      fetchDashboard();
      fetchAgents();
    }
  }, [currentUser]);

  // Sync tickets list on tab select or filter change
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'AGENT' && activeTab === 'create') {
        setActiveTab('dashboard');
      } else if (activeTab === 'tickets') {
        fetchTickets();
      }
    }
  }, [activeTab, filterStatus, filterPriority, searchCategory, currentUser]);

  // Sync details when a ticket is opened
  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetails(selectedTicketId);
    }
  }, [selectedTicketId]);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!authUsername.trim() || !authPassword.trim()) {
      showNotification('Fields cannot be empty.', 'warning');
      return;
    }

    if (authMode === 'login') {
      try {
        const res = await fetch(`${USER_SERVICE_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: authUsername, password: authPassword })
        });

        if (res.ok) {
          const user = await res.json();
          setCurrentUser(user);
          localStorage.setItem('currentUser', JSON.stringify(user));
          showNotification(`Logged in successfully as ${user.username}!`, 'success');
          // Reset forms
          setAuthUsername('');
          setAuthPassword('');
        } else {
          const msg = await res.text();
          showNotification(msg || 'Invalid username or password', 'error');
        }
      } catch (err) {
        showNotification('User Service is offline. Loading mock dev user.', 'warning');
        // Offline developer fallback
        const mockUser = {
          id: authUsername === 'agent' ? 3 : 1,
          username: authUsername,
          email: `${authUsername}@support.com`,
          role: authUsername.toLowerCase().includes('agent') ? 'AGENT' : 'CUSTOMER'
        };
        setCurrentUser(mockUser);
        localStorage.setItem('currentUser', JSON.stringify(mockUser));
      }
    } else {
      // Register Mode
      try {
        const res = await fetch(`${USER_SERVICE_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: authUsername, 
            email: authEmail, 
            password: authPassword, 
            role: authRole 
          })
        });

        if (res.ok) {
          const created = await res.json();
          showNotification('Registration successful! Logging you in.', 'success');
          setCurrentUser(created);
          localStorage.setItem('currentUser', JSON.stringify(created));
          // Reset forms
          setAuthUsername('');
          setAuthEmail('');
          setAuthPassword('');
          setAuthRole('CUSTOMER');
        } else {
          const msg = await res.text();
          showNotification(msg || 'Registration failed.', 'error');
        }
      } catch (err) {
        showNotification('Registration service connection lost.', 'error');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setSelectedTicketId(null);
    setTickets([]);
    setAgents([]);
    setActiveTab('dashboard');
    showNotification('Logged out successfully.', 'info');
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch(`${USER_SERVICE_URL}?role=AGENT`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
      // fallback mock agents
      setAgents([
        { id: 3, username: 'agent_smith', role: 'AGENT' },
        { id: 4, username: 'agent_carter', role: 'AGENT' }
      ]);
    }
  };

  const fetchDashboard = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${TICKET_SERVICE_URL}/dashboard?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setDashboardMetrics(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard counts:', err);
    }
  };

  const fetchTickets = async () => {
    if (!currentUser) return;
    try {
      let url = `${TICKET_SERVICE_URL}?userId=${currentUser.id}`;
      const params = [];
      if (filterStatus) params.push(`status=${filterStatus}`);
      if (filterPriority) params.push(`priority=${filterPriority}`);
      if (searchCategory) params.push(`category=${searchCategory}`);
      if (params.length > 0) {
        url += `&${params.join('&')}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
      showNotification('Could not connect to Ticket Service.', 'error');
    }
  };

  const fetchTicketDetails = async (id) => {
    try {
      const ticketRes = await fetch(`${TICKET_SERVICE_URL}/${id}`);
      if (ticketRes.ok) {
        const ticketData = await ticketRes.json();
        setTicketDetails(ticketData);
      }

      const commentsRes = await fetch(`${COMMENT_SERVICE_URL}/ticket/${id}`);
      if (commentsRes.ok) {
        const commentsData = await commentsRes.json();
        setComments(commentsData);
      }

      const attachmentsRes = await fetch(`${ATTACHMENT_SERVICE_URL}/ticket/${id}`);
      if (attachmentsRes.ok) {
        const attachmentsData = await attachmentsRes.json();
        setAttachments(attachmentsData);
      }
    } catch (err) {
      console.error('Error fetching ticket details:', err);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const payload = {
      title: createTitle,
      description: createDescription,
      category: createCategory,
      priority: createPriority,
      createdById: currentUser.id
    };

    try {
      const res = await fetch(TICKET_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showNotification('Ticket submitted successfully!', 'success');
        setCreateTitle('');
        setCreateDescription('');
        setCreateCategory('');
        setCreatePriority('MEDIUM');
        fetchDashboard();
        setActiveTab('tickets');
      } else {
        const text = await res.text();
        showNotification(`Could not create ticket: ${text}`, 'error');
      }
    } catch (err) {
      showNotification('Service connection failure.', 'error');
    }
  };

  const handleStatusTransition = async (newStatus) => {
    try {
      const res = await fetch(`${TICKET_SERVICE_URL}/${selectedTicketId}/status?newStatus=${newStatus}`, {
        method: 'PUT'
      });
      if (res.ok) {
        showNotification(`Status updated to ${newStatus}`, 'success');
        fetchTicketDetails(selectedTicketId);
        fetchDashboard();
      } else {
        const text = await res.text();
        showNotification(`Failed transition: ${text}`, 'error');
      }
    } catch (err) {
      showNotification('Service connection issue.', 'error');
    }
  };

  const handleAssignAgent = async (agentId) => {
    try {
      const res = await fetch(`${TICKET_SERVICE_URL}/${selectedTicketId}/assign?agentId=${agentId}`, {
        method: 'PUT'
      });
      if (res.ok) {
        showNotification(`Ticket assigned successfully`, 'success');
        fetchTicketDetails(selectedTicketId);
      } else {
        const text = await res.text();
        showNotification(`Failed assignment: ${text}`, 'error');
      }
    } catch (err) {
      showNotification('Service connection issue.', 'error');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const payload = {
      ticketId: selectedTicketId,
      userId: currentUser.id,
      commentText: newComment
    };

    try {
      const res = await fetch(COMMENT_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewComment('');
        fetchTicketDetails(selectedTicketId);
      } else {
        const text = await res.text();
        showNotification(`Comment blocked: ${text}`, 'error');
      }
    } catch (err) {
      showNotification('Comment service connection issue.', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      const presignedRes = await fetch(`${ATTACHMENT_SERVICE_URL}/presigned-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: selectedTicketId,
          fileName: uploadFile.name
        })
      });

      if (!presignedRes.ok) {
        const text = await presignedRes.text();
        showNotification(`Failed upload setup: ${text}`, 'error');
        return;
      }

      const { uploadUrl } = await presignedRes.json();

      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result;
        
        try {
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': uploadFile.type || 'application/octet-stream'
            },
            body: arrayBuffer
          });

          if (uploadRes.ok) {
            showNotification('Attachment uploaded successfully!', 'success');
            setUploadFile(null);
            fetchTicketDetails(selectedTicketId);
          } else {
            showNotification('Failed to upload file to S3 simulator.', 'error');
          }
        } catch (uploadErr) {
          showNotification('Upload connection lost.', 'error');
        }
      };

      reader.readAsArrayBuffer(uploadFile);

    } catch (err) {
      showNotification('Attachment Service connection issue.', 'error');
    }
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return;
    try {
      const res = await fetch(`${ATTACHMENT_SERVICE_URL}/${attachmentId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showNotification('Attachment deleted successfully', 'success');
        fetchTicketDetails(selectedTicketId);
      } else {
        const text = await res.text();
        showNotification(`Delete failed: ${text}`, 'error');
      }
    } catch (err) {
      showNotification('Attachment service connection issue.', 'error');
    }
  };

  const totalTicketsCount = Object.values(dashboardMetrics.statusCounts).reduce((a, b) => a + b, 0);

  // Authentication Guard Screen
  if (!currentUser) {
    return (
      <div className="app-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {notification && (
          <div className={`toast-notification toast-${notification.type} animate-fade-in`}>
            <AlertCircle size={18} />
            <span className="toast-message">{notification.message}</span>
          </div>
        )}

        <div className="form-panel-wrapper animate-fade-in" style={{ width: '100%', maxWidth: '440px' }}>
          <div className="glass-panel form-panel">
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div className="logo-box" style={{ display: 'inline-flex', marginBottom: '16px' }}>
                <TicketIcon size={24} />
              </div>
              <h2 className="form-panel-title">{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
              <p className="form-panel-subtitle">{authMode === 'login' ? 'Access your IT Support Ticket Desk' : 'Register a new support profile'}</p>
            </div>

            <form onSubmit={handleAuthSubmit} className="form-form">
              <div className="form-field">
                <label className="form-field-label">Username</label>
                <input 
                  type="text" 
                  placeholder="Enter your username..." 
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  style={{ marginTop: 0 }}
                  required
                />
              </div>

              {authMode === 'register' && (
                <>
                  <div className="form-field">
                    <label className="form-field-label">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="e.g. name@company.com" 
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      style={{ marginTop: 0 }}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-field-label">Profile Role</label>
                    <select 
                      value={authRole}
                      onChange={(e) => setAuthRole(e.target.value)}
                      style={{ marginTop: 0 }}
                    >
                      <option value="CUSTOMER">Customer (Employee)</option>
                      <option value="AGENT">Support Agent (IT Specialist)</option>
                    </select>
                  </div>
                </>
              )}

              <div className="form-field">
                <label className="form-field-label">Password</label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  style={{ marginTop: 0 }}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>
                {authMode === 'login' ? 'Sign In' : 'Register Account'}
              </button>

              <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {authMode === 'login' ? (
                  <span>Don't have an account? <a href="#" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setAuthMode('register'); }}>Sign Up</a></span>
                ) : (
                  <span>Already have an account? <a href="#" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }} onClick={(e) => { e.preventDefault(); setAuthMode('login'); }}>Sign In</a></span>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated Main Workspace Layout
  return (
    <div className="app-container">
      {/* Toast Notification Alert */}
      {notification && (
        <div className={`toast-notification toast-${notification.type} animate-fade-in`}>
          <AlertCircle size={18} />
          <span className="toast-message">{notification.message}</span>
        </div>
      )}

      {/* Main App Header */}
      <header className="app-header">
        <div className="header-logo">
          <div className="logo-box">
            <TicketIcon size={18} />
          </div>
          <div>
            <h1 className="logo-text">
              TICKETDESK ✦ <span className="logo-sub">PORTAL</span>
            </h1>
          </div>
        </div>

        {/* User Identity Badging & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="profile-selector">
            <div className="profile-label">
              <User size={13} className="text-indigo-400" />
              <span>Logged in as: <strong style={{ color: '#fff', marginLeft: '4px' }}>{currentUser.username} ({currentUser.role})</strong></span>
            </div>
          </div>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '8px 14px', fontSize: '0.7rem' }}
            onClick={handleLogout}
          >
            <LogOut size={12} style={{ marginRight: '4px' }} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Layout Grid */}
      <div className="workspace-layout">
        {/* Navigation Sidebar */}
        <aside className="app-sidebar">
          <p className="sidebar-title">Navigation</p>
          
          <button 
            onClick={() => { setActiveTab('dashboard'); setSelectedTicketId(null); fetchDashboard(); }}
            className={`sidebar-btn ${activeTab === 'dashboard' ? 'sidebar-btn-active' : ''}`}
          >
            <LayoutDashboard size={16} />
            <span>Dashboard</span>
          </button>

          <button 
            onClick={() => { setActiveTab('tickets'); setSelectedTicketId(null); }}
            className={`sidebar-btn ${activeTab === 'tickets' ? 'sidebar-btn-active' : ''}`}
          >
            <TicketIcon size={16} />
            <span>All Tickets</span>
          </button>

          {currentUser.role === 'CUSTOMER' && (
            <button 
              onClick={() => { setActiveTab('create'); setSelectedTicketId(null); }}
              className={`sidebar-btn ${activeTab === 'create' ? 'sidebar-btn-active' : ''}`}
            >
              <PlusCircle size={16} />
              <span>Create Ticket</span>
            </button>
          )}
        </aside>

        {/* Content Body */}
        <main className="main-content">
          {selectedTicketId ? (
            /* ================== TICKET DETAILS VIEW ================== */
            <div className="animate-fade-in">
              <button 
                onClick={() => { setSelectedTicketId(null); fetchTickets(); }}
                className="back-btn"
              >
                <ArrowLeft size={12} />
                <span>BACK TO LIST</span>
              </button>

              {ticketDetails && (
                <div className="details-grid">
                  {/* Ticket Details & Discussion */}
                  <div className="space-y-6">
                    <div className="glass-panel detail-main-panel">
                      <div className="detail-header-row">
                        <div>
                          <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">ID: #{ticketDetails.id}</span>
                          <h2 className="text-2xl font-bold text-white mt-1 leading-snug">{ticketDetails.title}</h2>
                        </div>
                        <span className={`badge ${
                          ticketDetails.status === 'OPEN' ? 'badge-open' :
                          ticketDetails.status === 'IN_PROGRESS' ? 'badge-progress' :
                          ticketDetails.status === 'RESOLVED' ? 'badge-resolved' : 'badge-closed'
                        }`}>
                          {ticketDetails.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="detail-meta-bar">
                        <div className="detail-meta-item">
                          <span>Raised By:</span>
                          <strong>
                            {ticketDetails.createdBy ? ticketDetails.createdBy.username : `User #${ticketDetails.createdById}`}
                          </strong>
                        </div>
                        <div className="detail-meta-item">
                          <span>Assigned Agent:</span>
                          <strong className="text-indigo-300">
                            {ticketDetails.assignedTo ? ticketDetails.assignedTo.username : 'Unassigned'}
                          </strong>
                        </div>
                        <div className="detail-meta-item">
                          <span>Date:</span>
                          <strong>
                            {new Date(ticketDetails.createdAt).toLocaleString()}
                          </strong>
                        </div>
                        <div className="detail-meta-item">
                          <span>Category:</span>
                          <strong>{ticketDetails.category}</strong>
                        </div>
                      </div>

                      <div className="description-box">
                        <h4 className="description-title">Description Details</h4>
                        <p className="description-body whitespace-pre-line">{ticketDetails.description}</p>
                      </div>
                    </div>

                    {/* Discussions / Messages Chat */}
                    <div className="glass-panel discussion-panel">
                      <h3 className="discussion-title">
                        <MessageSquare size={16} className="text-indigo-400" />
                        <span>Message Exchange ({comments.length})</span>
                      </h3>

                      <div className="comments-timeline">
                        {comments.length === 0 ? (
                          <p className="text-xs text-gray-500 italic py-2" style={{ color: 'var(--text-muted)' }}>
                            No messages exchanged yet. Use the box below to start talking about your issue.
                          </p>
                        ) : (
                          comments.map((comment) => {
                            const isMe = comment.userId === currentUser.id;
                            return (
                              <div key={comment.id} className={`comment-wrapper ${isMe ? 'comment-wrapper-right' : 'comment-wrapper-left'}`}>
                                <div className={`comment-card ${isMe ? 'comment-card-right' : 'comment-card-left'}`}>
                                  <div className="comment-header">
                                    <span className="commenter-name" style={{ color: isMe ? '#c7d2fe' : '#a5b4fc' }}>
                                      {comment.user ? comment.user.username : `User #${comment.userId}`}
                                    </span>
                                    <span className="commenter-badge">
                                      {comment.user ? comment.user.role : 'CUSTOMER'}
                                    </span>
                                  </div>
                                  <p className="comment-text whitespace-pre-line">{comment.commentText}</p>
                                </div>
                                <span className="comment-time">{new Date(comment.createdAt).toLocaleString()}</span>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <form onSubmit={handleAddComment} className="comment-form">
                        <input 
                          type="text" 
                          placeholder="Type your message to talk about this issue..." 
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="text-xs"
                          required
                        />
                        <button type="submit" className="btn btn-primary">
                          Send
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Actions & Files sidebar */}
                  <div className="space-y-6">
                    {/* Status transition controller */}
                    <div className="glass-panel side-card">
                      <h3 className="side-card-title">Status Actions</h3>
                      <div className="status-indicator-row">
                        <span>Current Status:</span>
                        <span className="status-highlight-box">{ticketDetails.status}</span>
                      </div>

                      <div className="transition-button-stack">
                        {/* Claim Ticket: AGENT only if unassigned */}
                        {currentUser.role === 'AGENT' && !ticketDetails.assignedTo && (
                          <button 
                            onClick={() => handleAssignAgent(currentUser.id)}
                            className="btn btn-secondary transition-btn"
                            style={{ marginBottom: '8px' }}
                          >
                            <span>Claim Ticket (Assign to Me)</span>
                            <UserCheck size={12} />
                          </button>
                        )}

                        {/* Start Progress: AGENT only */}
                        {ticketDetails.status === 'OPEN' && currentUser.role === 'AGENT' && (
                          <button 
                            onClick={() => handleStatusTransition('IN_PROGRESS')}
                            className="btn btn-primary transition-btn"
                          >
                            <span>Start Progress</span>
                            <Play size={12} />
                          </button>
                        )}

                        {/* Resolve Ticket: AGENT only */}
                        {ticketDetails.status === 'IN_PROGRESS' && currentUser.role === 'AGENT' && (
                          <button 
                            onClick={() => handleStatusTransition('RESOLVED')}
                            className="btn transition-btn bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
                          >
                            <span>Mark Resolved</span>
                            <CheckCircle2 size={12} />
                          </button>
                        )}

                        {/* Close Ticket: AGENT only */}
                        {ticketDetails.status === 'RESOLVED' && currentUser.role === 'AGENT' && (
                          <button 
                            onClick={() => handleStatusTransition('CLOSED')}
                            className="btn transition-btn bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                          >
                            <span>Close Ticket</span>
                            <XCircle size={12} />
                          </button>
                        )}

                        {/* Message for closed tickets */}
                        {ticketDetails.status === 'CLOSED' && (
                          <div className="text-[10px] text-indigo-400 text-center italic bg-indigo-950/20 py-2.5 rounded-lg border border-indigo-900/30">
                            Ticket closed and resolved.
                          </div>
                        )}

                        {/* Message for Customer when waiting on agent */}
                        {currentUser.role === 'CUSTOMER' && (ticketDetails.status === 'OPEN' || ticketDetails.status === 'IN_PROGRESS') && (
                          <div className="text-[10px] text-amber-400 text-center italic bg-amber-950/10 py-2.5 rounded-lg border border-amber-900/20">
                            Awaiting support actions.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Support agent assignment panel removed */}

                    {/* S3 file uploads simulation */}
                    <div className="glass-panel side-card">
                      <h3 className="side-card-title flex-gap-2" style={{ display: 'flex', alignItems: 'center' }}>
                        <Paperclip size={14} />
                        <span>Attachments ({attachments.length})</span>
                      </h3>

                      <div className="attachments-list">
                        {attachments.length === 0 ? (
                          <p className="text-[10px] text-gray-500 italic">No attachments added.</p>
                        ) : (
                          attachments.map((file) => (
                            <div key={file.id} className="attachment-row">
                              <span className="attachment-name">{file.fileName}</span>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <a 
                                  href={file.fileUrl} 
                                  download 
                                  className="attachment-download-btn"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Download size={12} /> <span>Get</span>
                                </a>
                                {currentUser.role === 'AGENT' && (
                                  <button 
                                    onClick={() => handleDeleteAttachment(file.id)}
                                    className="btn btn-secondary"
                                    style={{ padding: '4px 8px', fontSize: '0.6rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <form onSubmit={handleFileUpload} className="upload-form-wrapper">
                        <label className="assign-select-label">Attach file (Simulate S3 Direct)</label>
                        <input 
                          type="file" 
                          onChange={(e) => setUploadFile(e.target.files[0])}
                          className="file-input"
                        />
                        {uploadFile && (
                          <button type="submit" className="btn btn-primary transition-btn" style={{ padding: '8px' }}>
                            <Upload size={12} />
                            <span>Upload to S3 Simulator</span>
                          </button>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'dashboard' ? (
            /* ================== DASHBOARD VIEW ================== */
            <div className="space-y-6">
              <div className="dashboard-title-bar">
                <div>
                  <h2 className="dashboard-title">System Summary</h2>
                  <p className="dashboard-subtitle">
                    {currentUser.role === 'CUSTOMER' 
                      ? 'Live metrics tracking your personal tickets' 
                      : 'Live metrics tracking all support system tickets'}
                  </p>
                </div>
                <button 
                  onClick={fetchDashboard}
                  className="btn btn-secondary"
                >
                  Refresh Dashboard
                </button>
              </div>

              {/* Counts Grid */}
              <div className="dashboard-metrics-grid">
                <div className="glass-panel metric-card metric-card-open">
                  <span className="metric-header">Open</span>
                  <span className="metric-val">{dashboardMetrics.statusCounts.OPEN || 0}</span>
                </div>

                <div className="glass-panel metric-card metric-card-progress">
                  <span className="metric-header">In Progress</span>
                  <span className="metric-val">{dashboardMetrics.statusCounts.IN_PROGRESS || 0}</span>
                </div>

                <div className="glass-panel metric-card metric-card-resolved">
                  <span className="metric-header">Resolved</span>
                  <span className="metric-val">{dashboardMetrics.statusCounts.RESOLVED || 0}</span>
                </div>

                <div className="glass-panel metric-card metric-card-closed">
                  <span className="metric-header">Closed</span>
                  <span className="metric-val">{dashboardMetrics.statusCounts.CLOSED || 0}</span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="dashboard-details-row">
                <div className="glass-panel distribution-card">
                  <h3 className="distribution-title">Priority Distribution</h3>
                  
                  <div className="priority-bar-stack">
                    <div className="bar-row">
                      <div className="bar-meta text-red-400">
                        <span>High Priority</span>
                        <span>{dashboardMetrics.priorityCounts.HIGH || 0}</span>
                      </div>
                      <div className="bar-bg">
                        <div 
                          className="bar-fill bar-fill-high" 
                          style={{ width: `${totalTicketsCount ? ((dashboardMetrics.priorityCounts.HIGH || 0) / totalTicketsCount) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="bar-row">
                      <div className="bar-meta text-amber-400">
                        <span>Medium Priority</span>
                        <span>{dashboardMetrics.priorityCounts.MEDIUM || 0}</span>
                      </div>
                      <div className="bar-bg">
                        <div 
                          className="bar-fill bar-fill-medium" 
                          style={{ width: `${totalTicketsCount ? ((dashboardMetrics.priorityCounts.MEDIUM || 0) / totalTicketsCount) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="bar-row">
                      <div className="bar-meta text-emerald-400">
                        <span>Low Priority</span>
                        <span>{dashboardMetrics.priorityCounts.LOW || 0}</span>
                      </div>
                      <div className="bar-bg">
                        <div 
                          className="bar-fill bar-fill-low" 
                          style={{ width: `${totalTicketsCount ? ((dashboardMetrics.priorityCounts.LOW || 0) / totalTicketsCount) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel monitor-card">
                  <div className="monitor-icon">
                    <TicketIcon size={24} />
                  </div>
                  <h3 className="distribution-title" style={{ border: 'none', padding: 0, margin: 0 }}>Help Desk Monitor</h3>
                  <p className="monitor-text">
                    You have <strong className="text-white">{totalTicketsCount}</strong> active tickets loaded. 
                    {currentUser.role === 'CUSTOMER' 
                      ? ' You are viewing your personal ticket metrics.' 
                      : ' You are viewing all system-wide tickets as an IT Support Agent.'}
                  </p>
                </div>
              </div>
            </div>
          ) : activeTab === 'tickets' ? (
            /* ================== TICKETS LIST VIEW ================== */
            <div className="space-y-6">
              <div>
                <h2 className="dashboard-title">Support Tickets</h2>
                <p className="dashboard-subtitle">
                  {currentUser.role === 'CUSTOMER'
                    ? 'Filter and edit your personal support tickets'
                    : 'Filter, assign, and edit active tickets across the system'}
                </p>
              </div>

              {/* Filtering Controls */}
              <div className="glass-panel filter-bar">
                <div className="search-input-wrapper">
                  <Search size={14} className="search-icon" />
                  <input 
                    type="text" 
                    placeholder="Search by category..." 
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                  />
                </div>

                <div className="filter-select-group">
                  <span>Status:</span>
                  <select 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div className="filter-select-group">
                  <span>Priority:</span>
                  <select 
                    value={filterPriority} 
                    onChange={(e) => setFilterPriority(e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="glass-panel table-panel">
                <table className="ticket-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Agent Assigned</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          No tickets found.
                        </td>
                      </tr>
                    ) : (
                      tickets.map((ticket) => (
                        <tr key={ticket.id}>
                          <td style={{ fontFamily: 'mono', color: 'var(--text-muted)' }}>#{ticket.id}</td>
                          <td style={{ fontWeight: 'bold', color: '#fff' }}>{ticket.title}</td>
                          <td>{ticket.category}</td>
                          <td>
                            <span className={`badge ${
                              ticket.priority === 'HIGH' ? 'badge-priority-high' :
                              ticket.priority === 'MEDIUM' ? 'badge-priority-medium' : 'badge-priority-low'
                            }`}>
                              {ticket.priority}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${
                              ticket.status === 'OPEN' ? 'badge-open' :
                              ticket.status === 'IN_PROGRESS' ? 'badge-progress' :
                              ticket.status === 'RESOLVED' ? 'badge-resolved' : 'badge-closed'
                            }`}>
                              {ticket.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            {ticket.assignedTo ? ticket.assignedTo.username : 'Unassigned'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              onClick={() => setSelectedTicketId(ticket.id)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.7rem' }}
                            >
                              Open Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ================== CREATE TICKET VIEW ================== */
            <div className="form-panel-wrapper">
              <div className="glass-panel form-panel">
                <h2 className="form-panel-title">Submit Support Request</h2>
                <p className="form-panel-subtitle">Raise a ticket to the database lifecycle queue</p>

                <form onSubmit={handleCreateTicket} className="form-form">
                  <div className="form-field">
                    <label className="form-field-label">Title</label>
                    <input 
                      type="text" 
                      placeholder="Short summary of the problem..." 
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-fields-row">
                    <div className="form-field">
                      <label className="form-field-label">Category</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Hardware, Email, Access" 
                        value={createCategory}
                        onChange={(e) => setCreateCategory(e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label className="form-field-label">Priority</label>
                      <select 
                        value={createPriority}
                        onChange={(e) => setCreatePriority(e.target.value)}
                      >
                        <option value="LOW">Low (Standard)</option>
                        <option value="MEDIUM">Medium (Urgent)</option>
                        <option value="HIGH">High (Critical Incident)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-field">
                    <label className="form-field-label">Description</label>
                    <textarea 
                      rows="5"
                      placeholder="Explain the issues, error context, reproduction details..." 
                      value={createDescription}
                      onChange={(e) => setCreateDescription(e.target.value)}
                      required
                    ></textarea>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
                    Submit Support Ticket
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
