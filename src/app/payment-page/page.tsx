'use client';

export default function TestPayment() {
  const handleTest = async () => {
    try {
      const response = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 50000,
          email: 'test@example.com',
          title: 'Test Voucher'
        })
      });
      
      const data = await response.json();
      console.log('Full response:', data);
      alert(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error);
      alert('Error: ' + error);
    }
  };

  return (
    <div style={{ padding: '40px' }}>
      <h1>Test Payment API</h1>
      <button onClick={handleTest} style={{ 
        padding: '10px 20px', 
        fontSize: '16px',
        cursor: 'pointer'
      }}>
        Test Create Payment
      </button>
    </div>
  );
}