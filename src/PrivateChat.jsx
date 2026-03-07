import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import './styles.css';

// Generate random AES-256 key and export as base64
const generateKey = async () => {
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// Import base64 string back to CryptoKey – safer version
const importKey = async (base64Key) => {
  if (!base64Key || typeof base64Key !== 'string' || base64Key.trim() === '') {
    console.warn('importKey called with empty/invalid base64');
    return null;
  }
  try {
    const raw = Uint8Array.from(atob(base64Key.trim()), c => c.charCodeAt(0));
    if (raw.length !== 32) {
      console.warn('Invalid key length:', raw.length);
      return null;
    }
    return await crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (err) {
    console.error('Invalid key format:', err);
    return null;
  }
};

function PrivateChat() {
  const { chatId } = useParams();
  const [messages, setMessages] = useState([]);
  const [decryptedMessages, setDecryptedMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [cryptoKey, setCryptoKey] = useState(null);
  const [sharedKeyInput, setSharedKeyInput] = useState('');
  const [keyStatus, setKeyStatus] = useState('loading');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [chatNameInput, setChatNameInput] = useState('');
  const [showPassphraseInput, setShowPassphraseInput] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const [passphraseError, setPassphraseError] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [lifespanHours, setLifespanHours] = useState('24');
  const messagesEndRef = useRef(null);

  // Improved timestamp formatting
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    if (isToday) return timeStr;
    let datePart = date.toLocaleDateString('fi-FI', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    });
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 7) datePart += `.${date.getFullYear()}`;
    return `${datePart} ${timeStr}`;
  };

  // Load messages
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem(`messages_${chatId}`)) || [];
    setMessages(stored);
  }, [chatId]);

  // Show name prompt if chat has no name yet
  useEffect(() => {
    const storedChats = JSON.parse(localStorage.getItem('chats')) || [];
    const existing = storedChats.find(c => c.id === chatId);
    if (!existing) setShowNamePrompt(true);
  }, [chatId]);

  // Load/use key
  useEffect(() => {
    (async () => {
      const storedKey = localStorage.getItem(`key_${chatId}`);
      let key = null;
      if (storedKey) {
        key = await importKey(storedKey);
        setKeyStatus(key ? 'shared' : 'invalid');
      } else {
        const encoder = new TextEncoder();
        const material = await crypto.subtle.importKey(
          'raw',
          encoder.encode(chatId + 'fixed-salt-for-poc'),
          { name: 'PBKDF2' },
          false,
          ['deriveBits', 'deriveKey']
        );
        key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: encoder.encode('salt-for-poc'), iterations: 100000, hash: 'SHA-256' },
          material,
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        setKeyStatus('derived');
      }
      setCryptoKey(key);
    })();
  }, [chatId]);

  // Decrypt
  useEffect(() => {
    if (!cryptoKey) return;
    const decryptAll = async () => {
      const decrypted = await Promise.all(
        messages.map(async (msg) => {
          if (!msg.encrypted) return { ...msg, text: '[No content]', status: 'ok' };
          try {
            const combined = Uint8Array.from(atob(msg.encrypted), c => c.charCodeAt(0));
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);
            const buffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
            return { ...msg, text: new TextDecoder().decode(buffer), status: 'ok' };
          } catch (err) {
            return { ...msg, text: '[Decryption failed]', status: 'error' };
          }
        })
      );
      setDecryptedMessages(decrypted);
    };
    decryptAll();
  }, [messages, cryptoKey]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedMessages]);


  // Polling (extracted as function)
  const pollMessages = async () => {
  try {
    const res = await fetch(`https://i-msgnet-backend-production.up.railway.app/api/messages/${chatId}`);
    if (!res.ok) return;
    const remoteMsgs = await res.json();

    setMessages(prevMessages => {
      const localMap = new Map(prevMessages.map(m => [m.encrypted, m]));
      const remoteMap = new Map(remoteMsgs.map(m => [m.encrypted, m]));

      // Keep only messages that still exist on backend
      const updated = [...remoteMap.values()].map(rm => {
        const local = localMap.get(rm.encrypted);
        return local || { encrypted: rm.encrypted, sender: 'them', timestamp: rm.timestamp || Date.now() };
      });

      localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
      return updated;
    });
  } catch (err) {
    console.error('Polling error:', err);
  }
};


  useEffect(() => {
    pollMessages();
    const interval = setInterval(pollMessages, 8000);
    return () => clearInterval(interval);
  }, [chatId]);

  const copyKey = async () => {
    if (!cryptoKey) return;
    const raw = await crypto.subtle.exportKey('raw', cryptoKey);
    const base64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
    await navigator.clipboard.writeText(base64);
    alert('Key copied! Share securely outside this app.');
  };

  const handleKeyPaste = async (e) => {
    const val = e.target.value.trim();
    setSharedKeyInput(val);
    if (val) {
      const imported = await importKey(val);
      if (imported) {
        setCryptoKey(imported);
        setKeyStatus('shared');
        localStorage.setItem(`key_${chatId}`, val);
      } else {
        setKeyStatus('invalid');
      }
    } else {
      localStorage.removeItem(`key_${chatId}`);
      const encoder = new TextEncoder();
      const material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(chatId + 'fixed-salt-for-poc'),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      const demoKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode('salt-for-poc'), iterations: 100000, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      setCryptoKey(demoKey);
      setKeyStatus('derived');
    }
  };

  const clearKey = () => {
    setSharedKeyInput('');
    localStorage.removeItem(`key_${chatId}`);
    (async () => {
      const encoder = new TextEncoder();
      const material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(chatId + 'fixed-salt-for-poc'),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      const demoKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: encoder.encode('salt-for-poc'), iterations: 100000, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      setCryptoKey(demoKey);
      setKeyStatus('derived');
    })();
  };

  const generateAndSetRandomKey = async () => {
    try {
      const base64Key = await generateKey();
      const imported = await importKey(base64Key);
      if (imported) {
        setCryptoKey(imported);
        setKeyStatus('shared');
        setSharedKeyInput(base64Key);
        localStorage.setItem(`key_${chatId}`, base64Key);
        await navigator.clipboard.writeText(base64Key);
        alert('New secure random key generated and copied!\nShare this securely with your friend.');
      }
    } catch (err) {
      console.error('Random key generation failed:', err);
      alert('Error generating key.');
    }
  };

  const deriveKeyFromPassphrase = async (pass) => {
    if (pass.length < 12) {
      setPassphraseError('Passphrase must be at least 12 characters');
      return;
    }
    try {
      const encoder = new TextEncoder();
      const salt = encoder.encode('i-msgnet-passphrase-salt-2026');
      const material = await crypto.subtle.importKey(
        'raw',
        encoder.encode(pass),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt,
          iterations: 150000,
          hash: 'SHA-256'
        },
        material,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      const exported = await crypto.subtle.exportKey('raw', derivedKey);
      const base64Key = btoa(String.fromCharCode(...new Uint8Array(exported)));
      setCryptoKey(derivedKey);
      setKeyStatus('shared');
      setSharedKeyInput(base64Key);
      localStorage.setItem(`key_${chatId}`, base64Key);
      setPassphraseError('');
      setShowPassphraseInput(false);
      setPassphrase('');
      setShowPassphrase(false);
      alert('Passphrase accepted! Key derived and set.\nYour friend must enter the exact same passphrase.');
    } catch (err) {
      console.error('Passphrase derivation failed:', err);
      setPassphraseError('Failed to derive key – try again');
    }
  };

  // Strength helpers
  const getStrengthColor = (pass) => {
    if (pass.length < 12) return '#dc3545';
    if (pass.length < 16) return '#fd7e14';
    if (pass.length < 20) return '#ffc107';
    return '#28a745';
  };

  const getStrengthWidth = (pass) => {
    const len = Math.min(pass.length, 30);
    return `${(len / 30) * 100}%`;
  };

  const getStrengthLabel = (pass) => {
    if (pass.length < 12) return `Too short (${pass.length}/12)`;
    if (pass.length < 16) return 'Medium';
    if (pass.length < 20) return 'Strong';
    return 'Very strong ✓';
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !cryptoKey) return;
    const encoder = new TextEncoder();
    const data = encoder.encode(newMessage);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    const base64 = btoa(String.fromCharCode(...combined));
    const msg = { 
      encrypted: base64, 
      sender: 'me', 
      timestamp: Date.now(),
      lifespanHours: lifespanHours === 'null' ? null : parseInt(lifespanHours)
    };
    const updated = [...messages, msg];
    setMessages(updated);
    localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
    setNewMessage('');
    try {
      await fetch('https://i-msgnet-backend-production.up.railway.app/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId, 
          encrypted: base64,
          lifespanHours: msg.lifespanHours
        })
      });
    } catch (err) {
      console.error('Backend send failed:', err);
    }
  };

  const simulateIncoming = async () => {
    if (!cryptoKey) {
      alert('No key loaded yet');
      return;
    }
    const fakeTexts = [
      'Hei hei!',
      'Mitäs kuuluu?',
      '😂😂 totta',
      'Sataa taas...',
      'Milloin nähdään?'
    ];
    const text = fakeTexts[Math.floor(Math.random() * fakeTexts.length)];
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, data);
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    const base64 = btoa(String.fromCharCode(...combined));
    const msg = { encrypted: base64, sender: 'them', timestamp: Date.now() };
    const updated = [...messages, msg];
    setMessages(updated);
    localStorage.setItem(`messages_${chatId}`, JSON.stringify(updated));
  };

  const handleSaveName = () => {
    const trimmed = chatNameInput.trim();
    if (trimmed.length < 2) return;
    const storedChats = JSON.parse(localStorage.getItem('chats')) || [];
    const updated = [...storedChats, { id: chatId, name: trimmed }];
    localStorage.setItem('chats', JSON.stringify(updated));
    setShowNamePrompt(false);
    setChatNameInput('');
    window.dispatchEvent(new Event('chatsUpdated'));
  };

  const handleDeleteMessage = async (encrypted) => {
    if (!window.confirm('Delete this message for everyone? This cannot be undone.')) return;
    try {
      const res = await fetch(
        `https://i-msgnet-backend-production.up.railway.app/api/messages/${chatId}/${encodeURIComponent(encrypted)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setMessages(prev => prev.filter(m => m.encrypted !== encrypted));
        localStorage.setItem(`messages_${chatId}`, JSON.stringify(
          JSON.parse(localStorage.getItem(`messages_${chatId}`) || '[]').filter(m => m.encrypted !== encrypted)
        ));
        pollMessages(); // immediate sync
        alert('Message deleted.');
      } else {
        alert('Failed to delete message on server.');
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Error deleting message.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '20px', boxSizing: 'border-box' }}>
      <h2>Chat {chatId.slice(0, 8)}...</h2>

      {showNamePrompt && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            padding: '28px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '440px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.5rem' }}>
              Name this conversation
            </h3>
            <p style={{ margin: '0 0 20px 0', color: '#555' }}>
              Choose a clear label so you can easily find this chat later in the sidebar.
            </p>

            <input
              type="text"
              value={chatNameInput}
              onChange={(e) => setChatNameInput(e.target.value)}
              placeholder="e.g. Juha / Work friend / Alex"
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                marginBottom: '20px',
                boxSizing: 'border-box',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveName();
                }
              }}
            />

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleSaveName}
                disabled={chatNameInput.trim().length < 2}
                style={{
                  padding: '10px 24px',
                  background: chatNameInput.trim().length >= 2 ? '#007bff' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: chatNameInput.trim().length >= 2 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Save name
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <strong>Key status:</strong>
          <span style={{ color: keyStatus === 'shared' ? 'green' : keyStatus === 'invalid' ? 'red' : 'orange' }}>
            {keyStatus === 'shared' ? 'Using shared key ✓' :
             keyStatus === 'derived' ? 'Demo mode (chatId-derived key)' :
             keyStatus === 'invalid' ? 'Invalid key' : 'Loading...'}
          </span>
        </div>

        {keyStatus !== 'shared' && (
          <div style={{ background: '#fff3cd', color: '#856404', padding: '12px', borderRadius: '6px', marginBottom: '12px', fontWeight: 'bold' }}>
            ⚠️ Warning: Secure chat is currently disabled in demo mode. Messages are NOT end-to-end encrypted.
            Paste a shared key from your friend to enable real security. Do NOT send sensitive information until then!
          </div>
        )}

        {keyStatus === 'derived' && (
          <div style={{ margin: '12px 0' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
              Want to start a secure chat with someone?
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={generateAndSetRandomKey}
                style={{ padding: '10px 20px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px' }}
              >
                Generate real random key
              </button>
              <button
                onClick={() => setShowPassphraseInput(true)}
                style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px' }}
              >
                Use shared passphrase
              </button>
            </div>
          </div>
        )}

        {keyStatus === 'shared' && (
          <small style={{ color: '#28a745', fontWeight: 'bold', display: 'block', margin: '12px 0' }}>
            ✓ Using shared secret key — messages are end-to-end encrypted
          </small>
        )}

        <button onClick={clearKey} style={{ marginTop: '8px', padding: '8px 16px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Clear key / Back to demo
        </button>

        <div style={{ marginTop: '12px' }}>
          <label>Paste shared secret key:</label><br />
          <input
            type="text"
            value={sharedKeyInput}
            onChange={handleKeyPaste}
            placeholder="Paste base64 key here..."
            style={{ width: '100%', padding: '10px', marginTop: '4px', border: '1px solid #ccc', borderRadius: '6px' }}
          />
          <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
            One person creates the key and shares it securely (e.g. via Signal or in person).
            Both must paste the same key here for secure E2EE. Never send the key in this chat!
          </small>
        </div>

        {showPassphraseInput && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            background: '#e7f3ff',
            borderRadius: '8px',
            border: '1px solid #b3d4fc'
          }}>
            <strong>Enter shared passphrase</strong><br />
            <small style={{ color: '#555', lineHeight: '1.5' }}>
              Both you and your friend must type the <strong>exact same passphrase</strong> (minimum 12 characters).<br />
              Agree on it outside this chat (phone, in person, secure message — never type it here!).
            </small>

            <div style={{ position: 'relative', margin: '16px 0' }}>
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setPassphraseError('');
                }}
                placeholder="Your shared passphrase (min 12 chars)"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 12px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  boxSizing: 'border-box'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    deriveKeyFromPassphrase(passphrase);
                  }
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
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
                title={showPassphrase ? 'Hide passphrase' : 'Show passphrase'}
              >
                {showPassphrase ? '🙈' : '👁️'}
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              {passphrase.length > 0 && (
                <>
                  <div style={{
                    height: '8px',
                    background: getStrengthColor(passphrase),
                    borderRadius: '4px',
                    width: getStrengthWidth(passphrase),
                    transition: 'width 0.3s, background 0.3s',
                    marginBottom: '6px'
                  }} />
                  <small style={{
                    fontWeight: 'bold',
                    color: getStrengthColor(passphrase)
                  }}>
                    {getStrengthLabel(passphrase)}
                  </small>
                </>
              )}
            </div>

            {passphraseError && (
              <div style={{ color: '#dc3545', marginBottom: '12px' }}>
                {passphraseError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowPassphraseInput(false);
                  setPassphrase('');
                  setPassphraseError('');
                  setShowPassphrase(false);
                }}
                style={{
                  padding: '10px 20px',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deriveKeyFromPassphrase(passphrase)}
                disabled={passphrase.length < 12}
                style={{
                  padding: '10px 20px',
                  background: passphrase.length >= 12 ? '#007bff' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: passphrase.length >= 12 ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold'
                }}
              >
                Use this passphrase
              </button>
            </div>
          </div>
        )}

        <button onClick={simulateIncoming} disabled={!cryptoKey} style={{ marginTop: '12px', padding: '8px 16px', background: '#28a745', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
          Simulate incoming message (test decrypt)
        </button>
      </div>


{/* padding: '20px 40px', dustbins location */}
{/* <div style={{ flex: 1, overflowY: 'auto', overflowX: 'visible', padding: '10px 0', display: 'flex', flexDirection: 'column', position: 'relative' }}> */}

<div style={{
  flex: 1,
  overflowY: 'auto',
  overflowX: 'visible',
  padding: '20px 40px',  // ← more side padding
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  boxSizing: 'border-box'
}}>

        {decryptedMessages.map((msg, idx) => (
          <div
            key={idx}
            className="message-bubble"
            style={{
              alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
              margin: '16px 0',
              padding: '12px 20px',
              borderRadius: '18px',
              background: msg.sender === 'me' ? '#dcf8c6' : '#e3f2fd',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              wordBreak: 'break-word',
              position: 'relative',
              overflow: 'visible'
            }}
          >
            {msg.text}
            <div style={{
              fontSize: '0.75em',
              opacity: 0.7,
              marginTop: '4px',
              textAlign: msg.sender === 'me' ? 'right' : 'left'
            }}>
              {formatMessageTime(msg.serverTimestamp || msg.timestamp || Date.now())}
            </div>

            <button
              onClick={() => handleDeleteMessage(msg.encrypted)}
              className="delete-btn"
              style={{
                position: 'absolute',
                top: '-18px',

/* dustbin locations */
                right: msg.sender === 'me' ? '2px' : 'auto', 
                left: msg.sender === 'them' ? '-0px' : 'auto', 
/*                right: msg.sender === 'me' ? '-28px' : 'auto', */
/*                left: msg.sender === 'them' ? '-28px' : 'auto',  */

                background: 'rgba(255,255,255,0.9)',
                border: '1px solid #dc3545',
                borderRadius: '50%',
                color: '#dc3545',
                fontSize: '1.2em',
                cursor: 'pointer',
                padding: '4px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                opacity: 0,
                transition: 'opacity 0.2s'
              }}
              title="Delete message"
            >
              🗑
            </button>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', paddingTop: '10px', borderTop: '1px solid #eee' }}>
        <div style={{ marginBottom: '12px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontWeight: 'bold' }}>Delete after:</label>
          <label>
            <input
              type="radio"
              name="lifespan"
              value="24"
              checked={lifespanHours === '24'}
              onChange={() => setLifespanHours('24')}
            /> 24 hours
          </label>
          <label>
            <input
              type="radio"
              name="lifespan"
              value="192"
              checked={lifespanHours === '192'}
              onChange={() => setLifespanHours('192')}
            /> 8 days
          </label>
          <label>
            <input
              type="radio"
              name="lifespan"
              value="null"
              checked={lifespanHours === 'null'}
              onChange={() => setLifespanHours('null')}
            /> No limit
          </label>
        </div>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message"
          style={{ flex: 1, padding: '12px', border: '1px solid #ccc', borderRadius: '20px' }}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
        />
        <button
          onClick={sendMessage}
          style={{ marginLeft: '10px', padding: '12px 24px', background: '#25D366', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer' }}
        >
          Send It
        </button>
      </div>
    </div>
  );
}

export default PrivateChat;