'use strict';
const { getTracts, getBlockGroups, getCounties } = require('./lib/boundaries');

async function run() {
  console.log('Testing Census Bureau boundary downloads...');
  const t = await getTracts();
  console.log('Tracts:', t.features.length, 'features');
  const b = await getBlockGroups();
  console.log('Block groups:', b.features.length, 'features');
  const c = await getCounties();
  console.log('Counties:', c.features.length, 'features');
  console.log('All boundary files ready in data/raw/');
}

run().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
