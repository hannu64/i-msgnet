import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function Sidebar() {
  const [chats, setChats] = useState([]);
  const [newChatName, setNewChatName] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editNameInput, setEditNameInput] = useState('');
  const editInputRef = useRef(null);
  const navigate = useNavigate();

  // Add state at top of Sidebar function
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');



  const loadChats = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('chats')) || [];
      const validChats = stored.filter(chat => 
        chat && typeof chat === 'object' && chat.id && typeof chat.name === 'string'
      );
      if (validChats.length < stored.length) {
        console.warn('Removed invalid chat entries');
        localStorage.setItem('chats', JSON.stringify(validChats));
      }

      // Enrich with simple last-message preview (sender-based)
      const enriched = validChats.map(chat => {
        const msgs = JSON.parse(localStorage.getItem(`messages_${chat.id}`)) || [];
        let preview = 'No messages yet';
        if (msgs.length > 0) {
          const lastSender = msgs[msgs.length - 1].sender;
          preview = lastSender === 'me' ? 'You sent a message' : 'Friend replied';
        }
        return { ...chat, preview };
      });

      setChats(enriched);
    } catch (err) {
      console.error('Failed to load chats:', err);
      setChats([]);
    }
  };

  useEffect(() => {
    loadChats();
    const handleUpdate = () => loadChats();
    window.addEventListener('chatsUpdated', handleUpdate);
    return () => window.removeEventListener('chatsUpdated', handleUpdate);
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

    if (window.location.pathname === `/chat/${chatId}`) {
      navigate('/');
    }
  };



  // Blocked chats logic (inside component, before return)
  const blockedChats = JSON.parse(localStorage.getItem('blocked_chats') || '[]');
  const normalChats = chats.filter(chat => !blockedChats.includes(chat.id));
  const blockedChatsList = chats.filter(chat => blockedChats.includes(chat.id));

  // Sort: normal first, blocked last
  const sortedChats = [...normalChats, ...blockedChatsList];

  return (
    <div style={{ width: '250px', borderRight: '1px solid #ccc', padding: '10px', overflowY: 'auto' }}>
      

      <p>Logged in as {localStorage.getItem('username')}</p>
      
      
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


      {sortedChats.map((chat) => {
        const isEditing = editingChatId === chat.id;
        const isBlocked = blockedChats.includes(chat.id);
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
              background: window.location.pathname === `/chat/${chat.id}` ? '#f0f0f0' : 'transparent',
              opacity: isBlocked ? 0.6 : 1, // fade blocked chats
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
                  {isBlocked && ' (blocked)'}
                  {localStorage.getItem(`key_${chat.id}`) && <span style={{ color: 'green', marginLeft: '6px' }}>🔒</span>}
                </button>
              )}

              <div style={{ display: 'flex', gap: '4px' }}>
                {!isEditing && !isBlocked && (
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

                {isBlocked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Unblock chat ${displayName}?`)) {
                        const newBlocked = blockedChats.filter(id => id !== chat.id);
                        localStorage.setItem('blocked_chats', JSON.stringify(newBlocked));
                        window.location.reload(); // refresh Sidebar
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc3545',
                      cursor: 'pointer',
                      fontSize: '0.9em',
                      padding: '2px 6px'
                    }}
                    title="Unblock"
                  >
                    Unblock
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeChat(chat.id);
                  }}
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


        // Add modal (at bottom of return, after chat list)
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

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                style={{ width: '100%', padding: '10px', marginBottom: '16px', borderRadius: '6px' }}
              />

              {error && <p style={{ color: '#dc3545', marginBottom: '16px' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowAuthModal(false);
                    setError('');
                    setUsername('');
                    setPassword('');
                  }}
                  style={{ padding: '10px 20px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '6px' }}
                >
                  Cancel
                </button>

                <button
                  onClick={async () => {
                    if (username.length < 5) {
                      setError('Username must be at least 5 characters');
                      return;
                    }
                    if (!password) {
                      setError('Password required');
                      return;
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
                        setError('');
                        alert(`Welcome, ${data.username}!`);
                        // Optional: reload Sidebar or fetch my chats
                        window.location.reload();
                      } else {
                        setError(data.error || 'Error');
                      }
                    } catch (err) {
                      setError('Network error');
                    }
                  }}
                  style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px' }}
                >
                  {authMode === 'login' ? 'Login' : 'Register'}
                </button>
              </div>

              <p style={{ marginTop: '16px', textAlign: 'center' }}>
                {authMode === 'login' ? (
                  <span>
                    No account? <button onClick={() => { setAuthMode('register'); setError(''); }} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>Register</button>
                  </span>
                ) : (
                  <span>
                    Already have account? <button onClick={() => { setAuthMode('login'); setError(''); }} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>Login</button>
                  </span>
                )}
              </p>
            </div>
          </div>
        )}


      })}




      </ul>
    </div>
  );
}

export default Sidebar;