"use client";

import { ChangeEvent, useMemo, useState } from "react";

type AssetClass = "India" | "Crypto" | "Forex";
type Strategy = "ema" | "rsi" | "breakout";

type Bar = {
  date: string;
  time: string;
  symbol: string;
  market: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type ResultTrade = {
  date: string;
  symbol: string;
  entryTime: string;
  exitTime: string;
  entry: number;
  exit: number;
  quantity: number;
  pnl: number;
  reason: string;
};

const panel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 18,
  marginBottom: 18,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 7,
  marginTop: 6,
  boxSizing: "border-box",
};

function parseLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) {
      value += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

function isoDate(value: string): string {
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }
  const dmy = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  throw new Error(`Unsupported date "${raw}". Use YYYY-MM-DD or DD/MM/YYYY.`);
}

function readBars(text: string): Bar[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV must include a header and at least one data row.");
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/[ _-]/g, ""));
  const index = (names: string[]) => headers.findIndex((h) => names.includes(h));
  const dateIndex = index(["date", "datetime", "timestamp"]);
  const openIndex = index(["open", "o"]);
  const highIndex = index(["high", "h"]);
  const lowIndex = index(["low", "l"]);
  const closeIndex = index(["close", "closingprice", "c"]);
  if ([dateIndex, openIndex, highIndex, lowIndex, closeIndex].some((i) => i < 0)) {
    throw new Error("CSV needs Date, Open, High, Low and Close columns. Time, Symbol and Market are optional.");
  }

  const timeIndex = index(["time"]);
  const symbolIndex = index(["symbol", "ticker", "instrument"]);
  const marketIndex = index(["market", "assetclass", "segment"]);
  const bars = lines.slice(1).map((line, rowIndex) => {
    const cells = parseLine(line);
    const dateCell = cells[dateIndex] || "";
    const date = isoDate(dateCell);
    const timestampMatch = dateCell.match(/[T ](\d{1,2}:\d{2}(?::\d{2})?)/);
    const time = (timeIndex >= 0 ? cells[timeIndex] : timestampMatch?.[1] || "00:00").slice(0, 5);
    const number = (i: number) => Number((cells[i] || "").replace(/,/g, ""));
    const open = number(openIndex);
    const high = number(highIndex);
    const low = number(lowIndex);
    const close = number(closeIndex);
    if (![open, high, low, close].every((n) => Number.isFinite(n) && n > 0) || high < low) {
      throw new Error(`Invalid OHLC values on CSV row ${rowIndex + 2}.`);
    }
    return {
      date,
      time,
      symbol: symbolIndex >= 0 ? (cells[symbolIndex] || "UNSPECIFIED").trim().toUpperCase() : "UNSPECIFIED",
      market: marketIndex >= 0 ? (cells[marketIndex] || "").trim().toLowerCase() : "",
      open,
      high,
      low,
      close,
    };
  });
  return bars.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const alpha = 2 / (period + 1);
  values.forEach((value, index) => {
    result.push(index === 0 ? value : value * alpha + result[index - 1] * (1 - alpha));
  });
  return result;
}

function rsi(values: number[], period = 14): number[] {
  return values.map((_, index) => {
    if (index < period) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = index - period + 1; i <= index; i++) {
      const change = values[i] - values[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - 100 / (1 + rs);
  });
}

const segments: Record<AssetClass, string[]> = {
  India: ["india", "indian", "nse", "bse", "nifty", "sensex", "equity", "equities", "options", "derivatives"],
  Crypto: ["crypto", "cryptocurrency", "digital asset", "digital assets"],
  Forex: ["forex", "fx", "foreign exchange", "currency"],
};

export default function BacktestPanel() {
  const [bars, setBars] = useState<Bar[]>([]);
  const [fileName, setFileName] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("India");
  const [strategy, setStrategy] = useState<Strategy>("ema");
  const [symbol, setSymbol] = useState("ALL");
  const [fromDate, setFromDate] = useState("2010-01-01");
  const [toDate, setToDate] = useState("2026-11-13");
  const [capital, setCapital] = useState("100000");
  const [quantity, setQuantity] = useState("1");
  const [fastPeriod, setFastPeriod] = useState("9");
  const [slowPeriod, setSlowPeriod] = useState("21");
  const [stopLoss, setStopLoss] = useState("2");
  const [target, setTarget] = useState("4");
  const [cost, setCost] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [maxTradesPerDay, setMaxTradesPerDay] = useState("3");
  const [message, setMessage] = useState("Upload your historical OHLC CSV to start a backtest.");
  const [results, setResults] = useState<ResultTrade[]>([]);
  const [runInfo, setRunInfo] = useState("");

  const symbols = useMemo(() => Array.from(new Set(bars.map((bar) => bar.symbol))).sort(), [bars]);
  const visibleBars = useMemo(() => {
    const aliases = segments[assetClass];
    return bars.filter((bar) => {
      const segmentMatches = !bar.market || aliases.some((alias) => bar.market.includes(alias));
      const symbolMatches = symbol === "ALL" || bar.symbol === symbol;
      return segmentMatches && symbolMatches && bar.date >= fromDate && bar.date <= toDate;
    });
  }, [assetClass, bars, fromDate, symbol, toDate]);
  const datesInRange = useMemo(() => Array.from(new Set(visibleBars.map((bar) => bar.date))).length, [visibleBars]);

  const readFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = readBars(String(reader.result || ""));
        setBars(parsed);
        setFileName(file.name);
        setResults([]);
        setRunInfo("");
        setSymbol("ALL");
        setMessage(`${parsed.length.toLocaleString()} candles loaded from ${file.name}. Choose a date range and run the backtest.`);
      } catch (error) {
        setBars([]);
        setResults([]);
        setFileName("");
        setMessage(error instanceof Error ? error.message : "Could not read this CSV file.");
      }
    };
    reader.onerror = () => setMessage("Could not read this file. Please choose a CSV saved on this device.");
    reader.readAsText(file);
  };

  const runBacktest = () => {
    const startingCapital = Number(capital);
    const qty = Number(quantity);
    const fast = Math.max(2, Math.floor(Number(fastPeriod)));
    const slow = Math.max(fast + 1, Math.floor(Number(slowPeriod)));
    const stop = Number(stopLoss);
    const take = Number(target);
    const fees = Number(cost);
    const dailyLimit = Math.max(1, Math.floor(Number(maxTradesPerDay)));

    if (!bars.length) return setMessage("Choose a historical CSV file first.");
    if (!fromDate || !toDate || fromDate > toDate) return setMessage("Choose a valid date range: From must be on or before To.");
    if (visibleBars.length === 0) return setMessage("No candles match this asset class, symbol and date range. Adjust the filters or upload matching data.");
    if (![startingCapital, qty, stop, take, fees, dailyLimit].every(Number.isFinite) || startingCapital <= 0 || qty <= 0 || stop < 0 || take < 0 || fees < 0 || dailyLimit < 1) {
      return setMessage("Check the capital, quantity, costs and risk fields. Capital and quantity must be above zero.");
    }
    if (strategy === "ema" && (!Number.isFinite(fast) || !Number.isFinite(slow) || fast >= slow)) {
      return setMessage("EMA fast period must be a positive number smaller than the slow period.");
    }

    const grouped = new Map<string, Bar[]>();
    visibleBars.forEach((bar) => grouped.set(bar.date, [...(grouped.get(bar.date) || []), bar]));
    const trades: ResultTrade[] = [];

    grouped.forEach((dayBars, date) => {
      const closes = dayBars.map((bar) => bar.close);
      const fastEma = ema(closes, fast);
      const slowEma = ema(closes, slow);
      const rsiValues = rsi(closes);
      let dailyTrades = 0;
      let cursor = strategy === "ema" ? slow : 20;

      while (cursor < dayBars.length && dailyTrades < dailyLimit) {
        let entrySignal = false;
        if (strategy === "ema" && cursor > 0) {
          entrySignal = fastEma[cursor - 1] <= slowEma[cursor - 1] && fastEma[cursor] > slowEma[cursor];
        } else if (strategy === "rsi" && cursor > 0) {
          entrySignal = rsiValues[cursor - 1] < 30 && rsiValues[cursor] >= 30;
        } else if (strategy === "breakout" && cursor >= 20) {
          const previousHigh = Math.max(...dayBars.slice(cursor - 20, cursor).map((bar) => bar.high));
          entrySignal = dayBars[cursor].close > previousHigh;
        }
        if (!entrySignal) {
          cursor++;
          continue;
        }

        const entryIndex = cursor;
        const entryPrice = dayBars[entryIndex].close;
        let exitIndex = dayBars.length - 1;
        let exitPrice = dayBars[exitIndex].close;
        let reason = "Session close";
        for (let next = entryIndex + 1; next < dayBars.length; next++) {
          const bar = dayBars[next];
          const stopPrice = stop > 0 ? entryPrice * (1 - stop / 100) : -Infinity;
          const targetPrice = take > 0 ? entryPrice * (1 + take / 100) : Infinity;
          // Conservative same-candle rule: if both prices are touched, count the stop first.
          if (bar.low <= stopPrice) {
            exitIndex = next;
            exitPrice = stopPrice;
            reason = "Stop loss";
            break;
          }
          if (bar.high >= targetPrice) {
            exitIndex = next;
            exitPrice = targetPrice;
            reason = "Target";
            break;
          }
          let exitSignal = false;
          if (strategy === "ema") exitSignal = fastEma[next - 1] >= slowEma[next - 1] && fastEma[next] < slowEma[next];
          else if (strategy === "rsi") exitSignal = rsiValues[next] >= 70;
          else exitSignal = bar.close < ema(closes.slice(0, next + 1), 10)[next];
          if (exitSignal) {
            exitIndex = next;
            exitPrice = bar.close;
            reason = "Strategy exit";
            break;
          }
        }
        const pnl = (exitPrice - entryPrice) * qty - fees;
        trades.push({ date, symbol: dayBars[entryIndex].symbol, entryTime: dayBars[entryIndex].time, exitTime: dayBars[exitIndex].time, entry: entryPrice, exit: exitPrice, quantity: qty, pnl, reason });
        dailyTrades++;
        cursor = exitIndex + 1;
      }
    });

    setResults(trades);
    setRunInfo(`${visibleBars.length.toLocaleString()} candles · ${datesInRange} trading dates · ${fileName}`);
    setMessage(trades.length ? `Backtest complete: ${trades.length} same-day trade(s) generated. Results use uploaded data and the selected assumptions.` : "Backtest completed with no entry signals in the selected data and date range. Try a different strategy, timeframe or range.");
  };

  const metrics = useMemo(() => {
    const wins = results.filter((trade) => trade.pnl > 0);
    const losses = results.filter((trade) => trade.pnl < 0);
    const grossProfit = wins.reduce((sum, trade) => sum + trade.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0));
    let equity = Number(capital) || 0;
    let peak = equity;
    let maxDrawdown = 0;
    results.forEach((trade) => {
      equity += trade.pnl;
      peak = Math.max(peak, equity);
      maxDrawdown = Math.max(maxDrawdown, peak - equity);
    });
    return {
      pnl: results.reduce((sum, trade) => sum + trade.pnl, 0),
      winRate: results.length ? (wins.length / results.length) * 100 : 0,
      profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      maxDrawdown,
      finalEquity: equity,
    };
  }, [capital, results]);

  const formatMoney = (value: number) => `${currency} ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const downloadTrades = () => {
    if (!results.length) return;
    const rows = [
      ["Date", "Symbol", "Entry Time", "Exit Time", "Entry Price", "Exit Price", "Quantity", "P&L", "Exit Reason"],
      ...results.map((trade) => [trade.date, trade.symbol, trade.entryTime, trade.exitTime, trade.entry, trade.exit, trade.quantity, trade.pnl.toFixed(2), trade.reason]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "algorunway-backtest-trades.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const setSegment = (value: AssetClass) => {
    setAssetClass(value);
    setCurrency(value === "India" ? "INR" : value === "Crypto" ? "USDT" : "USD");
  };

  const labelStyle: React.CSSProperties = { display: "block", fontWeight: 600, fontSize: 13 };
  const metricsList = [
    ["Net P&L", formatMoney(metrics.pnl)],
    ["Win rate", `${metrics.winRate.toFixed(1)}%`],
    ["Trades", String(results.length)],
    ["Profit factor", Number.isFinite(metrics.profitFactor) ? metrics.profitFactor.toFixed(2) : "∞"],
    ["Max drawdown", formatMoney(metrics.maxDrawdown)],
    ["Ending capital", formatMoney(metrics.finalEquity)],
  ];

  return (
    <section id="backtest" style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "start" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: 6 }}>Historical Backtest</h2>
          <p style={{ color: "#64748b", marginTop: 0 }}>Test an intraday strategy on your own OHLC history. Data stays in this browser.</p>
        </div>
        <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 20, padding: "7px 11px", fontSize: 12, fontWeight: 700 }}>CSV BASED · PAPER ANALYSIS</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <label style={labelStyle}>Market segment
          <select style={inputStyle} value={assetClass} onChange={(e) => setSegment(e.target.value as AssetClass)}>
            <option>India</option><option>Crypto</option><option>Forex</option>
          </select>
        </label>
        <label style={labelStyle}>Strategy
          <select style={inputStyle} value={strategy} onChange={(e) => setStrategy(e.target.value as Strategy)}>
            <option value="ema">EMA crossover</option><option value="rsi">RSI reversal (14)</option><option value="breakout">20-bar breakout</option>
          </select>
        </label>
        <label style={labelStyle}>CSV symbol
          <select style={inputStyle} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            <option value="ALL">All symbols</option>{symbols.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label style={labelStyle}>Data currency
          <input style={inputStyle} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 8))} maxLength={8} />
        </label>
        <label style={labelStyle}>From date
          <input style={inputStyle} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label style={labelStyle}>To date
          <input style={inputStyle} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <label style={labelStyle}>Starting capital
          <input style={inputStyle} type="number" min="0.01" step="any" value={capital} onChange={(e) => setCapital(e.target.value)} />
        </label>
        <label style={labelStyle}>Quantity per trade
          <input style={inputStyle} type="number" min="0.000001" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </label>
        <label style={labelStyle}>Max trades per day
          <input style={inputStyle} type="number" min="1" step="1" value={maxTradesPerDay} onChange={(e) => setMaxTradesPerDay(e.target.value)} />
        </label>
        <label style={labelStyle}>Stop loss (%) · 0 disables
          <input style={inputStyle} type="number" min="0" step="0.1" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} />
        </label>
        <label style={labelStyle}>Target (%) · 0 disables
          <input style={inputStyle} type="number" min="0" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label style={labelStyle}>Estimated cost / trade
          <input style={inputStyle} type="number" min="0" step="any" value={cost} onChange={(e) => setCost(e.target.value)} />
        </label>
        {strategy === "ema" && <>
          <label style={labelStyle}>Fast EMA
            <input style={inputStyle} type="number" min="2" step="1" value={fastPeriod} onChange={(e) => setFastPeriod(e.target.value)} />
          </label>
          <label style={labelStyle}>Slow EMA
            <input style={inputStyle} type="number" min="3" step="1" value={slowPeriod} onChange={(e) => setSlowPeriod(e.target.value)} />
          </label>
        </>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 16 }}>
        <label style={{ ...labelStyle, border: "1px solid #cbd5e1", borderRadius: 7, padding: "9px 12px", cursor: "pointer" }}>
          Choose historical CSV
          <input type="file" accept=".csv,text/csv" onChange={readFile} style={{ display: "block", marginTop: 6, maxWidth: "100%" }} />
        </label>
        <button type="button" onClick={runBacktest} style={{ border: 0, borderRadius: 7, padding: "11px 16px", background: "#2563eb", color: "white", fontWeight: 700, cursor: "pointer" }}>Run Backtest</button>
        <button type="button" onClick={downloadTrades} disabled={!results.length} style={{ border: 0, borderRadius: 7, padding: "11px 16px", background: results.length ? "#e2e8f0" : "#f1f5f9", color: "#0f172a", fontWeight: 700, cursor: results.length ? "pointer" : "not-allowed" }}>Download trades CSV</button>
      </div>

      <p role="status" aria-live="polite" style={{ background: "#f8fafc", borderRadius: 8, padding: 12, color: "#334155", marginBottom: 0 }}>
        {message}{fileName && <span style={{ display: "block", color: "#64748b", fontSize: 12, marginTop: 4 }}>{fileName} · {bars.length.toLocaleString()} total candles · {visibleBars.length.toLocaleString()} match filters · {datesInRange} dates</span>}
      </p>

      <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.55 }}>
        CSV columns: Date, Open, High, Low, Close; Time, Symbol and Market are optional. Add a Market column (India/Crypto/Forex) for mixed files. The chosen dates are inclusive; default range is 01 Jan 2010 through 13 Nov 2026. Strategy fills use your uploaded candles, same-day exits, long-only trades, and stop-first handling when one candle touches both stop and target. This is historical simulation, not a live feed or guaranteed result.
      </p>

      {runInfo && <p style={{ color: "#64748b", fontSize: 12 }}>{runInfo}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 10, marginTop: 12 }}>
        {metricsList.map(([label, value]) => <div key={label} style={{ background: "#f8fafc", borderRadius: 8, padding: 12 }}><div style={{ color: "#64748b", fontSize: 12 }}>{label}</div><strong style={{ display: "block", marginTop: 6, color: label === "Net P&L" ? metrics.pnl >= 0 ? "#15803d" : "#dc2626" : "#0f172a" }}>{value}</strong></div>)}
      </div>

      {results.length > 0 && <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr style={{ background: "#f1f5f9" }}>{["Date", "Symbol", "Entry", "Exit", "Entry price", "Exit price", "Qty", `P&L (${currency})`, "Exit reason"].map((heading) => <th key={heading} style={{ padding: 9, textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>{heading}</th>)}</tr></thead>
          <tbody>{results.map((trade, index) => <tr key={`${trade.date}-${trade.entryTime}-${index}`}>
            {[trade.date, trade.symbol, trade.entryTime, trade.exitTime, trade.entry.toFixed(4), trade.exit.toFixed(4), trade.quantity, trade.pnl.toFixed(2), trade.reason].map((value, cellIndex) => <td key={cellIndex} style={{ padding: 9, borderBottom: "1px solid #e2e8f0", color: cellIndex === 7 ? trade.pnl >= 0 ? "#15803d" : "#dc2626" : undefined }}>{value}</td>)}
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}
