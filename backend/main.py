from dataclasses import dataclass
from urllib import response
from fastapi import FastAPI
import logging
from pydantic import BaseModel
import numpy as np
from typing import Optional
from scipy.stats import norm

# logging
logger = logging.getLogger(__name__)
app = FastAPI()


class Position():
    id: int 
    type: str # CALL/PUT
    expiry: str # yyyt-mm-dd
    action: str # BUT/SELL
    spot: str
    strike: float
    units: int 
    premium: float 
    price: Optional[float]

def bs_pricer(is_call, S, K, T, r, q, sigma):
    ds = np.maximum(1e-6, sigma * np.sqrt(T))
    dsig = 0.5 * ds ** 2
    F = S*np.exp(r-q)
    d2 = (np.log(F/K) - dsig) / ds
    d1 = d2 + ds

    if is_call:
        return F * norm.cdf(d1) - K*norm.cdf(d2)
    else:
        return K*norm.cdf(-d2) - F*norm.cdf(-d1)
    
class BSPricerRequest(BaseModel):
    S: float
    K: float 
    T: float
    r: float
    sigma: float
    q: Optional[float]
    opt_type: str

class BSPricerResponse(BaseModel):
    premium: float 


## End Point calls
@app.post("/api/bs/price", response_model=BSPricerResponse)
async def api_bs_price(req: BSPricerRequest):
    if req.q is None: 
        q = 0.0
    is_call = True if req.opt_type.lower() == 'call' else False
    premium = np.exp(-req.r * req.T) * bs_pricer(is_call, req.S, req.K, req.T, req.r, req.q, req.sigma)
    return BSPricerResponse(premium=round(premium,4))
