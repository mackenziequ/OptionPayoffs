import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Trash2, Plus, Minus, Copy } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

const OptionStrategyBuilder = () => {
  const [positions, setPositions] = useState([]);
  const [nextId, setNextId] = useState(1);
  const [chartData, setChartData] = useState([]);
  const [ticker, setTicker] = useState('');
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedExpiration, setSelectedExpiration] = useState('');
  const [cachedData, setCachedData] = useState({});
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [previewStrike, setPreviewStrike] = useState(null);

  // Option building blocks
  const buildingBlocks = [
    { type: 'call', action: 'buy', label: 'Buy Call', color: 'bg-green-500', icon: TrendingUp },
    { type: 'call', action: 'sell', label: 'Sell Call', color: 'bg-red-500', icon: TrendingDown },
    { type: 'put', action: 'buy', label: 'Buy Put', color: 'bg-blue-500', icon: TrendingDown },
    { type: 'put', action: 'sell', label: 'Sell Put', color: 'bg-orange-500', icon: TrendingUp },
  ];

  // Helper to round strikes to nearest 5
  const roundToNearest5 = (value) => Math.round(value / 5) * 5;

  useEffect(() => {
    calculatePayoff();
  }, [positions, marketData?.current_price]);

  useEffect(() => {
    // Auto-load premiums for all positions when expiration changes
    if (marketData && selectedExpiration && positions.length > 0) {
      positions.forEach(pos => {
        loadOptionPremium(pos);
      });
    }
  }, [selectedExpiration, marketData]);

  useEffect(() => {
    // Auto-update premiums when strike changes (if market data available)
    if (marketData && selectedExpiration && positions.length > 0) {
      positions.forEach(pos => {
        loadOptionPremium(pos);
      });
    }
  }, [positions]);

  const addPosition = (type, action, strikeOverride = null) => {
    const strike = strikeOverride !== null ? roundToNearest5(strikeOverride) : roundToNearest5(marketData?.current_price || 100);
    const newPosition = {
      id: nextId,
      type,
      action,
      strike,
      quantity: 1,
      premium: 5,
    };
    setPositions([...positions, newPosition]);
    setNextId(nextId + 1);
  };

  const removePosition = (id) => {
    setPositions(positions.filter(p => p.id !== id));
  };

  const updatePosition = (id, field, value) => {
    const newVal = parseFloat(value) || 0;
    
    setPositions(prevPositions => {
      const updated = prevPositions.map(p => {
        if (p.id === id) {
          // Round strike to nearest 5
          if (field === 'strike') {
            const rounded = roundToNearest5(newVal);
            // Trigger premium update from backend after strike changes
            setTimeout(() => {
              loadOptionPremium({ ...p, strike: rounded });
            }, 0);
            return { ...p, [field]: rounded };
          } else if (field === 'premium') {
            // When premium changes, find the corresponding strike
            setTimeout(() => {
              findStrikeFromPremium({ ...p, premium: newVal }, newVal);
            }, 0);
            return { ...p, [field]: newVal };
          }
          return { ...p, [field]: newVal };
        }
        return p;
      });
      return updated;
    });
  };

  const duplicatePosition = (position) => {
    const newPosition = {
      ...position,
      id: nextId,
    };
    setPositions([...positions, newPosition]);
    setNextId(nextId + 1);
  };

  const calculatePayoff = () => {
    if (positions.length === 0) {
      setChartData([]);
      return;
    }

    const spotPrice = marketData?.current_price || 100;
    const priceRange = [];
    const minPrice = Math.max(10, spotPrice * 0.7);
    const maxPrice = spotPrice * 1.3;
    const steps = 100;

    for (let i = 0; i <= steps; i++) {
      const price = minPrice + (maxPrice - minPrice) * (i / steps);
      let totalPayoff = 0;
      let totalCost = 0;

      positions.forEach(pos => {
        let payoff = 0;
        const cost = pos.premium * pos.quantity * (pos.action === 'buy' ? -1 : 1);
        totalCost += cost;

        if (pos.type === 'call') {
          const intrinsic = Math.max(0, price - pos.strike);
          payoff = intrinsic * pos.quantity * (pos.action === 'buy' ? 1 : -1);
        } else { // put
          const intrinsic = Math.max(0, pos.strike - price);
          payoff = intrinsic * pos.quantity * (pos.action === 'buy' ? 1 : -1);
        }

        totalPayoff += payoff;
      });

      priceRange.push({
        price: Math.round(price * 100) / 100,
        payoff: Math.round((totalPayoff + totalCost) * 100) / 100,
        intrinsic: Math.round(totalPayoff * 100) / 100,
      });
    }

    setChartData(priceRange);
  };

  const getStrategyName = () => {
    if (positions.length === 0) return 'No Strategy';
    if (positions.length === 1) {
      const p = positions[0];
      return `${p.action === 'buy' ? 'Long' : 'Short'} ${p.type === 'call' ? 'Call' : 'Put'}`;
    }

    // Detect common strategies
    const calls = positions.filter(p => p.type === 'call').sort((a, b) => a.strike - b.strike);
    const puts = positions.filter(p => p.type === 'put').sort((a, b) => a.strike - b.strike);

    // Bull Call Spread
    if (calls.length === 2 && puts.length === 0) {
      if (calls[0].action === 'buy' && calls[1].action === 'sell' && calls[0].strike < calls[1].strike) {
        return 'Bull Call Spread';
      }
    }

    // Bear Put Spread
    if (puts.length === 2 && calls.length === 0) {
      if (puts[1].action === 'buy' && puts[0].action === 'sell' && puts[1].strike > puts[0].strike) {
        return 'Bear Put Spread';
      }
    }

    // Straddle
    if (calls.length === 1 && puts.length === 1 && calls[0].strike === puts[0].strike) {
      if (calls[0].action === puts[0].action) {
        return calls[0].action === 'buy' ? 'Long Straddle' : 'Short Straddle';
      }
    }

    // Strangle
    if (calls.length === 1 && puts.length === 1 && calls[0].strike > puts[0].strike) {
      if (calls[0].action === puts[0].action) {
        return calls[0].action === 'buy' ? 'Long Strangle' : 'Short Strangle';
      }
    }

    // Iron Condor
    if (calls.length === 2 && puts.length === 2) {
      const putSpread = puts[1].action === 'buy' && puts[0].action === 'sell';
      const callSpread = calls[0].action === 'sell' && calls[1].action === 'buy';
      if (putSpread && callSpread) {
        return 'Iron Condor';
      }
    }

    // Butterfly
    if (calls.length === 3 && puts.length === 0) {
      if (calls[0].action === 'buy' && calls[1].action === 'sell' && calls[2].action === 'buy' &&
          calls[1].quantity === 2) {
        return 'Call Butterfly';
      }
    }

    return 'Custom Strategy';
  };

  const clearAll = () => {
    setPositions([]);
  };

  const handleExpirationChange = async (expiration) => {
    setSelectedExpiration(expiration);
  };

  const fetchMarketData = async () => {
    if (!ticker) {
      alert('Please enter a ticker symbol');
      return;
    }

    const upperTicker = ticker.toUpperCase();

    // Check if data is already cached
    if (cachedData[upperTicker]) {
      const data = cachedData[upperTicker];
      setMarketData(data);
      setSelectedExpiration(data.expiration);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/market-data/${upperTicker}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch market data');
      }

      const data = await response.json();
      
      // Cache the data
      setCachedData(prev => ({
        ...prev,
        [upperTicker]: data
      }));
      
      setMarketData(data);
      setSelectedExpiration(data.expiration);
    } catch (error) {
      alert(`Error: ${error.message}. Make sure backend is running and ticker is valid.`);
    } finally {
      setLoading(false);
    }
  };

  const loadOptionPremium = async (position) => {
    if (!marketData || !selectedExpiration) return;

    try {
      const response = await fetch(
        `http://localhost:8000/api/option-premium/${marketData.ticker}/${selectedExpiration}/${position.type}/${position.strike}`
      );
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      setPositions(prevPositions =>
        prevPositions.map(p => 
          p.id === position.id 
            ? { ...p, premium: parseFloat(data.premium.toFixed(2)) }
            : p
        )
      );
    } catch (error) {
      console.error('Error loading premium:', error);
    }
  };

  const findStrikeFromPremium = async (position, targetPremium) => {
    if (!marketData || !selectedExpiration) return;

    try {
      // Call backend to find strike from premium using linear interpolation
      const response = await fetch(
        `http://localhost:8000/api/option-premium/${marketData.ticker}/${selectedExpiration}/${position.type}/${position.strike}`,
        {
          method: 'GET',
        }
      );
      
      if (!response.ok) return;
      
      const data = await response.json();
      // Backend should return interpolated strike for given premium
      if (data.strike) {
        setPositions(prevPositions =>
          prevPositions.map(p => 
            p.id === position.id 
              ? { ...p, strike: roundToNearest5(data.strike) }
              : p
          )
        );
      }
    } catch (error) {
      console.error('Error finding strike from premium:', error);
    }
  };

  const getMaxProfit = () => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map(d => d.payoff));
  };

  const getMaxLoss = () => {
    if (chartData.length === 0) return 0;
    return Math.min(...chartData.map(d => d.payoff));
  };

  const getBreakevens = () => {
    if (chartData.length < 2) return [];
    const breakevens = [];
    
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const curr = chartData[i];
      
      if ((prev.payoff <= 0 && curr.payoff >= 0) || (prev.payoff >= 0 && curr.payoff <= 0)) {
        // Linear interpolation to find exact breakeven
        const ratio = Math.abs(prev.payoff) / (Math.abs(prev.payoff) + Math.abs(curr.payoff));
        const breakeven = prev.price + (curr.price - prev.price) * ratio;
        breakevens.push(Math.round(breakeven * 100) / 100);
      }
    }
    
    return breakevens;
  };

  const handleBlockDragStart = (e, block) => {
    setDraggedBlock(block);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleChartDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    
    if (draggedBlock && chartData.length > 0) {
      // Find nearest price point to mouse position
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const index = Math.round(ratio * (chartData.length - 1));
      const nearestPrice = chartData[index]?.price || marketData?.current_price;
      
      if (nearestPrice) {
        const strike = roundToNearest5(nearestPrice);
        // Generate payoff line for this single option at this strike
        const payoffLine = generateOptionPayoff(draggedBlock.type, draggedBlock.action, strike);
        setPreviewStrike({ strike, block: draggedBlock, payoffLine });
      }
    }
  };

  const generateOptionPayoff = (type, action, strike) => {
    if (chartData.length === 0) return [];
    
    return chartData.map(point => {
      const price = point.price;
      let payoff = 0;
      
      if (type === 'call') {
        const intrinsic = Math.max(0, price - strike);
        payoff = intrinsic * (action === 'buy' ? 1 : -1);
      } else { // put
        const intrinsic = Math.max(0, strike - price);
        payoff = intrinsic * (action === 'buy' ? 1 : -1);
      }
      
      return {
        price: point.price,
        payoff: payoff
      };
    });
  };

  const handleChartDragLeave = () => {
    setPreviewStrike(null);
  };

  const handleChartDrop = (e) => {
    e.preventDefault();
    if (draggedBlock && previewStrike) {
      addPosition(draggedBlock.type, draggedBlock.action, previewStrike.strike);
    }
    setDraggedBlock(null);
    setPreviewStrike(null);
  };

  return (
    <div className="app-container">
      <div className="app-wrapper">
        {/* Header */}
        <div className="app-header">
          <h1 className="app-title">Option Strategy Builder</h1>
          <p className="app-subtitle">Design, visualize, and analyze complex option strategies in real-time</p>
        </div>

        <div className="three-column-grid">
          {/* Column 1: Market Data & Building Blocks */}
          <div className="column-1">
            {/* Market Data Card */}
            <div className="card">
              <h3 className="card-title">
                <span className="card-title-icon"></span> Market Data
              </h3>
              
              <div className="form-group">
                <label className="form-label">Ticker</label>
                <input
                  type="text"
                  placeholder="e.g., AAPL"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  onKeyUp={(e) => e.key === 'Enter' && fetchMarketData()}
                  className="form-input"
                />
              </div>
              
              <button
                onClick={fetchMarketData}
                disabled={loading || !ticker}
                className="btn btn-primary"
              >
                {loading ? 'Loading...' : 'Load Data'}
              </button>

              {marketData && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(218, 165, 165, 0.2)' }}>
                  <div className="current-price-card">
                    <div className="current-price-label">Current Price</div>
                    <div className="current-price-value">${marketData.current_price.toFixed(2)}</div>
                    <div className="price-ticker">{marketData.ticker}</div>
                  </div>

                  {marketData.expirations && marketData.expirations.length > 0 && (
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label className="form-label">Expiration</label>
                      <select
                        value={selectedExpiration}
                        onChange={(e) => setSelectedExpiration(e.target.value)}
                        className="form-select"
                      >
                        <option value="">-- Select --</option>
                        {marketData.expirations.map((exp) => (
                          <option key={exp} value={exp}>
                            {exp}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Building Blocks */}
            <div className="card">
              <h3 className="card-title">Building Blocks</h3>
              <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
                Drag onto the chart to add legs
              </p>
              <div className="building-blocks-grid">
                {buildingBlocks.map((block, idx) => (
                  <button
                    key={idx}
                    draggable
                    onDragStart={(e) => handleBlockDragStart(e, block)}
                    onClick={() => addPosition(block.type, block.action)}
                    className={`block-btn ${block.color}`}
                    style={{ cursor: 'grab' }}
                  >
                    <block.icon size={20} />
                    <span className="block-btn-label">{block.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: P&L Summary, Positions, Chart */}
          <div className="column-2">
            {/* P&L Summary */}
            {positions.length > 0 && chartData.length > 0 && (
              <div className="card">
                <h3 className="card-title">P&L Summary</h3>
                <div className="pnl-summary">
                  <div className="pnl-card pnl-profit">
                    <div className="pnl-label">Max Profit</div>
                    <div className="pnl-value">${getMaxProfit().toFixed(2)}</div>
                  </div>
                  <div className="pnl-card pnl-loss">
                    <div className="pnl-label">Max Loss</div>
                    <div className="pnl-value">${getMaxLoss().toFixed(2)}</div>
                  </div>
                  <div className="pnl-card pnl-breakeven">
                    <div className="pnl-label">Breakeven</div>
                    <div className="pnl-value">
                      {getBreakevens().length > 0 
                        ? getBreakevens().map(be => `$${be}`).join(', ')
                        : 'None'
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Positions Table */}
            {positions.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-header-left">
                    <h3 className="card-header-title">Positions</h3>
                    <p className="card-header-subtitle">{positions.length} active</p>
                  </div>
                  <button
                    onClick={() => setPositions([])}
                    className="btn btn-danger btn-small btn-icon"
                  >
                    <Trash2 size={14} />
                    Clear
                  </button>
                </div>

                <div className="positions-table-container">
                  <table className="positions-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Pos</th>
                        <th>Strike</th>
                        <th>Premium</th>
                        <th>Qty</th>
                        <th>Act</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => (
                        <tr key={pos.id}>
                          <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'white', }}>{pos.type === 'call' ? 'Call' : 'Put'}</span>
                          </td>
                          <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                            <span style={{ fontSize: '0.85rem', color: 'white' }}>{pos.action === 'buy' ? 'Long' : 'Short'}</span>
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input
                              type="number"
                              value={pos.strike}
                              onChange={(e) => updatePosition(pos.id, 'strike', e.target.value)}
                              className="position-input"
                              step="5"
                            />
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input
                              type="number"
                              value={pos.premium}
                              onChange={(e) => updatePosition(pos.id, 'premium', e.target.value)}
                              className="position-input"
                              step="0.5"
                            />
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input
                              type="number"
                              value={pos.quantity}
                              onChange={(e) => updatePosition(pos.id, 'quantity', e.target.value)}
                              className="position-input"
                              min="1"
                            />
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <div className="action-buttons">
                              <button
                                onClick={() => duplicatePosition(pos)}
                                className="action-btn action-btn-duplicate"
                                title="Duplicate"
                              >
                                <Copy size={10} />
                              </button>
                              <button
                                onClick={() => removePosition(pos.id)}
                                className="action-btn action-btn-delete"
                                title="Remove"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payoff Chart */}
            {chartData.length > 0 && (
              <div className="card">
                <h3 className="card-title">P&L Curve</h3>
                <div 
                  className="chart-container"
                  onDragOver={handleChartDragOver}
                  onDragLeave={handleChartDragLeave}
                  onDrop={handleChartDrop}
                  style={{ position: 'relative' }}
                >
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.3)" horizontal={true} vertical={true} />
                      <XAxis 
                        dataKey="price" 
                        stroke="rgba(255,255,255,0.5)"
                        label={{ value: 'Underlying Price ($)', position: 'insideBottom', offset: -5, fill: 'rgba(255,255,255,0.7)' }}
                      />
                      <YAxis 
                        stroke="rgba(255,255,255,0.5)"
                        label={{ value: 'Profit/Loss ($)', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.7)' }}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px' }}
                        formatter={(value) => `$${value}`}
                        labelFormatter={(label) => `Price: $${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="payoff" 
                        stroke="#a78bfa" 
                        strokeWidth={3}
                        name="Total P&L"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="intrinsic" 
                        stroke="#4ade80" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Intrinsic Value"
                        dot={false}
                        isAnimationActive={false}
                      />
                      {previewStrike && previewStrike.payoffLine && (
                        <Line 
                          type="monotone" 
                          data={previewStrike.payoffLine}
                          dataKey="payoff" 
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          strokeDasharray="3 3"
                          name="Preview Payoff"
                          dot={false}
                          isAnimationActive={false}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                  {previewStrike && (
                    <div style={{
                      position: 'absolute',
                      bottom: '20px',
                      right: '20px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      color: '#f59e0b',
                      fontSize: '0.875rem',
                      pointerEvents: 'none'
                    }}>
                      <div><strong>Strike: ${previewStrike.strike}</strong></div>
                      <div>{previewStrike.block.action === 'buy' ? 'Buy' : 'Sell'} {previewStrike.block.type === 'call' ? 'Call' : 'Put'}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {positions.length === 0 && (
              <div className="card empty-state">
                <p className="empty-state-text">Click or drag a building block to start creating your strategy</p>
              </div>
            )}
          </div>

          {/* Column 3: Fwd Curve, IV Surface, Greeks */}
          <div className="column-3">
            {/* Fwd Curve */}
            <div className="card">
              <h3 className="card-title">FWD Curve</h3>
              <div className="placeholder-content">
                <div className="placeholder-text">
                  <p className="placeholder-main">Forward curve visualization</p>
                  <p className="placeholder-sub">Coming soon...</p>
                </div>
              </div>
            </div>

            {/* IV Surface */}
            <div className="card">
              <h3 className="card-title">IV Surface</h3>
              <div className="placeholder-content">
                <div className="placeholder-text">
                  <p className="placeholder-main">Implied volatility surface</p>
                  <p className="placeholder-sub">Coming soon...</p>
                </div>
              </div>
            </div>

            {/* Greeks */}
            <div className="card">
              <h3 className="card-title">Greeks</h3>
              {positions.length > 0 ? (
                <div className="greeks-container">
                  <div className="greek-box">
                    <div className="greek-label">Delta (Δ)</div>
                    <div className="greek-value">--</div>
                  </div>
                  <div className="greek-box">
                    <div className="greek-label">Gamma (Γ)</div>
                    <div className="greek-value">--</div>
                  </div>
                  <div className="greek-box">
                    <div className="greek-label">Theta (Θ)</div>
                    <div className="greek-value">--</div>
                  </div>
                  <div className="greek-box">
                    <div className="greek-label">Rho (ρ)</div>
                    <div className="greek-value">--</div>
                  </div>
                </div>
              ) : (
                <div className="placeholder-content">
                  <p className="placeholder-sub">Add positions to see Greeks</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionStrategyBuilder;
