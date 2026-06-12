'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GatePage() {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const router = useRouter();

  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setError('');
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    const code = digits.join('');
    if (code.length !== 4) {
      setError('Enter all 4 digits!');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/gate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/auth');
      } else {
        setAttempts(prev => prev + 1);
        setError(getErrorMessage(attempts));
        setDigits(['', '', '', '']);
        inputRefs[0].current?.focus();
      }
    } catch {
      setError('Something went wrong. Try again!');
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (attempt) => {
    const messages = [
      '🎰 Nope! Not the lucky number!',
      '❌ Wrong again! Keep trying!',
      '😅 Still not it! Feeling lucky?',
      '🔢 Incorrect! The odds are against you!',
      '💀 Nah! Maybe next time!',
    ];
    return messages[attempt % messages.length];
  };

  return (
    <div className="gate-container">
      {/* Decorative background elements to sell the game look */}
      <div className="gate-decor" style={{ top: '10%', left: '5%', transform: 'rotate(-12deg)', fontSize: '1rem' }}>
        7 7 7
      </div>
      <div className="gate-decor" style={{ top: '20%', right: '8%', transform: 'rotate(8deg)' }}>
        JACKPOT_SYSTEM v2.4
      </div>
      <div className="gate-decor" style={{ bottom: '15%', left: '8%', transform: 'rotate(-5deg)' }}>
        {'{ luck: Math.random() }'}
      </div>
      <div className="gate-decor" style={{ bottom: '25%', right: '5%', transform: 'rotate(15deg)', fontSize: '1.2rem' }}>
        🎲 🎰 🎯
      </div>
      <div className="gate-decor" style={{ top: '50%', left: '3%', transform: 'rotate(-90deg)' }}>
        CHANCE CALCULATOR
      </div>

      <div className="gate-card fade-in">
        <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🎰</div>
        <h1>Lucky Four</h1>
        <p className="subtitle">Can you guess the 4-digit lucky number?</p>

        <div className="gate-slots">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`gate-slot ${d ? 'filled' : ''}`}
              disabled={loading}
              autoComplete="off"
            />
          ))}
        </div>

        <button
          className="gate-btn"
          onClick={handleSubmit}
          disabled={loading || digits.some(d => !d)}
        >
          {loading ? '🎲 Checking...' : '🎯 Try My Luck!'}
        </button>

        {error && <p className="gate-error">{error}</p>}

        <div className="gate-footer">
          <p>Attempts: {attempts} | Odds: 1 in 10,000</p>
          <p style={{ marginTop: '4px', opacity: 0.6 }}>© 2024 LuckyFour Games Inc.</p>
        </div>
      </div>
    </div>
  );
}
