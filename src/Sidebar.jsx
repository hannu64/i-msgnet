import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';




function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [chats, setChats] = useState(() => {
    const stored = JSON.parse(localStorage.getItem('chats')) || [];
    return stored;
  });

  useEffect(() => {
    const handleChatsUpdate = () => {
      const stored = JSON.parse(localStorage.getItem('chats')) || [];
      setChats(stored);
    };
    window.addEventListener('chatsUpdated', handleChatsUpdate);
    return () => window.removeEventListener('chatsUpdated', handleChatsUpdate);
  }, []);

  // Blocked chats logic (inside component)
  const blockedChats = JSON.parse(localStorage.getItem('blocked_chats') || '[]');

  const normalChats = chats.filter(chat => !blockedChats.includes(chat.id));
  const blockedChatsList = chats.filter(chat => blockedChats.includes(chat.id));

  // Sort: normal first, blocked last
  const sortedChats = [...normalChats, ...blockedChatsList];

  return (
    <div style={{ width: '250px', background: '#f8f9fa', height: '100vh', padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }}>
      <h3>Chats</h3>
      <input
        type="text"
        placeholder="New chat name"
        value={newChatName}
        onChange={(e) => setNewChatName(e.target.value)}
        style={{ width: '100%', padding: '8px', marginBottom: '10px' }}
      />
      <button
        onClick={() => {
          if (newChatName.trim()) {
            const newChat = { id: Date.now().toString(), name: newChatName.trim() };
            const updated = [...chats, newChat];
            localStorage.setItem('chats', JSON.stringify(updated));
            setChats(updated);
            setNewChatName('');
            window.dispatchEvent(new Event('chatsUpdated'));
          }
        }}
        style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
      >
        +Add Chat
      </button>

      {sortedChats.map(chat => {
        const isBlocked = blockedChats.includes(chat.id);
        const displayName = chat.name || chat.id.slice(0, 8) + '...';

        return (
          <div
            key={chat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              background: location.pathname === `/chat/${chat.id}` ? '#e9ecef' : 'transparent',
              cursor: 'pointer',
              opacity: isBlocked ? 0.6 : 1,
            }}
            onClick={() => navigate(`/chat/${chat.id}`)}
          >
            <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {displayName}
              {isBlocked && ' (blocked)'}
              {localStorage.getItem(`key_${chat.id}`) && <span style={{ color: 'green', marginLeft: '6px' }}>🔒</span>}
            </span>

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
                  padding: '4px 8px'
                }}
                title="Unblock"
              >
                Unblock
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                const updated = chats.filter(c => c.id !== chat.id);
                localStorage.setItem('chats', JSON.stringify(updated));
                setChats(updated);
                window.dispatchEvent(new Event('chatsUpdated'));
                if (location.pathname === `/chat/${chat.id}`) navigate('/');
              }}
              style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' }}
            >
              🗑
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default Sidebar;