'use client';
import { useState } from 'react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('50000');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseInt(amount),
          email: email,
          title: 'Voucher Purchase'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to Flip payment page
        window.location.href = data.payment_url;
      } else {
        alert('Error: ' + data.message);
        setLoading(false);
      }
    } catch (error) {
      alert('Error creating payment');
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '500px',
      margin: '50px auto',
      padding: '40px',
      backgroundColor: '#f9f9f9',
      borderRadius: '10px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>
        Purchase Voucher
      </h1>
      
      <form onSubmit={handleSubmit} style={{ marginTop: '30px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Email:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              boxSizing: 'border-box'
            }}
            placeholder="your@email.com"
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Amount (Rp):
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min="10000"
            step="1000"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px',
            fontSize: '18px',
            fontWeight: 'bold',
            backgroundColor: loading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Creating Payment...' : 'Pay Now'}
        </button>
      </form>
    </div>
  );
}