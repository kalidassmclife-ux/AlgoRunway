"use client";

import { useMemo, useState } from "react";

type Strategy = { id: number; name: string; market: string; mode: "Paper" | "Live"; status: "Stopped" | "Running" };

export default function Home() {
  const [strategies, setStrategies] = useState<Strategy[]>([
    { id: 1, name: "NIFTY Weekly Options", market: "NIFTY", mode: "Paper", status: "Stopped" },
    { id: 2, name: "SENSEX Options", market: "SENSEX", mode: "Paper", status: "Stopped" },
  ]);
  const [selected, setSelected] = useState("NIFTY");
  const [risk, setRisk] = useState("1000");
  const [trades, setTrades] = useState("1");
  const [logs, setLogs] = useState<string[]>(["Dashboard initialized. Paper mode only.", "No broker connection or live orders are enabled."]);
  const runningCount = strategies.filter(s => s.status === "Running").length;
  const pnl = useMemo(() => 0, []);

  function toggle(id: number) {
    setStrategies(prev => prev.map(s => s.id === id ? { ...s, status: s.status === "Running" ? "Stopped" : "Running" } : s));
    const item = strategies.find(s => s.id === id);
    if (item) setLogs(prev => [`${new Date().toLocaleTimeString()} — ${item.name}: ${item.status === "Running" ? "stopped" : "paper session started"}`, ...prev].slice(0, 8));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div><div className="brand"><span className="brandmark">A</span> AlgoRunway</div><div className="sub">LOCAL TRADING WORKSPACE</div></div>
        <div className="right"><span className="pill"><i /> LOCALHOST</span><span className="paper">PAPER MODE</span></div>
      </header>

      <section className="hero">
        <div><p className="eyebrow">OVERVIEW / 01</p><h1>Trading command center</h1><p className="muted">Monitor your strategies and risk controls from one local dashboard.</p></div>
        <div className="date">{new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</div>
      </section>

      <section className="stats">
        <article className="stat"><span>Active strategies</span><strong>{runningCount}<small> / {strategies.length}</small></strong><em>Paper sessions</em></article>
        <article className="stat"><span>Today's P&amp;L</span><strong>₹{pnl.toLocaleString("en-IN")}</strong><em>Demo value — no market feed</em></article>
        <article className="stat"><span>Daily loss limit</span><strong>₹{Number(risk || 0).toLocaleString("en-IN")}</strong><em>Configured locally</em></article>
        <article className="stat"><span>Broker connection</span><strong className="disconnected">Not connected</strong><em>Live trading disabled</em></article>
      </section>

      <div className="columns">
        <section className="panel">
          <div className="panelhead"><div><p className="eyebrow">STRATEGY MANAGEMENT</p><h2>Your strategies</h2></div><span className="count">{strategies.length} CONFIGURED</span></div>
          <div className="strategylist">
            {strategies.map(s => <div className="strategy" key={s.id}>
              <div className="strategyicon">⌁</div><div className="strategyinfo"><b>{s.name}</b><span>{s.market} · {s.mode} execution</span></div>
              <span className={s.status === "Running" ? "status running" : "status"}>{s.status}</span>
              <button className={s.status === "Running" ? "stop" : "start"} onClick={() => toggle(s.id)}>{s.status === "Running" ? "Stop" : "Start paper"}</button>
            </div>)}
          </div>
          <div className="notice"><b>Safety:</b> These controls only change the dashboard's local demo state. They do not place orders or connect to Dhan.</div>
        </section>

        <section className="panel">
          <div className="panelhead"><div><p className="eyebrow">RISK CONTROLS</p><h2>Session limits</h2></div><span className="shield">⌑</span></div>
          <label>Market<select value={selected} onChange={e => setSelected(e.target.value)}><option>NIFTY</option><option>SENSEX</option><option>BANKNIFTY</option></select></label>
          <label>Maximum daily loss (₹)<input value={risk} inputMode="numeric" onChange={e => setRisk(e.target.value.replace(/[^0-9]/g, ""))} /></label>
          <label>Maximum trades per day<input value={trades} inputMode="numeric" onChange={e => setTrades(e.target.value.replace(/[^0-9]/g, ""))} /></label>
          <button className="save" onClick={() => setLogs(prev => [`${new Date().toLocaleTimeString()} — Risk settings saved: ${selected}, ₹${risk || 0} loss limit, ${trades || 0} trades`, ...prev].slice(0, 8))}>Save local settings</button>
          <p className="hint">Settings are for this demo session only; they are not yet persisted or enforced by an execution engine.</p>
        </section>
      </div>

      <section className="panel logpanel">
        <div className="panelhead"><div><p className="eyebrow">ACTIVITY</p><h2>System log</h2></div><span className="live">● LOCAL</span></div>
        {logs.map((log, i) => <div className="log" key={i}><span className="logdot" />{log}</div>)}
      </section>
      <footer>ALGORUNWAY · LOCAL DEVELOPMENT BUILD <span>Not financial advice · Live execution disabled</span></footer>
    </main>
  );
}
