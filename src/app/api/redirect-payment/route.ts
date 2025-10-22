import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tempId = searchParams.get("transaction_id");

    console.log(`📥 Redirect received - URL: ${request.url}`);
    console.log(`📥 temp_id parameter: ${tempId}`);
    console.log(`📥 All params:`, Object.fromEntries(searchParams.entries()));

    if (!tempId) {
      console.error(`❌ Missing temp_id parameter in request`);
      return new NextResponse(
        `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error - Missing temp_id Parameter</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              text-align: center;
              padding: 40px;
              background: white;
              border-radius: 16px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              max-width: 400px;
            }
            .error-icon {
              font-size: 64px;
              margin-bottom: 20px;
            }
            h1 {
              color: #f44336;
              font-size: 24px;
              margin-bottom: 10px;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Missing temp_id Parameter</h1>
            <p>The temp_id parameter is required. Please ensure you're using the correct URL format: ?temp_id=YOUR_TEMP_ID</p>
          </div>
        </body>
        </html>
        `,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    console.log(`🔍 Starting redirect for tempId: ${tempId}`);

    // Return loading page with client-side polling
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Processing Payment...</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          
          .container {
            text-align: center;
            padding: 60px 40px;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            max-width: 500px;
            width: 100%;
          }
          
          .spinner {
            width: 80px;
            height: 80px;
            margin: 0 auto 30px;
            border: 8px solid #f3f3f3;
            border-top: 8px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          
          h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 15px;
            font-weight: 600;
          }
          
          .status {
            color: #666;
            font-size: 16px;
            margin-bottom: 10px;
            line-height: 1.6;
          }
          
          .attempt {
            color: #999;
            font-size: 14px;
            margin-top: 20px;
          }
          
          .success-icon {
            font-size: 80px;
            margin-bottom: 20px;
            display: none;
          }
          
          .success-icon.show {
            display: block;
            animation: scaleIn 0.5s ease-out;
          }
          
          @keyframes scaleIn {
            0% { transform: scale(0); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          
          .error {
            color: #f44336;
          }
          
          .progress-bar {
            width: 100%;
            height: 4px;
            background: #f3f3f3;
            border-radius: 2px;
            margin-top: 30px;
            overflow: hidden;
          }
          
          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
            width: 0%;
            transition: width 1s linear;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner" id="spinner"></div>
          <div class="success-icon" id="successIcon">🎉</div>
          <h1 id="title">Processing Your Payment</h1>
          <p class="status" id="status">Please wait while we confirm your payment...</p>
          <p class="attempt" id="attempt">Checking transaction status...</p>
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
        </div>

        <script>
          const tempId = '${tempId}';
          const maxAttempts = 15;
          let currentAttempt = 0;

          async function checkTransaction() {
            try {
              currentAttempt++;

              // Update UI
              document.getElementById('attempt').textContent =
                \`Attempt \${currentAttempt}/\${maxAttempts}...\`;

              // Update progress bar
              const progress = (currentAttempt / maxAttempts) * 100;
              document.getElementById('progressFill').style.width = progress + '%';

              // Make API request
              const response = await fetch(
                \`https://flip-callback.vercel.app/api/check-transaction?transaction_id=\${tempId}\`
              );
              
              const data = await response.json();
              
              if (data.success && data.transaction_id) {
                // Success! Show success UI and redirect
                document.getElementById('spinner').style.display = 'none';
                document.getElementById('successIcon').classList.add('show');
                document.getElementById('title').textContent = 'Payment Confirmed!';
                document.getElementById('status').textContent = 'Redirecting to your voucher...';
                document.getElementById('attempt').textContent = '';
                
                // Redirect after 1 second
                setTimeout(() => {
                  window.location.href = \`https://functional-method-830499.framer.app/success?bill_link=\${data.transaction_id}\`;
                }, 1000);
                
                return;
              }
              
              // Not found yet, try again
              if (currentAttempt < maxAttempts) {
                setTimeout(checkTransaction, 2000); // Wait 2 seconds
              } else {
                // Max attempts reached
                document.getElementById('spinner').style.display = 'none';
                document.getElementById('title').textContent = 'Taking Longer Than Expected';
                document.getElementById('title').className = 'error';
                document.getElementById('status').textContent = 
                  'Your payment is being processed. Please check your email for your voucher code, or contact support.';
                document.getElementById('attempt').textContent = '';
              }
              
            } catch (error) {
              console.error('Error checking transaction:', error);
              
              if (currentAttempt < maxAttempts) {
                setTimeout(checkTransaction, 2000);
              } else {
                document.getElementById('spinner').style.display = 'none';
                document.getElementById('title').textContent = 'Connection Error';
                document.getElementById('title').className = 'error';
                document.getElementById('status').textContent = 
                  'Unable to verify your payment. Please check your email or contact support.';
                document.getElementById('attempt').textContent = '';
              }
            }
          }

          // Start checking immediately
          checkTransaction();
        </script>
      </body>
      </html>
      `,
      {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }
    );
  } catch (error) {
    console.error("❌ Redirect error:", error);

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
            max-width: 400px;
          }
          .error-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }
          h1 { 
            color: #f44336; 
            font-size: 24px; 
            margin-bottom: 10px; 
          }
          p { 
            color: #666; 
            line-height: 1.6; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">❌</div>
          <h1>Error</h1>
          <p>An error occurred while processing your request. Please contact support.</p>
        </div>
      </body>
      </html>
      `,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}
