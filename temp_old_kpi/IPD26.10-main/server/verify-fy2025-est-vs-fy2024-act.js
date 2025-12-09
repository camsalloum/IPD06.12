const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function getMaxActualMonth(year) {
  const { rows } = await pool.query(
    `SELECT COALESCE(MAX(month), 0) AS max_month
     FROM fp_data_excel
     WHERE year = $1 AND UPPER(type) = 'ACTUAL' AND values_type = 'AMOUNT'`,
    [year]
  );
  return Number(rows[0]?.max_month || 0);
}

async function getHybridYearByProductGroup(year) {
  const maxActualMonth = await getMaxActualMonth(year);

  const { rows } = await pool.query(
    `SELECT productgroup,
            SUM(CASE WHEN values_type = 'AMOUNT' THEN values ELSE 0 END) AS total_sales
     FROM fp_data_excel
     WHERE year = $1
       AND productgroup IS NOT NULL
       AND TRIM(productgroup) <> ''
       AND (
         (UPPER(type) = 'ACTUAL' AND month <= $2)
         OR (UPPER(type) IN ('ESTIMATE','FORECAST') AND month > $2)
       )
     GROUP BY productgroup
     ORDER BY total_sales DESC`,
    [year, maxActualMonth]
  );
  const grandTotal = rows.reduce((s, r) => s + Number(r.total_sales || 0), 0);
  return { rows, grandTotal, maxActualMonth };
}

async function getActualYearByProductGroup(year) {
  const { rows } = await pool.query(
    `SELECT productgroup,
            SUM(CASE WHEN values_type = 'AMOUNT' THEN values ELSE 0 END) AS total_sales
     FROM fp_data_excel
     WHERE year = $1
       AND UPPER(type) = 'ACTUAL'
       AND productgroup IS NOT NULL
       AND TRIM(productgroup) <> ''
     GROUP BY productgroup
     ORDER BY total_sales DESC`,
    [year]
  );
  const grandTotal = rows.reduce((s, r) => s + Number(r.total_sales || 0), 0);
  return { rows, grandTotal };
}

(async () => {
  try {
    const baseYear = 2025; // FY2025 Estimate (hybrid)
    const cmpYear = 2024;  // FY2024 Actual

    const base = await getHybridYearByProductGroup(baseYear);
    const cmp = await getActualYearByProductGroup(cmpYear);

    console.log(`=== FY${baseYear} Estimate (Hybrid) vs FY${cmpYear} Actual ===`);
    console.log(`Hybrid cutoff (max actual month in ${baseYear}): ${base.maxActualMonth}`);
    console.log(`FY${baseYear} total: $${base.grandTotal.toLocaleString()}`);
    console.log(`FY${cmpYear} total: $${cmp.grandTotal.toLocaleString()}`);

    // Build maps for quick lookup
    const cmpMap = new Map(cmp.rows.map(r => [r.productgroup, Number(r.total_sales || 0)]));

    // Take top N by base period
    const topN = 10;
    const top = base.rows.slice(0, topN).map((r, idx) => {
      const estVal = Number(r.total_sales || 0);
      const actVal = Number(cmpMap.get(r.productgroup) || 0);
      const growth = actVal === 0 ? null : ((estVal - actVal) / actVal) * 100;
      const share = base.grandTotal === 0 ? 0 : (estVal / base.grandTotal) * 100;
      return {
        rank: idx + 1,
        productgroup: r.productgroup,
        estValue: estVal,
        cmpValue: actVal,
        share,
        growth
      };
    });

    console.log('\nTop revenue drivers (base = FY' + baseYear + ' hybrid):');
    for (const item of top) {
      const shareTxt = `${item.share.toFixed(1)}% of sales`;
      let growthTxt = 'n/a';
      if (item.growth === null) growthTxt = 'no FY' + cmpYear + ' actual';
      else growthTxt = `${item.growth >= 0 ? '+' : ''}${item.growth.toFixed(1)}% ${item.growth >= 0 ? 'growth' : 'decline'}`;

      console.log(
        `${String(item.rank).padStart(2)}. ${item.productgroup} — ${shareTxt} — ${growthTxt}`
      );
    }

    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();
