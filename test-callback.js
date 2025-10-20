const crypto = require("crypto");

const transactionData = {
  id: "TXN123456",
  customer_email: "test@example.com",
  customer_name: "John Doe",
  amount: 50000,
  status: "PAID",
};

const secret = "test_secret_123";
const body = JSON.stringify(transactionData);
const signature = crypto
  .createHmac("sha256", secret)
  .update(body)
  .digest("hex");

console.log("Transaction Data:", transactionData);
console.log("Signature:", signature);

// Make the request
fetch("http://localhost:3000/api/flip-callback", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-callback-token": signature,
  },
  body: body,
})
  .then((res) => res.json())
  .then((data) => console.log("Response:", data))
  .catch((err) => console.error("Error:", err));