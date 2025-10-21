'use client';
import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 50000,
          email: 'customer@example.com',
          title: 'Voucher Purchase'
        })
      });

      const data = await response.json();

      if (data.success) {
        // Add https:// if not present
        let paymentUrl = data.payment_url;
        if (!paymentUrl.startsWith('http://') && !paymentUrl.startsWith('https://')) {
          paymentUrl = 'https://' + paymentUrl;
        }
        
        // Redirect to Flip payment page
        window.location.href = paymentUrl;
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
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <button
        onClick={handlePayment}
        disabled={loading}
        style={{
          padding: '20px 40px',
          fontSize: '24px',
          fontWeight: 'bold',
          backgroundColor: loading ? '#ccc' : '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}
      >
        {loading ? 'Loading...' : 'Buy Voucher - Rp 50,000'}
      </button>
    </div>
  );
}