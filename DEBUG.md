# Debug Environment Setup Guide

This project is now configured with VSCode debugging capabilities for Next.js development.

## Available Debug Configurations

### 1. **Next.js: debug server-side**
- Debugs server-side code (API routes, server components)
- Automatically opens browser when server is ready
- Best for debugging backend logic

### 2. **Next.js: debug client-side**
- Debugs client-side React components
- Connects to Chrome DevTools
- Requires the app to be already running on `http://localhost:3000`

### 3. **Next.js: debug full stack**
- Debugs both server and client code simultaneously
- Most comprehensive debugging option
- Recommended for most debugging scenarios

### 4. **Next.js: attach to existing**
- Attaches to an already running Next.js process
- Useful when you start the dev server manually with inspect flag

## How to Start Debugging

### Quick Start (Full Stack Debugging)
1. Open VSCode
2. Press `F5` or go to Run and Debug panel (Cmd+Shift+D / Ctrl+Shift+D)
3. Select "Next.js: debug full stack" from the dropdown
4. Click the green play button or press `F5`

### Setting Breakpoints
1. Open any file (e.g., API route, React component)
2. Click in the gutter (left of line numbers) to set a breakpoint
3. Red dot will appear indicating breakpoint is set
4. When code execution hits this line, debugger will pause

### Example Files to Debug
- **API Routes**: `src/app/api/*/route.ts`
- **Client Components**: `src/app/payment-page/page.tsx`
- **Server Components**: Any file without `'use client'` directive

## Debug Controls
- **Continue (F5)**: Resume execution
- **Step Over (F10)**: Execute current line and move to next
- **Step Into (F11)**: Step into function calls
- **Step Out (Shift+F11)**: Step out of current function
- **Restart (Cmd+Shift+F5)**: Restart debugging session
- **Stop (Shift+F5)**: Stop debugging

## Debugging API Routes

Example: Debug the payment creation API
1. Open `src/app/api/create-payment/route.ts`
2. Set a breakpoint on the line you want to inspect
3. Start "Next.js: debug full stack"
4. Navigate to `http://localhost:3000/payment-page`
5. Click the test button to trigger the API
6. Debugger will pause at your breakpoint

## Debugging Client Components

Example: Debug the payment page
1. Open `src/app/payment-page/page.tsx`
2. Set a breakpoint in the `handleTest` function
3. Start "Next.js: debug full stack"
4. Click the button in the browser
5. Debugger will pause and show variable values

## Inspect Variables
When paused at a breakpoint:
- Hover over variables to see their values
- Use the **Variables** panel in the debug sidebar
- Use the **Watch** panel to monitor specific expressions
- Use the **Debug Console** to evaluate expressions

## Common Debugging Scenarios

### Debugging Environment Variables
```typescript
// Add breakpoint here to inspect env vars
console.log(process.env.FLIP_SECRET_KEY);
```

### Debugging API Responses
```typescript
// Set breakpoint to inspect response data
const response = await fetch('/api/create-payment', {...});
const data = await response.json(); // Breakpoint here
```

### Debugging Supabase Queries
```typescript
// Breakpoint to see query results
const { data, error } = await supabase.from('table').select();
// Inspect data and error objects
```

## Advanced Debugging

### Using Debug Console
While paused, you can:
- Evaluate expressions: `request.body`
- Modify variables: `amount = 100000`
- Call functions: `JSON.stringify(data, null, 2)`

### Conditional Breakpoints
1. Right-click on a breakpoint
2. Select "Edit Breakpoint"
3. Add condition (e.g., `amount > 50000`)
4. Breakpoint only triggers when condition is true

### Logpoints
Alternative to console.log:
1. Right-click in gutter
2. Select "Add Logpoint"
3. Enter message: `Amount is {amount}`
4. Logs without stopping execution

## Troubleshooting

### Port Already in Use
If you get "port 3000 already in use":
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9
```

### Debugger Not Attaching
1. Stop the debug session
2. Close all browser tabs with localhost:3000
3. Restart the debug session

### Breakpoints Not Hitting
1. Ensure source maps are enabled (already configured)
2. Check that file path matches the running code
3. Try restarting the debug session

## Environment Variables

Make sure you have `.env.local` configured with required variables:
```bash
# Copy example file
cp .env.example .env.local

# Edit with your actual values
```

See [.env.example](.env.example) for required environment variables.

## Additional Resources

- [Next.js Debugging Docs](https://nextjs.org/docs/pages/building-your-application/configuring/debugging)
- [VSCode Debugging Guide](https://code.visualstudio.com/docs/editor/debugging)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

## Tips

1. **Use debugger statement**: Add `debugger;` in code to create automatic breakpoint
2. **Network tab**: Use browser DevTools Network tab alongside VSCode debugger
3. **Console logging**: Sometimes `console.log()` is faster for quick checks
4. **Git ignore**: `.vscode/settings.json` is included for team consistency, but can be personalized
