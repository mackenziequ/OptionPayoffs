import React, { useState } from 'react';
import './App.css'

export default function App(){
  const [leg_num, setLegNum] = useState(1);
  const [leg, setLeg] = useState({
    leg_name: `Leg${leg_num}`,
    S: '100',
    K: '110',
    T: '0.5',
    r: '0.04',
    sigma: '0.2',
    q: '0.0',
    opt_type: 'call'
  });


  const [premium, setPremium] = useState(null);
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState(null);

  function handleLegChange(e){ 
    const { name, value } = e.target;
    setLeg(prev => ({ ...prev, [name]: value})); 
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setPremium(null);
  
    const required = ['S', 'K', 'T', 'r', 'sigma', 'opt_type'];
    for (const key of required) {
      if (leg[key] === '' || leg[key] === null){ 
        setError(`Missing required field: ${key}`);
        return;
      }
    }
  
    const payload = {
      S: Number(leg.S),
      K: Number(leg.K),
      T: Number(leg.T),
      r: Number(leg.r),
      sigma: Number(leg.sigma),
      opt_type: leg.opt_type,
    };
    if (leg.q !== '') payload.q = Number(leg.q);

    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/bs/price', {
        method: 'POST', //?what other methods are there
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(payload)
      }); 

      if (!res.ok){
        const txt = await res.text();
        throw new Error(`Server ${res.status}: ${txt}`); 
      }

      const data = await res.json();
      setPremium(data.premium);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false); 
    }
  }

  function resetLeg() {
    setLeg({
      leg_name: `Leg${leg_num}`,
      S: '100',
      K: '110',
      T: '0.5',
      r: '0.04',
      sigma: '0.2',
      q: '0.0',
      opt_type: 'call'
    });
    setPremium(null);
    setError(null);
  }


  return(
    <div className='app-container'>
      <h1>Black-Scholes Pricer</h1>
      <div>
        <form onSubmit={handleSubmit} className='option-form'>
          <div className="option-leg">

            <label className="leg-field">
              <div className='leg-label'>{leg.leg_name}</div>
            </label>

            <label className="leg-field">
              <div className="form-label">  Option Type</div> 
              <select name = "opt_type" value={leg.opt_type} onChange={handleLegChange} className="form-select">
                <option value="call">Call</option>
                <option value="put">Put</option>
              </select>
            </label>

            <label className="leg-field">
              <div className="form-label">  Spot </div> 
              <input name = "S" type="number" step="any" value={leg.S} onChange={handleLegChange} className="form-input"></input>
            </label>

            <label className="leg-field">
              <div className="form-label">  Strike </div> 
              <input name="K" type="number" step="any" value={leg.K} onChange={handleLegChange} className="form-input" />
            </label>

            <label className="leg-field">
              <div className="form-label"> T(years) </div> 
              <input name="T" type="number" step="any" value={leg.T} onChange={handleLegChange} className="form-input" />
            </label>

            <label className="leg-field">
              <div className="form-label">  Risk-Free Rate </div> 
              <input name="r" type="number" step="any" value={leg.r} onChange={handleLegChange} className="form-input" />
            </label>

            <label className="leg-field">
              <div className="form-label">  Volatility </div> 
              <input name="sigma" type="number" step="any" value={leg.sigma} onChange={handleLegChange} className="form-input" />
            </label>

            <label className="leg-field">
              <div className="form-label">  Div Yield </div> 
              <input name="q" type="number" step="any" value={leg.q} onChange={handleLegChange} className="form-input" />
            </label>

            <label className="leg-field">
              {error && <div><strong>Error:</strong>{error}</div>}
              {premium !== null && !error &&(
                <div className='form-label'> Premium {String(premium)} </div>
              )}
            </label>



            <div className="leg-actions">
              <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Pricing...':'Price'}</button>
              <button type="button" onClick={resetLeg} className="btn btn-danger">Reset</button>
            </div>
          </div>
        </form>
      </div>
    
    </div>

  );
}