ALGORUNWAY LOCAL STARTER

Requirements:
- Windows 10/11
- Node.js 20 LTS recommended (or Node.js 18.17+)

Install:
1. Extract this folder to C:\AlgoRunway (or another folder).
2. Install Node.js from https://nodejs.org/ if it is not installed.
3. Double-click start-algorunway.bat.
4. Wait for Next.js to finish starting.
5. Open http://localhost:3000 in Chrome.

Manual start:
  cd /d C:\AlgoRunway
  npm install
  npm run dev

Important:
- This is a local dashboard starter only.
- Strategy buttons arm or disarm a local demo status; they do not generate automatic signals.
- No Dhan API is connected.
- No live prices, broker orders, or real trading are implemented.
- Paper premiums are entered manually and stored in this browser.
- Historical Backtest accepts a user-supplied OHLC CSV and supports India, Crypto, and Forex segments.
- CSV columns required: Date, Open, High, Low, Close. Time, Symbol, and Market are optional.
- Backtest date filters include both endpoints; the default range is 2010-01-01 through 2026-11-13.
- Do not add live execution until authentication, order validation, position limits,
  kill switch, duplicate-order protection, logging, and tested risk controls exist.
