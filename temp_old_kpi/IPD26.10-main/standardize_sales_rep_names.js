const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  user: 'postgres',
  password: '654883',
  database: 'fp_database',
  port: 5432
});

// Helper function to convert to Title Case
function toTitleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function standardizeSalesRepNames() {
  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Get all unique sales rep names with different casings
    console.log('📊 Step 1: Analyzing sales rep names...\n');

    const analysisResult = await client.query(`
      SELECT
        salesrepname,
        UPPER(salesrepname) as normalized_name,
        COUNT(*) as record_count
      FROM fp_data_excel
      GROUP BY salesrepname, UPPER(salesrepname)
      ORDER BY UPPER(salesrepname), salesrepname
    `);

    // Group by normalized name to find duplicates
    const nameGroups = {};
    analysisResult.rows.forEach(row => {
      const normalized = row.normalized_name;
      if (!nameGroups[normalized]) {
        nameGroups[normalized] = [];
      }
      nameGroups[normalized].push({
        original: row.salesrepname,
        count: parseInt(row.record_count)
      });
    });

    // Find names that need standardization
    const duplicates = Object.entries(nameGroups).filter(([_, variations]) => variations.length > 1);

    console.log(`Found ${duplicates.length} sales rep names with multiple case variations:\n`);

    if (duplicates.length === 0) {
      console.log('✅ No duplicates found! All sales rep names are already standardized.');
      await client.end();
      return;
    }

    // Display duplicates
    duplicates.forEach(([normalizedName, variations]) => {
      console.log(`📌 ${normalizedName}:`);
      variations.forEach(v => {
        console.log(`   - "${v.original}" (${v.count} records)`);
      });
      const titleCase = toTitleCase(variations[0].original);
      console.log(`   → Will standardize to: "${titleCase}"`);
      console.log('');
    });

    // Step 2: Start transaction
    console.log('🔄 Step 2: Starting standardization...\n');
    await client.query('BEGIN');

    let totalUpdated = 0;

    // Step 3: Standardize each group
    for (const [normalizedName, variations] of duplicates) {
      const titleCaseName = toTitleCase(variations[0].original);

      // Update all variations to the title case version
      for (const variation of variations) {
        if (variation.original !== titleCaseName) {
          const updateResult = await client.query(`
            UPDATE fp_data_excel
            SET salesrepname = $1
            WHERE salesrepname = $2
          `, [titleCaseName, variation.original]);

          const updatedCount = updateResult.rowCount;
          totalUpdated += updatedCount;
          console.log(`✓ Updated "${variation.original}" → "${titleCaseName}" (${updatedCount} records)`);
        }
      }
    }

    // Step 4: Also standardize customername and countryname for consistency
    console.log('\n🔄 Step 3: Standardizing customer names...\n');

    const customerResult = await client.query(`
      UPDATE fp_data_excel
      SET customername = INITCAP(customername)
      WHERE customername != INITCAP(customername)
    `);

    console.log(`✓ Standardized ${customerResult.rowCount} customer name records`);

    console.log('\n🔄 Step 4: Standardizing country names...\n');

    const countryResult = await client.query(`
      UPDATE fp_data_excel
      SET countryname = INITCAP(countryname)
      WHERE countryname != INITCAP(countryname)
    `);

    console.log(`✓ Standardized ${countryResult.rowCount} country name records`);

    console.log('\n🔄 Step 5: Standardizing product group names...\n');

    const productGroupResult = await client.query(`
      UPDATE fp_data_excel
      SET productgroup = INITCAP(productgroup)
      WHERE productgroup != INITCAP(productgroup)
    `);

    console.log(`✓ Standardized ${productGroupResult.rowCount} product group records`);

    // Step 5: Commit transaction
    await client.query('COMMIT');

    console.log('\n==============================================');
    console.log('✅ STANDARDIZATION COMPLETE!');
    console.log('==============================================');
    console.log(`Total sales rep records updated: ${totalUpdated}`);
    console.log(`Customer names standardized: ${customerResult.rowCount}`);
    console.log(`Country names standardized: ${countryResult.rowCount}`);
    console.log(`Product group names standardized: ${productGroupResult.rowCount}`);
    console.log('==============================================\n');

    // Step 6: Verify no duplicates remain
    console.log('🔍 Verifying standardization...\n');

    const verifyResult = await client.query(`
      SELECT
        UPPER(salesrepname) as normalized_name,
        COUNT(DISTINCT salesrepname) as variation_count
      FROM fp_data_excel
      GROUP BY UPPER(salesrepname)
      HAVING COUNT(DISTINCT salesrepname) > 1
    `);

    if (verifyResult.rows.length === 0) {
      console.log('✅ Verification successful! No duplicate case variations remain.');
    } else {
      console.log('⚠️  Warning: Some duplicates still exist:');
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.normalized_name} has ${row.variation_count} variations`);
      });
    }

    await client.end();
    console.log('\n✅ Database connection closed.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);

    // Rollback transaction on error
    try {
      await client.query('ROLLBACK');
      console.log('⚠️  Transaction rolled back due to error.');
    } catch (rollbackErr) {
      console.error('Failed to rollback:', rollbackErr.message);
    }

    await client.end();
    process.exit(1);
  }
}

console.log('==============================================');
console.log('Sales Rep Name Standardization Script');
console.log('==============================================\n');
console.log('This script will standardize all sales rep,');
console.log('customer, country, and product group names');
console.log('to Title Case format.\n');

standardizeSalesRepNames();
