import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function Sidebar() {
  const [chats, setChats] = useState([]);
  const [newChatName, setNewChatName] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editNameInput, setEditNameInput] = useState('');
  const editInputRef = useRef(null);
  const navigate = useNavigate();

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


const blockedChats = JSON.parse(localStorage.getItem('blocked_chats') || '[]');

const normalChats = chats.filter(chat => !blockedChats.includes(chat.id));
const blockedChatsList = chats.filter(chat => blockedChats.includes(chat.id));

// Sort: normal first, blocked last
const sortedChats = [...normalChats, ...blockedChatsList];

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
        opacity: isBlocked ? 0.6 : 1, // fade blocked
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
            e.stopPropagation(); // prevent chat click
            if (window.confirm(`Unblock chat ${displayName}?`)) {
              const newBlocked = blockedChats.filter(id => id !== chat.id);
              localStorage.setItem('blocked_chats', JSON.stringify(newBlocked));
              window.dispatchEvent(new Event('blockedChatsUpdated')); // optional: force Sidebar re-render
              window.location.reload(); // after unblock
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
          // your existing delete chat logic
        }}
        style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer' }}
      >
        🗑
      </button>
    </div>
  );
})}



      </ul>
    </div>
  );
}

export default Sidebar;