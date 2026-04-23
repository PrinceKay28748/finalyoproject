// backend/src/routes/proxy.js
// Proxy for Nominatim API to avoid CORS issues in production

import express from 'express';

const router = express.Router();

// Proxy for Nominatim search
router.get('/nominatim/search', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query);
    const url = `https://nominatim.openstreetmap.org/search?${queryParams.toString()}`;
    
    console.log('[Proxy] Forwarding request to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'UG-Navigator/1.0 (pkay28748@gmail.com)',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Proxy for Nominatim reverse geocoding
router.get('/nominatim/reverse', async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query);
    const url = `https://nominatim.openstreetmap.org/reverse?${queryParams.toString()}`;
    
    console.log('[Proxy] Forwarding reverse request to:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'UG-Navigator/1.0 (pkay28748@gmail.com)',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error.message);
    res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

export default router;