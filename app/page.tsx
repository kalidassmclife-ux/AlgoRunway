
"use client";

import { useEffect, useMemo, useState } from "react";
import BacktestPanel from "./backtest-panel";

type Market = "NIFTY" | "SENSEX";
type OptionType = "CE" | "PE";
type TradeStatus = "OPEN" | "CLOSED";

type Strategy = {
  id: string;
  name: string;
  market: Market;
  running: boolean;
};

type Trade = {
  id: string;
  market: Market;
  optionType: OptionType;
  strike: number;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  status: TradeStatus;
  exitPrice?: number;
  exitReason?: string;
  openedAt: string;
  closedAt?: string;
};

type RiskSettings = {
  dailyLossLimit: number;
  stopLossPerTrade: number;
  targetPerTrade: number;
  maxTradesPerDay: number;
};

const STORAGE_KEY = "algorunway-paper-engine-v2";

const initialStrategies: Strategy[] = [
  {
    id: "nifty",
    name: "NIFTY Weekly Options",
    market: "NIFTY",
    running: false,
  },
  {
    id: "sensex",
    name: "SENSEX Options",
    market: "SENSEX",
    running: false,
  },
];

const initialRisk: RiskSettings = {
  dailyLossLimit: 1000,
  stopLossPerTrade: 500,
  targetPerTrade: 1000,
  maxTradesPerDay: 3,
};

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

const getTradeDay = (trade: Trade) =>
  new Date(trade.openedAt).toLocaleDateString("en-CA");

export default function Home() {
  const [mounted, setMounted] = useState(false);

  const [strategies, setStrategies] =
    useState<Strategy[]>(initialStrategies);

  const [risk, setRisk] = useState<RiskSettings>(initialRisk);

  const [trades, setTrades] = useState<Trade[]>([]);

  const [market, setMarket] = useState<Market>("NIFTY");
  const [optionType, setOptionType] = useState<OptionType>("CE");
  const [strike, setStrike] = useState("26000");
  const [quantity, setQuantity] = useState("65");
  const [entryPrice, setEntryPrice] = useState("150");
  const [priceUpdates, setPriceUpdates] = useState<Record<string, string>>(
    {}
  );

  const [message, setMessage] = useState(
    "Paper trading engine ready. No live orders are enabled."
  );

  const [logs, setLogs] = useState<string[]>([
    "AlgoRunway V2 initialized.",
    "Paper trading mode enabled.",
    "Live broker connection disabled.",
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed.trades)) {
          setTrades(parsed.trades);
        }

        if (parsed.risk) {
          setRisk({ ...initialRisk, ...parsed.risk });
        }

        if (Array.isArray(parsed.strategies)) {
          setStrategies(parsed.strategies);
        }
      }
    } catch {
      setMessage("Could not load saved paper trading data.");
    }

    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ trades, risk, strategies })
    );
  }, [mounted, trades, risk, strategies]);

  const todayTrades = useMemo(
    () => trades.filter((trade) => getTradeDay(trade) === todayKey()),
    [trades]
  );

  const openTrades = todayTrades.filter(
    (trade) => trade.status === "OPEN"
  );

  const allOpenTrades = trades.filter(
    (trade) => trade.status === "OPEN"
  );

  const closedTrades = todayTrades.filter(
    (trade) => trade.status === "CLOSED"
  );

  const realizedPnl = closedTrades.reduce(
    (total, trade) => total + trade.pnl,
    0
  );

  const unrealizedPnl = openTrades.reduce(
    (total, trade) => total + trade.pnl,
    0
  );

  const totalPnl = realizedPnl + unrealizedPnl;

  const tradesTakenToday = todayTrades.length;

  const dailyLossLocked = totalPnl <= -risk.dailyLossLimit;

  const addLog = (text: string) => {
    setLogs((previous) =>
      [`${new Date().toLocaleTimeString()} - ${text}`, ...previous].slice(
        0,
        30
      )
    );
  };

  const updateRisk = (
    field: keyof RiskSettings,
    value: string
  ) => {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue) || numberValue < 0) return;

    setRisk((previous) => ({
      ...previous,
      [field]: numberValue,
    }));
  };

  const toggleStrategy = (id: string) => {
    setStrategies((previous) =>
      previous.map((strategy) =>
        strategy.id === id
          ? { ...strategy, running: !strategy.running }
          : strategy
      )
    );

    const selected = strategies.find((strategy) => strategy.id === id);

    if (selected) {
      addLog(
        `${selected.name} ${
          selected.running ? "stopped" : "started"
        } in paper mode.`
      );
    }
  };

  const closeTrade = (
    trade: Trade,
    exitPrice: number,
    reason: string
  ) => {
    const finalPnl =
      (exitPrice - trade.entryPrice) * trade.quantity;

    return {
      ...trade,
      currentPrice: exitPrice,
      exitPrice,
      pnl: finalPnl,
      status: "CLOSED" as TradeStatus,
      exitReason: reason,
      closedAt: new Date().toISOString(),
    };
  };

  const openTrade = () => {
    const strikeValue = Number(strike);
    const quantityValue = Number(quantity);
    const entryValue = Number(entryPrice);

    if (
      !Number.isFinite(strikeValue) ||
      !Number.isFinite(quantityValue) ||
      !Number.isFinite(entryValue) ||
      strikeValue <= 0 ||
      quantityValue <= 0 ||
      entryValue <= 0
    ) {
      setMessage("Enter valid strike, quantity and entry premium.");
      return;
    }

    if (dailyLossLocked) {
      setMessage("Daily loss limit reached. New trades are blocked.");
      return;
    }

    if (
      risk.maxTradesPerDay > 0 &&
      tradesTakenToday >= risk.maxTradesPerDay
    ) {
      setMessage("Maximum trades per day reached.");
      return;
    }

    const newTrade: Trade = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      market,
      optionType,
      strike: strikeValue,
      quantity: quantityValue,
      entryPrice: entryValue,
      currentPrice: entryValue,
      pnl: 0,
      status: "OPEN",
      openedAt: new Date().toISOString(),
    };

    setTrades((previous) => [newTrade, ...previous]);
    setPriceUpdates((previous) => ({
      ...previous,
      [newTrade.id]: String(entryValue),
    }));

    setMessage("Paper trade opened successfully.");
    addLog(
      `Opened ${market} ${strikeValue} ${optionType}, quantity ${quantityValue}.`
    );
  };

  // Daily-loss protection is checked BEFORE individual SL/target exits.
  const updatePrice = (tradeId: string) => {
    const updatedPrice = Number(priceUpdates[tradeId]);

    if (!Number.isFinite(updatedPrice) || updatedPrice <= 0) {
      setMessage("Enter a valid market premium.");
      return;
    }

    const selectedTrade = trades.find(
      (trade) => trade.id === tradeId
    );

    if (!selectedTrade || selectedTrade.status !== "OPEN") return;

    const updatedTrades = trades.map((trade) => {
      if (trade.id !== tradeId) return trade;

      const newPnl =
        (updatedPrice - trade.entryPrice) * trade.quantity;

      return {
        ...trade,
        currentPrice: updatedPrice,
        pnl: newPnl,
      };
    });

    const currentDay = todayKey();

    const projectedDayPnl = updatedTrades
      .filter((trade) => getTradeDay(trade) === currentDay)
      .reduce((total, trade) => total + trade.pnl, 0);

    // First priority: daily loss protection.
    if (projectedDayPnl <= -risk.dailyLossLimit) {
      const protectedTrades = updatedTrades.map((trade) => {
        if (
          getTradeDay(trade) === currentDay &&
          trade.status === "OPEN"
        ) {
          return closeTrade(
            trade,
            trade.currentPrice,
            "Daily loss protection"
          );
        }

        return trade;
      });

      setTrades(protectedTrades);
      setMessage(
        "Daily loss limit reached. All today's open paper trades have been closed."
      );
      addLog("DAILY LOSS LIMIT: all today's open trades closed.");
      return;
    }

    // Second priority: individual stop-loss and target.
    const finalTrades = updatedTrades.map((trade) => {
      if (
        trade.id !== tradeId ||
        trade.status !== "OPEN"
      ) {
        return trade;
      }

      if (trade.pnl <= -risk.stopLossPerTrade) {
        addLog(`Stop-loss triggered for ${trade.market} ${trade.strike}.`);

        return closeTrade(
          trade,
          trade.currentPrice,
          "Per-trade stop-loss"
        );
      }

      if (trade.pnl >= risk.targetPerTrade) {
        addLog(`Target reached for ${trade.market} ${trade.strike}.`);

        return closeTrade(
          trade,
          trade.currentPrice,
          "Per-trade target"
        );
      }

      return trade;
    });

    setTrades(finalTrades);
    setMessage("Paper premium updated successfully.");
  };

  const manuallyCloseTrade = (tradeId: string) => {
    const trade = trades.find((item) => item.id === tradeId);

    if (!trade || trade.status !== "OPEN") return;

    setTrades((previous) =>
      previous.map((item) =>
        item.id === tradeId
          ? closeTrade(item, item.currentPrice, "Manual close")
          : item
      )
    );

    setMessage("Paper position closed.");
    addLog(`Manually closed ${trade.market} ${trade.strike}.`);
  };

  const closeAllTrades = () => {
    if (allOpenTrades.length === 0) {
      setMessage("There are no open trades to close.");
      return;
    }

    setTrades((previous) =>
      previous.map((trade) => {
        if (trade.status === "OPEN") {
          return closeTrade(
            trade,
            trade.currentPrice,
            "Manual close all"
          );
        }

        return trade;
      })
    );

    setMessage("All open paper positions have been closed.");
    addLog("All open paper positions manually closed.");
  };

  const resetPaperData = () => {
    const confirmed = window.confirm(
      "Delete all saved V2 paper trades and reset risk settings?"
    );

    if (!confirmed) return;

    setTrades([]);
    setRisk(initialRisk);
    setPriceUpdates({});
    setStrategies(initialStrategies);
    setMessage("Paper trading data and risk settings reset.");
    addLog("Paper trading data reset.");
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

  const buttonStyle: React.CSSProperties = {
    padding: "9px 14px",
    borderRadius: 7,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
  };

  if (!mounted) {
    return <main style={{ padding: 30 }}>Loading AlgoRunway V2...</main>;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f1f5f9",
        color: "#0f172a",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "auto" }}>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 30 }}>AlgoRunway</h1>
            <p style={{ color: "#64748b", margin: "6px 0 0" }}>
              Risk Management V2 · Paper Trading Workspace
            </p>
          </div>

          <div
            style={{
              background: "#dcfce7",
              color: "#166534",
              padding: "9px 14px",
              borderRadius: 20,
              fontWeight: 700,
            }}
          >
            PAPER MODE ONLY
          </div>
        </header>

        <nav aria-label="Dashboard sections" style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
          {[["Overview", "#overview"], ["Paper Trading", "#paper-trading"], ["Backtest", "#backtest"]].map(([label, href]) => (
            <a key={href} href={href} style={{ color: "#1d4ed8", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: 7, padding: "9px 13px", textDecoration: "none", fontWeight: 600, fontSize: 13 }}>{label}</a>
          ))}
        </nav>

        <section id="overview"
          style={{
            ...panel,
            background: dailyLossLocked ? "#fee2e2" : "#eff6ff",
            borderColor: dailyLossLocked ? "#ef4444" : "#bfdbfe",
          }}
        >
          <strong>
            {dailyLossLocked
              ? "DAILY LOSS LIMIT BREACHED"
              : "SYSTEM STATUS"}
          </strong>
          <p style={{ marginBottom: 0 }}>
            {dailyLossLocked
              ? "New trades are blocked for today. Review your positions and risk settings."
              : message}
          </p>
          <p style={{ marginBottom: 0, color: "#475569" }}>
            Simulated premiums only. No live market feed, broker connection
            or real orders.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 18,
          }}
        >
          {[
            {
              label: "Today's P&L",
              value: money(totalPnl),
              color: totalPnl >= 0 ? "#15803d" : "#dc2626",
            },
            {
              label: "Realized P&L",
              value: money(realizedPnl),
              color: realizedPnl >= 0 ? "#15803d" : "#dc2626",
            },
            {
              label: "Unrealized P&L",
              value: money(unrealizedPnl),
              color: unrealizedPnl >= 0 ? "#15803d" : "#dc2626",
            },
            {
              label: "Trades Today",
              value: `${tradesTakenToday} / ${risk.maxTradesPerDay}`,
              color: "#0f172a",
            },
            {
              label: "Open Positions",
              value: String(allOpenTrades.length),
              color: "#0f172a",
            },
          ].map((item) => (
            <div key={item.label} style={panel}>
              <div style={{ color: "#64748b", fontSize: 13 }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: item.color,
                  marginTop: 8,
                }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </section>

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>1. Risk Management Settings</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 16,
            }}
          >
            <label>
              Daily Loss Limit (₹)
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={risk.dailyLossLimit}
                onChange={(e) =>
                  updateRisk("dailyLossLimit", e.target.value)
                }
              />
            </label>

            <label>
              Stop-Loss Per Trade (₹)
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={risk.stopLossPerTrade}
                onChange={(e) =>
                  updateRisk("stopLossPerTrade", e.target.value)
                }
              />
            </label>

            <label>
              Target Per Trade (₹)
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={risk.targetPerTrade}
                onChange={(e) =>
                  updateRisk("targetPerTrade", e.target.value)
                }
              />
            </label>

            <label>
              Maximum Trades Per Day
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={risk.maxTradesPerDay}
                onChange={(e) =>
                  updateRisk("maxTradesPerDay", e.target.value)
                }
              />
            </label>
          </div>

          <p style={{ color: "#64748b", fontSize: 13 }}>
            These limits apply globally to both NIFTY and SENSEX paper
            trades. Changes are saved in this browser.
          </p>
        </section>

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>2. Strategy Controls</h2>
          <p style={{ color: "#64748b", fontSize: 13 }}>
            Starting a strategy arms its local paper status only. This site has no live feed or strategy signal engine; use the manual paper order form below to simulate a trade.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
              gap: 14,
            }}
          >
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: 9,
                  padding: 14,
                }}
              >
                <strong>{strategy.name}</strong>
                <p style={{ color: "#64748b" }}>
                  Status: {strategy.running ? "Armed · paper only" : "Stopped"}
                </p>
                <button
                  style={{
                    ...buttonStyle,
                    background: strategy.running ? "#fee2e2" : "#dcfce7",
                    color: strategy.running ? "#991b1b" : "#166534",
                  }}
                  onClick={() => toggleStrategy(strategy.id)}
                >
                  {strategy.running ? "Disarm Strategy" : "Arm Paper Strategy"}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section id="paper-trading" style={panel}>
          <h2 style={{ marginTop: 0 }}>3. Open New Paper Trade</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 14,
            }}
          >
            <label>
              Market
              <select
                style={inputStyle}
                value={market}
                onChange={(e) => setMarket(e.target.value as Market)}
              >
                <option value="NIFTY">NIFTY</option>
                <option value="SENSEX">SENSEX</option>
              </select>
            </label>

            <label>
              Option Type
              <select
                style={inputStyle}
                value={optionType}
                onChange={(e) =>
                  setOptionType(e.target.value as OptionType)
                }
              >
                <option value="CE">CE</option>
                <option value="PE">PE</option>
              </select>
            </label>

            <label>
              Strike Price
              <input
                style={inputStyle}
                type="number"
                value={strike}
                onChange={(e) => setStrike(e.target.value)}
              />
            </label>

            <label>
              Quantity
              <input
                style={inputStyle}
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>

            <label>
              Entry Premium (₹)
              <input
                style={inputStyle}
                type="number"
                min="0.05"
                step="0.05"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
              />
            </label>
          </div>

          <button
            style={{
              ...buttonStyle,
              marginTop: 16,
              background: "#2563eb",
              color: "#ffffff",
            }}
            onClick={openTrade}
            disabled={dailyLossLocked}
          >
            Open Paper Trade
          </button>
        </section>

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>4. Open Positions & Price Updates</h2>

          {allOpenTrades.length === 0 ? (
            <p style={{ color: "#64748b" }}>No open positions.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 850,
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {[
                      "Market",
                      "Contract",
                      "Qty",
                      "Entry",
                      "Current",
                      "P&L",
                      "Update Premium",
                      "Action",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 10,
                          textAlign: "left",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {allOpenTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td style={{ padding: 10 }}>{trade.market}</td>
                      <td style={{ padding: 10 }}>
                        {trade.strike} {trade.optionType}
                      </td>
                      <td style={{ padding: 10 }}>{trade.quantity}</td>
                      <td style={{ padding: 10 }}>{trade.entryPrice}</td>
                      <td style={{ padding: 10 }}>{trade.currentPrice}</td>
                      <td
                        style={{
                          padding: 10,
                          fontWeight: 700,
                          color: trade.pnl >= 0 ? "#15803d" : "#dc2626",
                        }}
                      >
                        {money(trade.pnl)}
                      </td>
                      <td style={{ padding: 10 }}>
                        <input
                          style={{ ...inputStyle, minWidth: 90, margin: 0 }}
                          type="number"
                          min="0.05"
                          step="0.05"
                          value={
                            priceUpdates[trade.id] ??
                            String(trade.currentPrice)
                          }
                          onChange={(e) =>
                            setPriceUpdates((previous) => ({
                              ...previous,
                              [trade.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          style={{
                            ...buttonStyle,
                            background: "#dbeafe",
                            color: "#1d4ed8",
                            marginTop: 6,
                          }}
                          onClick={() => updatePrice(trade.id)}
                        >
                          Update
                        </button>
                      </td>
                      <td style={{ padding: 10 }}>
                        <button
                          style={{
                            ...buttonStyle,
                            background: "#fee2e2",
                            color: "#991b1b",
                          }}
                          onClick={() => manuallyCloseTrade(trade.id)}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            style={{
              ...buttonStyle,
              background: "#b91c1c",
              color: "#ffffff",
              marginTop: 14,
            }}
            onClick={closeAllTrades}
            disabled={allOpenTrades.length === 0}
          >
            Close All Open Positions
          </button>
        </section>

        <BacktestPanel />

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>5. Today's Trade History</h2>

          {todayTrades.length === 0 ? (
            <p style={{ color: "#64748b" }}>No trades recorded today.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 750,
                }}
              >
                <thead>
                  <tr style={{ background: "#f1f5f9" }}>
                    {[
                      "Market",
                      "Contract",
                      "Qty",
                      "Entry",
                      "Exit / Current",
                      "P&L",
                      "Status",
                      "Exit Reason",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 10,
                          textAlign: "left",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td style={{ padding: 10 }}>{trade.market}</td>
                      <td style={{ padding: 10 }}>
                        {trade.strike} {trade.optionType}
                      </td>
                      <td style={{ padding: 10 }}>{trade.quantity}</td>
                      <td style={{ padding: 10 }}>{trade.entryPrice}</td>
                      <td style={{ padding: 10 }}>
                        {trade.exitPrice ?? trade.currentPrice}
                      </td>
                      <td
                        style={{
                          padding: 10,
                          color: trade.pnl >= 0 ? "#15803d" : "#dc2626",
                          fontWeight: 700,
                        }}
                      >
                        {money(trade.pnl)}
                      </td>
                      <td style={{ padding: 10 }}>{trade.status}</td>
                      <td style={{ padding: 10 }}>
                        {trade.exitReason ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>6. System Logs</h2>
          <div
            style={{
              background: "#0f172a",
              color: "#cbd5e1",
              padding: 14,
              borderRadius: 8,
              maxHeight: 220,
              overflowY: "auto",
              fontFamily: "monospace",
              fontSize: 13,
            }}
          >
            {logs.map((log, index) => (
              <div key={`${index}-${log}`} style={{ marginBottom: 7 }}>
                {log}
              </div>
            ))}
          </div>
        </section>

        <section style={panel}>
          <h2 style={{ marginTop: 0 }}>7. Safety & Reset</h2>
          <p style={{ color: "#64748b" }}>
            Paper trades and risk settings are saved in this browser's
            local storage. They are not stored in a server database.
            Premiums must be entered manually. This simulator does not
            connect to Dhan or send live orders.
          </p>

          <button
            style={{
              ...buttonStyle,
              background: "#475569",
              color: "#ffffff",
            }}
            onClick={resetPaperData}
          >
            Reset V2 Paper Data
          </button>
        </section>

        <footer
          style={{
            textAlign: "center",
            color: "#64748b",
            padding: 18,
            fontSize: 13,
          }}
        >
          AlgoRunway V2 · Local Paper Trading · Live Trading Disabled
        </footer>
      </div>
    </main>
  );
}
