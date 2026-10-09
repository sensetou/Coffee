const fs = require('fs');
const path = require('path');

function cleanCoffeeName(name) {
  let n = name.trim();
  if (n.toLowerCase() === 'americano with milk') return 'Americano with Milk';
  return n;
}

function parseCSV(filePath, sourceName, sourceId, hasCard) {
  const content = fs.readFileSync(filePath, 'utf8').trim().split('\n');
  const records = [];
  for (let i = 1; i < content.length; i++) {
    const row = content[i].trim();
    if (!row) continue;
    const parts = row.split(',');
    const date = parts[0].trim();
    const datetime = parts[1].trim();
    const cash_type = parts[2].trim().toLowerCase();
    const card = hasCard ? parts[3].trim() : '';
    const money = parseFloat(hasCard ? parts[4] : parts[3]) || 0;
    const coffee = cleanCoffeeName(hasCard ? parts[5] : parts[4]);
    const year = date.substring(0, 4);
    const month = date.substring(0, 7);
    const timePart = datetime.split(' ')[1] || '';
    const hour = timePart ? parseInt(timePart.split(':')[0], 10) : 0;
    const d = new Date(date);
    const dayOfWeek = d.getDay(); // 0 = Sun
    records.push({
      id: i,
      d: date,
      dt: datetime,
      ct: cash_type,
      card: card,
      m: Math.round(money * 100) / 100,
      c: coffee,
      s: sourceId,
      sn: sourceName,
      y: year,
      mth: month,
      h: hour,
      w: dayOfWeek
    });
  }
  return records;
}

const r1 = parseCSV(path.join(__dirname, 'archive/index_1.csv'), 'Machine 1 (เครื่องที่ 1)', 'm1', true);
const r2 = parseCSV(path.join(__dirname, 'archive/index_2.csv'), 'Machine 2 (เครื่องที่ 2)', 'm2', false);
const all = [...r1, ...r2];

// Re-assign unified ID
all.forEach((item, index) => { item.id = index + 1; });

console.log('Total parsed rows:', all.length);

// Build Product Statistics
const productMap = {};
let totalRevenue = 0;
let totalUnits = all.length;
let cardCount = 0;
let cashCount = 0;

all.forEach(item => {
  totalRevenue += item.m;
  if (item.ct === 'card') cardCount++;
  else cashCount++;

  if (!productMap[item.c]) {
    productMap[item.c] = {
      name: item.c,
      totalUnits: 0,
      totalRevenue: 0,
      y2024Units: 0,
      y2024Revenue: 0,
      y2025Units: 0,
      y2025Revenue: 0,
      m1Units: 0,
      m2Units: 0,
      prices: []
    };
  }
  const p = productMap[item.c];
  p.totalUnits++;
  p.totalRevenue += item.m;
  p.prices.push(item.m);
  if (item.y === '2024') {
    p.y2024Units++;
    p.y2024Revenue += item.m;
  } else if (item.y === '2025') {
    p.y2025Units++;
    p.y2025Revenue += item.m;
  }
  if (item.s === 'm1') p.m1Units++;
  else p.m2Units++;
});

const productsList = Object.values(productMap).map(p => {
  p.totalRevenue = Math.round(p.totalRevenue * 100) / 100;
  p.y2024Revenue = Math.round(p.y2024Revenue * 100) / 100;
  p.y2025Revenue = Math.round(p.y2025Revenue * 100) / 100;
  p.avgPrice = Math.round((p.totalRevenue / p.totalUnits) * 100) / 100;
  p.shareUnitsPercent = Math.round((p.totalUnits / totalUnits) * 1000) / 10;
  p.shareRevenuePercent = Math.round((p.totalRevenue / totalRevenue) * 1000) / 10;
  
  // YoY growth (Note: 2024 has 10 months Mar-Dec, 2025 has ~2.8 months Jan-Mar 23)
  // Let's also compute annualized or direct YoY for overlapping months Mar 1-23!
  p.yoyUnitGrowth = p.y2024Units > 0 ? Math.round(((p.y2025Units - p.y2024Units) / p.y2024Units) * 1000) / 10 : null;
  return p;
});

// Sort by popularity (totalUnits desc)
productsList.sort((a, b) => b.totalUnits - a.totalUnits);
productsList.forEach((p, idx) => {
  p.rank = idx + 1;
});

// Monthly aggregation
const monthMap = {};
all.forEach(item => {
  if (!monthMap[item.mth]) {
    monthMap[item.mth] = { month: item.mth, units: 0, revenue: 0 };
  }
  monthMap[item.mth].units++;
  monthMap[item.mth].revenue += item.m;
});
const monthlyList = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({
  month: m.month,
  units: m.units,
  revenue: Math.round(m.revenue * 100) / 100
}));

// Precomputed bundle
const precomputed = {
  summary: {
    totalRecords: all.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalUnits: totalUnits,
    avgOrderValue: Math.round((totalRevenue / totalUnits) * 100) / 100,
    topProductByUnits: productsList[0].name,
    topProductByRevenue: [...productsList].sort((a, b) => b.totalRevenue - a.totalRevenue)[0].name,
    leastProductByUnits: productsList[productsList.length - 1].name,
    cardCount: cardCount,
    cashCount: cashCount,
    cardPercent: Math.round((cardCount / totalUnits) * 1000) / 10,
    cashPercent: Math.round((cashCount / totalUnits) * 1000) / 10,
    y2024Units: all.filter(x => x.y === '2024').length,
    y2024Revenue: Math.round(all.filter(x => x.y === '2024').reduce((acc, c) => acc + c.m, 0) * 100) / 100,
    y2025Units: all.filter(x => x.y === '2025').length,
    y2025Revenue: Math.round(all.filter(x => x.y === '2025').reduce((acc, c) => acc + c.m, 0) * 100) / 100,
    machine1Units: r1.length,
    machine1Revenue: Math.round(r1.reduce((acc, c) => acc + c.m, 0) * 100) / 100,
    machine2Units: r2.length,
    machine2Revenue: Math.round(r2.reduce((acc, c) => acc + c.m, 0) * 100) / 100,
    totalProductsCount: productsList.length
  },
  products: productsList,
  monthly: monthlyList
};

const outputJs = `// Auto-generated sales dataset
window.SALES_PRECOMPUTED = ${JSON.stringify(precomputed, null, 2)};
window.SALES_RAW_DATA = ${JSON.stringify(all)};
`;

fs.writeFileSync(path.join(__dirname, 'data.js'), outputJs, 'utf8');
console.log('Successfully written data.js. File size:', (fs.statSync(path.join(__dirname, 'data.js')).size / 1024).toFixed(1), 'KB');
