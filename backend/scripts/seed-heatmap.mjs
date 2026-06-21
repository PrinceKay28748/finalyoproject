// backend/scripts/seed-heatmap.mjs
// Seeds the route_segments table with realistic campus path data
// Run with: node backend/scripts/seed-heatmap.mjs

import dotenv from 'dotenv';
dotenv.config();

const { query, closePool } = await import('../src/config/db.js');

const POINTS = {
  commonwealthHall: { lat: 5.6492, lng: -0.1923 },
  legonHall:        { lat: 5.6478, lng: -0.1921 },
  agobaHall:        { lat: 5.6479, lng: -0.1839 },
  businessSchool:   { lat: 5.6582, lng: -0.1868 },
  balmeLib:         { lat: 5.6519, lng: -0.1864 },
  centralCafe:      { lat: 5.6532, lng: -0.1840 },
  greatHall:        { lat: 5.6507, lng: -0.1897 },
  athleticsStad:    { lat: 5.6541, lng: -0.1934 },
  ugcs:             { lat: 5.6475, lng: -0.1858 },
  diaspora:         { lat: 5.6560, lng: -0.1902 },
  nightMarket:      { lat: 5.6508, lng: -0.1825 },
  csDept:           { lat: 5.6512, lng: -0.1878 },
};

function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function bucket(v) { return parseFloat(v.toFixed(5)); }

function* pointsAlongRoute(from, to, steps) {
  for (let i = 0; i <= steps; i++) {
    const pt = interpolate(from, to, i / steps);
    yield { lat: bucket(pt.lat), lng: bucket(pt.lng) };
  }
}

const ROUTES = [
  { from: 'commonwealthHall', to: 'businessSchool', steps: 12, weight: 80 },
  { from: 'commonwealthHall', to: 'greatHall',       steps: 6,  weight: 60 },
  { from: 'commonwealthHall', to: 'csDept',          steps: 8,  weight: 45 },
  { from: 'legonHall',        to: 'balmeLib',        steps: 8,  weight: 70 },
  { from: 'legonHall',        to: 'centralCafe',     steps: 10, weight: 50 },
  { from: 'legonHall',        to: 'agobaHall',       steps: 10, weight: 35 },
  { from: 'balmeLib',         to: 'greatHall',       steps: 6,  weight: 55 },
  { from: 'balmeLib',         to: 'centralCafe',     steps: 5,  weight: 65 },
  { from: 'balmeLib',         to: 'csDept',          steps: 4,  weight: 40 },
  { from: 'greatHall',        to: 'centralCafe',     steps: 7,  weight: 50 },
  { from: 'athleticsStad',    to: 'diaspora',        steps: 5,  weight: 35 },
  { from: 'diaspora',         to: 'businessSchool',  steps: 5,  weight: 45 },
  { from: 'ugcs',             to: 'csDept',          steps: 5,  weight: 38 },
  { from: 'centralCafe',      to: 'nightMarket',     steps: 5,  weight: 55 },
  { from: 'csDept',           to: 'centralCafe',     steps: 4,  weight: 42 },
  { from: 'businessSchool',   to: 'diaspora',        steps: 4,  weight: 28 },
];

async function seed() {
  console.log('Seeding heatmap data...');

  await query('DELETE FROM route_segments');
  console.log('  Cleared existing data');

  // Hour-of-day weight profile
  const hourWt = [2,1,1,1,2,3,5,8,15,20,18,14,16,14,12,10,9,8,6,4,3,2,2,2];
  const dayWt  = [0.2, 0.8, 1.0, 1.0, 1.0, 0.9, 0.5];

  // Aggregate counts by (lat, lng, hour, day)
  const agg = new Map();
  for (const route of ROUTES) {
    const coords = [...pointsAlongRoute(POINTS[route.from], POINTS[route.to], route.steps)];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const base = Math.round(route.weight * hourWt[hour] / 20 * dayWt[day]);
        if (base < 1) continue;
        for (const pt of coords) {
          const key = `${pt.lat},${pt.lng},${hour},${day}`;
          const c = Math.max(1, Math.round(base * (0.6 + Math.random() * 0.8)));
          agg.set(key, (agg.get(key) || 0) + c);
        }
      }
    }
  }

  // Insert all rows (now unique by construction)
  const entries = [...agg.entries()];
  console.log(`  Aggregated ${entries.length} unique cell-time combos`);

  for (let i = 0; i < entries.length; i += 100) {
    const chunk = entries.slice(i, i + 100);
    const params = [];
    const rows = [];
    for (const [key, count] of chunk) {
      const [lat, lng, hour, day] = key.split(',').map(Number);
      params.push(lat, lng, hour, day, count);
      rows.push('(?, ?, ?, ?, ?)');
    }
    await query(
      `INSERT INTO route_segments (lat_bucket, lng_bucket, hour_of_day, day_of_week, count) VALUES ${rows.join(', ')}`,
      params
    );
  }

  console.log(`  Done! Inserted ${entries.length} aggregated rows`);
  await closePool();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
