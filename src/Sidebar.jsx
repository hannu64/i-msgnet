import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [chats, setChats] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('chats')) || [];
    return stored;
  });
  const [newChatName, setNewChatName] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editNameInput, setEditNameInput] = useState('');
  const editInputRef = useRef(null);

  const isLoggedIn = !!localStorage.getItem('token');
  const currentUsername = localStorage.getItem('username') || '';
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedWarning, setAcceptedWarning] = useState(false);


  // NEW: Auth modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const handleChatsUpdate = () => {
      const stored = JSON.parse(localStorage.getItem('chats')) || [];
      setChats(stored);
    };
    window.addEventListener('chatsUpdated', handleChatsUpdate);
    return () => window.removeEventListener('chatsUpdated', handleChatsUpdate);
  }, []);

  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChatId]);

  const startEdit = (chat) => {
    setEditingChatId(chat.id);
    setEditNameInput(chat.name);
  };

  const saveEdit = (chatId) => {
    if (!editNameInput.trim()) {
      cancelEdit();
      return;
    }
    const updated = chats.map(c =>
      c.id === chatId ? { ...c, name: editNameInput.trim() } : c
    );
    setChats(updated);
    localStorage.setItem('chats', JSON.stringify(updated.map(c => ({ id: c.id, name: c.name }))));
    window.dispatchEvent(new Event('chatsUpdated'));
    cancelEdit();
  };

  const cancelEdit = () => {
    setEditingChatId(null);
    setEditNameInput('');
  };

  const handleKeyDown = (e, chatId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit(chatId);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const addChat = () => {
    if (!newChatName.trim()) return;
    const newChatId = Date.now().toString();
    const updated = [...chats, { id: newChatId, name: newChatName.trim() }];
    setChats(updated);
    localStorage.setItem('chats', JSON.stringify(updated.map(c => ({ id: c.id, name: c.name }))));
    setNewChatName('');
    navigate(`/chat/${newChatId}`);
  };

  const removeChat = (chatId) => {
    const chatName = chats.find(c => c.id === chatId)?.name || 'this chat';
    if (!window.confirm(`Are you sure you want to remove "${chatName}"?`)) return;
    const updated = chats.filter(c => c.id !== chatId);
    setChats(updated);
    localStorage.setItem('chats', JSON.stringify(updated.map(c => ({ id: c.id, name: c.name }))));
    localStorage.removeItem(`messages_${chatId}`);
    localStorage.removeItem(`key_${chatId}`);
    if (location.pathname === `/chat/${chatId}`) {
      navigate('/');
    }
  };

  return (
    <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px', overflowY: 'auto' }}>
      <h2>Chats</h2>
      <input
        type="text"
        value={newChatName}
        onChange={(e) => setNewChatName(e.target.value)}
        placeholder="New chat name"
        style={{ width: '100%', marginBottom: '10px' }}
      />
      <button onClick={addChat} style={{ width: '100%' }}>+ Add Chat</button>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px' }}>
        {chats.map((chat) => {
          const isEditing = editingChatId === chat.id;
          const safeName = (typeof chat.name === 'string' && chat.name.trim())
            ? chat.name
            : `Chat ${chat.id.slice(0, 8)}...`;
          const displayName = safeName.length > 28
            ? safeName.slice(0, 25) + '...'
            : safeName;
          return (
            <li
              key={chat.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginBottom: '12px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: location.pathname === `/chat/${chat.id}` ? '#f0f0f0' : 'transparent'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {isEditing ? (
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editNameInput}
                    onChange={(e) => setEditNameInput(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, chat.id)}
                    onBlur={() => saveEdit(chat.id)}
                    style={{
                      flex: 1,
                      padding: '4px 8px',
                      border: '1px solid #007bff',
                      borderRadius: '4px',
                      outline: 'none'
                    }}
                  />
                ) : (
                  <button
                    onClick={() => navigate(`/chat/${chat.id}`)}
                    title={safeName}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    {displayName}
                    {localStorage.getItem(`key_${chat.id}`) && <span style={{ color: 'green', marginLeft: '6px' }}>🔒</span>}
                  </button>
                )}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {!isEditing && (
                    <button
                      onClick={() => startEdit(chat)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#007bff',
                        cursor: 'pointer',
                        fontSize: '1.1em',
                        padding: '2px 6px'
                      }}
                      title="Rename chat"
                    >
                      ✏️
                    </button>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => saveEdit(chat.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#28a745',
                        cursor: 'pointer',
                        fontSize: '1.3em',
                        padding: '2px 6px'
                      }}
                      title="Save"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    onClick={() => removeChat(chat.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      fontSize: '1.3em',
                      padding: '2px 6px'
                    }}
                    title="Remove chat"
                  >
                    🗑
                  </button>
                </div>
              </div>
              {/* Simple sender-based preview */}
              <div style={{
                fontSize: '0.85em',
                color: '#666',
                marginTop: '4px',
                paddingLeft: '4px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {chat.preview}
              </div>
            </li>
          );
        })}
      </ul>


      {isLoggedIn ? (
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <p>Logged in as: <strong>{currentUsername}</strong></p>
          <button
            onClick={() => {
              if (window.confirm('Logout? You will need to login again to access My chats.')) {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                setShowAuthModal(false);
                window.location.reload();
              }
            }}
            style={{
              padding: '10px 20px',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            Logout
          </button>
        </div>

      ) : (

        <button
          onClick={() => setShowAuthModal(true)}
          style={{
            marginTop: '16px',
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            width: '100%'
          }}
        >
          Login / Create account
        </button>

      )}



      
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>
              {authMode === 'login' ? 'Login' : 'Create Account'}
            </h3>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (min 5 chars)"
              style={{ width: '100%', padding: '10px', marginBottom: '12px', borderRadius: '6px' }}
            />



          {/* Password */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={{ width: '100%', padding: '10px 40px 10px 10px', borderRadius: '6px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                fontSize: '1.2em',
                cursor: 'pointer',
                color: '#555'
              }}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          {/* Confirm password (only register) */}
          {authMode === 'register' && (
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                style={{ width: '100%', padding: '10px 40px 10px 10px', borderRadius: '6px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.2em',
                  cursor: 'pointer',
                  color: '#555'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          )}





            {authError && <p style={{ color: '#dc3545', marginBottom: '16px' }}>{authError}</p>}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAuthModal(false);
                  setAuthError('');
                  setUsername('');
                  setPassword('');
                }}
                style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px' }}
              >
                Cancel
              </button>

              <button
                onClick={async () => {

                  if (authMode === 'register') {

                    if (username.length < 5) {
                      setAuthError('Username must be at least 5 characters');
                      return;
                    }
                    if (password.length < 10) {
                      setAuthError('Password must be at least 10 characters');
                      return;
                    }
                    if (password !== confirmPassword) {
                        setAuthError('Passwords do not match');
                        return;
                      }

                  }


                  try {
                    const endpoint = authMode === 'login' ? 'login' : 'register';
                    const res = await fetch(`https://i-msgnet-backend-production.up.railway.app/api/users/${endpoint}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username, password })
                    });

                    const data = await res.json();

                    if (res.ok) {
                      localStorage.setItem('token', data.token);
                      localStorage.setItem('username', data.username);
                      setShowAuthModal(false);
                      setAuthError('');
                      alert(`Welcome, ${data.username}!`);
                      window.location.reload(); // refresh Sidebar to show logged-in state
                    } else {
                      setAuthError(data.error || 'Error');
                    }
                  } catch (err) {
                    setAuthError('Network error');
                  }
                }}
                disabled={!username || !password || (authMode === 'register' && (!confirmPassword || !acceptedWarning))}
                style={{ padding: '10px 20px', background: (username && password) ? '#28a745' : '#ccc', color: 'white', border: 'none', borderRadius: '6px', cursor: (username && password) ? 'pointer' : 'not-allowed' }}
              >
                {authMode === 'login' ? 'Login' : 'Register'}
              </button>
            

            </div>

            <p style={{ marginTop: '16px', textAlign: 'center' }}>
              {authMode === 'login' ? (
                <span>
                  No account? <button onClick={() => { setAuthMode('register'); setAuthError(''); }} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>Register</button>
                </span>
              ) : (
                <span>
                  Already have account? <button onClick={() => { setAuthMode('login'); setAuthError(''); }} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>Login</button>
                </span>
              )}
            </p>
          </div>
        </div>
      )}



    </div>
  );
}

export default Sidebar;