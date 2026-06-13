'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (!user.isAdmin) {
      router.push('/chat');
      return;
    }
    fetchPendingUsers();
  }, [user, router]);

  const fetchPendingUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'PATCH' });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u._id !== userId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm("Are you sure you want to reject and delete this user?")) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u._id !== userId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !user) {
    return <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}><div className="loading-spinner"></div></div>;
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', padding: '40px 20px', fontFamily: 'var(--font-main)' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '3px solid var(--border)', paddingBottom: '20px' }}>
          <div>
            <h1 style={{ color: 'var(--accent)', fontSize: '2rem', fontFamily: 'var(--font-mono)' }}>Admin Console</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Pending Registrations</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => router.push('/chat')} style={{ padding: '8px 16px', background: 'var(--bg-card)', border: '2px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-main)' }}>Back to Chat</button>
            <button onClick={() => { logout(); router.push('/auth'); }} style={{ padding: '8px 16px', background: '#ff4444', border: '2px solid #000', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-main)', fontWeight: 'bold' }}>Logout</button>
          </div>
        </header>

        {users.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--bg-card)', border: '3px solid var(--border)', boxShadow: 'var(--shadow-brutal)' }}>
            <h3 style={{ color: 'var(--text-muted)' }}>No pending registrations.</h3>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {users.map(u => (
              <div key={u._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '3px solid var(--border)', padding: '20px', boxShadow: 'var(--shadow-brutal)' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>@{u.username}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>{u.email}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button onClick={() => handleApprove(u._id)} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#000', border: '2px solid #000', cursor: 'pointer', fontWeight: 'bold', boxShadow: '2px 2px 0px #000' }}>Approve</button>
                  <button onClick={() => handleReject(u._id)} style={{ padding: '8px 16px', background: 'var(--bg-primary)', color: '#ff4444', border: '2px solid var(--border-strong)', cursor: 'pointer' }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
