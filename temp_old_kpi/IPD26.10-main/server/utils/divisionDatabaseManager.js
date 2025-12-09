const { Pool } = require('pg');
const { authPool } = require('../database/config');
const { createDivisionExcelTemplate, deleteDivisionExcel } = require('./excelTemplateGenerator');

// Cache for division database pools
const divisionPools = new Map();

/**
 * Get or create a connection pool for a specific division database
 */
function getDivisionPool(divisionCode) {
  const dbName = `${divisionCode.toLowerCase()}_database`;
  
  if (!divisionPools.has(dbName)) {
    const pool = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: dbName,
      password: process.env.DB_PASSWORD || '654883',
      port: process.env.DB_PORT || 5432,
    });
    
    divisionPools.set(dbName, pool);
    console.log(`✅ Created pool for division database: ${dbName}`);
  }
  
  return divisionPools.get(dbName);
}

/**
 * Close a division database pool
 */
async function closeDivisionPool(divisionCode) {
  const dbName = `${divisionCode.toLowerCase()}_database`;
  
  if (divisionPools.has(dbName)) {
    await divisionPools.get(dbName).end();
    divisionPools.delete(dbName);
    console.log(`✅ Closed pool for division database: ${dbName}`);
  }
}

/**
 * Create a new division database with all required tables cloned from FP
 */
async function createDivisionDatabase(divisionCode, divisionName) {
  const dbName = `${divisionCode.toLowerCase()}_database`;
  const fpPool = getDivisionPool('FP');
  
  try {
    // Step 1: Create the new database
    const client = await authPool.connect();
    try {
      await client.query(`CREATE DATABASE ${dbName} WITH OWNER = postgres ENCODING = 'UTF8'`);
      console.log(`✅ Created database: ${dbName}`);
    } finally {
      client.release();
    }
    
    // Step 2: Get all FP table structures
    const tablesQuery = `
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    
    const tablesResult = await fpPool.query(tablesQuery);
    const fpTables = tablesResult.rows.map(r => r.tablename);
    
    console.log(`📋 Found ${fpTables.length} tables in FP database to clone`);
    
    // Step 3: Clone each table structure to new division database
    const newDivPool = getDivisionPool(divisionCode);
    
    for (const fpTable of fpTables) {
      let newTableName;
      if (fpTable.startsWith('fp_')) {
        newTableName = fpTable.replace(/^fp_/, `${divisionCode.toLowerCase()}_`);
      } else {
        newTableName = fpTable;
      }
      
      // Get column definitions from FP table
      const columnsQuery = `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `;
      
      const columnsResult = await fpPool.query(columnsQuery, [fpTable]);
      
      if (columnsResult.rows.length === 0) {
        console.log(`  ⚠️  No columns found for ${fpTable}, skipping`);
        continue;
      }
      
      // Build CREATE TABLE statement
      const columnDefs = columnsResult.rows.map(col => {
        let def = `"${col.column_name}" `;
        
        // Handle data type
        if (col.data_type === 'ARRAY') {
          def += col.udt_name; // Use UDT name for arrays
        } else if (col.data_type === 'USER-DEFINED') {
          def += col.udt_name;
        } else if (col.character_maximum_length) {
          def += `${col.data_type}(${col.character_maximum_length})`;
        } else if (col.data_type === 'numeric' && col.numeric_precision && col.numeric_scale !== null) {
          // Only add precision/scale for numeric/decimal types
          def += `${col.data_type}(${col.numeric_precision},${col.numeric_scale})`;
        } else {
          // For integer, bigint, text, etc., don't add precision
          def += col.data_type;
        }
        
        // Handle NULL constraint
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        // Handle default value
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        return def;
      }).join(',\n  ');
      
      // Create sequences first if needed
      const sequencesQuery = `
        SELECT 
          c.relname as sequence_name
        FROM pg_class c
        JOIN pg_depend d ON d.objid = c.oid
        JOIN pg_class t ON d.refobjid = t.oid
        WHERE c.relkind = 'S' 
          AND t.relname = $1
          AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      `;
      
      const sequencesResult = await fpPool.query(sequencesQuery, [fpTable]);
      
      for (const seq of sequencesResult.rows) {
        let newSeqName;
        if (seq.sequence_name.startsWith('fp_')) {
          newSeqName = seq.sequence_name.replace(/^fp_/, `${divisionCode.toLowerCase()}_`);
        } else {
          newSeqName = seq.sequence_name;
        }
        
        try {
          await newDivPool.query(`CREATE SEQUENCE "${newSeqName}"`);
          console.log(`    ✅ Created sequence: ${newSeqName}`);
        } catch (seqErr) {
          if (!seqErr.message.includes('already exists')) {
            console.log(`    ⚠️  Sequence warning: ${seqErr.message}`);
          }
        }
      }
      
      // Update column defaults to reference new sequences
      let updatedColumnDefs = columnDefs;
      if (fpTable.startsWith('fp_')) {
        updatedColumnDefs = columnDefs.replace(/fp_/g, `${divisionCode.toLowerCase()}_`);
      }
      
      const createSQL = `CREATE TABLE "${newTableName}" (\n  ${updatedColumnDefs}\n)`;
      
      try {
        await newDivPool.query(createSQL);
        console.log(`  ✅ Created table: ${newTableName} (${columnsResult.rows.length} columns)`);
      } catch (err) {
        console.error(`  ❌ Error creating table ${newTableName}:`, err.message);
        throw err;
      }
      
      // Clone indexes (excluding primary key which is already created)
      try {
        const indexQuery = `
          SELECT 
            indexname,
            indexdef
          FROM pg_indexes
          WHERE schemaname = 'public' 
            AND tablename = $1
            AND indexname NOT LIKE '%_pkey'
        `;
        
        const indexResult = await fpPool.query(indexQuery, [fpTable]);
        
        for (const idx of indexResult.rows) {
          let indexDef = idx.indexdef;
          // Replace table name references
          indexDef = indexDef.replace(new RegExp(`\\b${fpTable}\\b`, 'g'), newTableName);
          
          let newIndexName = idx.indexname;
          if (idx.indexname.startsWith('fp_')) {
            newIndexName = idx.indexname.replace(/^fp_/, `${divisionCode.toLowerCase()}_`);
          }
          
          indexDef = indexDef.replace(new RegExp(`\\b${idx.indexname}\\b`, 'g'), newIndexName);
          
          try {
            await newDivPool.query(indexDef);
            console.log(`    ✅ Created index: ${newIndexName}`);
          } catch (idxErr) {
            if (!idxErr.message.includes('already exists')) {
              console.log(`    ⚠️  Index warning: ${idxErr.message}`);
            }
          }
        }
      } catch (indexError) {
        console.log(`    ⚠️  Could not clone indexes: ${indexError.message}`);
      }
    }
    
    console.log(`✅ Division ${divisionCode} database created successfully with ${fpTables.length} tables!`);
    
    // Step 4: Create Excel template file for the new division
    try {
      const excelResult = await createDivisionExcelTemplate(divisionCode, divisionName);
      console.log(`✅ Excel template created: ${excelResult.fileName}`);
    } catch (excelError) {
      console.error(`⚠️  Warning: Database created but Excel template failed:`, excelError.message);
      // Don't throw - database creation succeeded, Excel is supplementary
    }
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error creating division database:`, error);
    throw error;
  }
}

/**
 * Delete a division database completely
 */
async function deleteDivisionDatabase(divisionCode) {
  const dbName = `${divisionCode.toLowerCase()}_database`;
  
  try {
    // Close pool if exists
    await closeDivisionPool(divisionCode);
    
    // Terminate all connections to the database
    const client = await authPool.connect();
    try {
      await client.query(`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [dbName]);
      
      // Drop the database
      await client.query(`DROP DATABASE IF EXISTS ${dbName}`);
      console.log(`✅ Deleted database: ${dbName}`);
      
      // Delete Excel file for the division
      try {
        await deleteDivisionExcel(divisionCode);
      } catch (excelError) {
        console.error(`⚠️  Warning: Database deleted but Excel cleanup failed:`, excelError.message);
        // Don't throw - database deletion succeeded
      }
      
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`❌ Error deleting division database:`, error);
    throw error;
  }
}

/**
 * Check if division database exists
 */
async function divisionDatabaseExists(divisionCode) {
  const dbName = `${divisionCode.toLowerCase()}_database`;
  
  try {
    const result = await authPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error(`Error checking database existence:`, error);
    return false;
  }
}

/**
 * Get list of all active divisions (those with existing databases)
 */
async function getActiveDivisions() {
  try {
    const result = await authPool.query(`
      SELECT datname 
      FROM pg_database 
      WHERE datname LIKE '%_database' 
        AND datname NOT IN ('postgres', 'template0', 'template1')
      ORDER BY datname
    `);
    
    return result.rows
      .map(r => r.datname.replace('_database', '').toUpperCase())
      .filter(d => d !== 'FP'); // Exclude FP as it's the source
  } catch (error) {
    console.error('Error getting active divisions:', error);
    return [];
  }
}

/**
 * Synchronize a specific table from FP to all other divisions
 * Call this after adding a new table to FP
 */
async function syncTableToAllDivisions(tableName) {
  const fpPool = getDivisionPool('FP');
  const activeDivisions = await getActiveDivisions();
  
  console.log(`🔄 Syncing table '${tableName}' to ${activeDivisions.length} divisions...`);
  
  for (const divisionCode of activeDivisions) {
    try {
      await syncTableToDivision(tableName, divisionCode, fpPool);
      console.log(`  ✅ Synced to ${divisionCode}`);
    } catch (error) {
      console.error(`  ❌ Failed to sync to ${divisionCode}:`, error.message);
    }
  }
  
  console.log(`✅ Table sync complete!`);
}

/**
 * Synchronize a table from FP to a specific division
 */
async function syncTableToDivision(fpTableName, divisionCode, fpPool = null) {
  if (!fpPool) fpPool = getDivisionPool('FP');
  const divPool = getDivisionPool(divisionCode);
  const prefix = divisionCode.toLowerCase();
  
  // Calculate new table name
  let newTableName;
  if (fpTableName.startsWith('fp_')) {
    newTableName = fpTableName.replace(/^fp_/, `${prefix}_`);
  } else {
    newTableName = fpTableName;
  }
  
  // Check if table already exists in target division
  const existsResult = await divPool.query(`
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = $1
  `, [newTableName]);
  
  if (existsResult.rows.length > 0) {
    console.log(`    ⏭️  Table ${newTableName} already exists in ${divisionCode}`);
    return false;
  }
  
  // Get column definitions from FP table
  const columnsQuery = `
    SELECT 
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      is_nullable,
      column_default,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `;
  
  const columnsResult = await fpPool.query(columnsQuery, [fpTableName]);
  
  if (columnsResult.rows.length === 0) {
    throw new Error(`Table ${fpTableName} not found in FP database`);
  }
  
  // Step 1: Create sequences first (before table creation)
  const sequencesQuery = `
    SELECT 
      c.relname as sequence_name
    FROM pg_class c
    JOIN pg_depend d ON d.objid = c.oid
    JOIN pg_class t ON d.refobjid = t.oid
    WHERE c.relkind = 'S' 
      AND t.relname = $1
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  `;
  
  const sequencesResult = await fpPool.query(sequencesQuery, [fpTableName]);
  
  for (const seq of sequencesResult.rows) {
    let newSeqName;
    if (seq.sequence_name.startsWith('fp_')) {
      newSeqName = seq.sequence_name.replace(/^fp_/, `${prefix}_`);
    } else {
      newSeqName = seq.sequence_name;
    }
    
    try {
      await divPool.query(`CREATE SEQUENCE IF NOT EXISTS "${newSeqName}"`);
    } catch (seqErr) {
      if (!seqErr.message.includes('already exists')) {
        console.log(`    ⚠️  Sequence warning for ${newSeqName}: ${seqErr.message}`);
      }
    }
  }
  
  // Step 2: Build column definitions
  const columnDefs = columnsResult.rows.map(col => {
    let def = `"${col.column_name}" `;
    
    if (col.data_type === 'ARRAY') {
      def += col.udt_name;
    } else if (col.data_type === 'USER-DEFINED') {
      def += col.udt_name;
    } else if (col.character_maximum_length) {
      def += `${col.data_type}(${col.character_maximum_length})`;
    } else if (col.data_type === 'numeric' && col.numeric_precision && col.numeric_scale !== null) {
      def += `${col.data_type}(${col.numeric_precision},${col.numeric_scale})`;
    } else {
      def += col.data_type;
    }
    
    if (col.is_nullable === 'NO') {
      def += ' NOT NULL';
    }
    
    if (col.column_default) {
      // Replace fp_ prefix in default values (for sequences)
      let defaultVal = col.column_default;
      if (fpTableName.startsWith('fp_')) {
        defaultVal = defaultVal.replace(/fp_/g, `${prefix}_`);
      }
      def += ` DEFAULT ${defaultVal}`;
    }
    
    return def;
  }).join(',\n  ');
  
  // Step 3: Create the table
  const createSQL = `CREATE TABLE "${newTableName}" (\n  ${columnDefs}\n)`;
  await divPool.query(createSQL);
  
  // Clone indexes
  const indexQuery = `
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' 
      AND tablename = $1
      AND indexname NOT LIKE '%_pkey'
  `;
  
  const indexResult = await fpPool.query(indexQuery, [fpTableName]);
  
  for (const idx of indexResult.rows) {
    let indexDef = idx.indexdef;
    indexDef = indexDef.replace(new RegExp(`\\b${fpTableName}\\b`, 'g'), newTableName);
    
    let newIndexName = idx.indexname;
    if (idx.indexname.startsWith('fp_')) {
      newIndexName = idx.indexname.replace(/^fp_/, `${prefix}_`);
    }
    indexDef = indexDef.replace(new RegExp(`\\b${idx.indexname}\\b`, 'g'), newIndexName);
    
    try {
      await divPool.query(indexDef);
    } catch (idxErr) {
      if (!idxErr.message.includes('already exists')) {
        console.log(`    ⚠️  Index warning: ${idxErr.message}`);
      }
    }
  }
  
  return true;
}

/**
 * Synchronize ALL tables from FP to all other divisions
 * This ensures all divisions have the same table structure as FP
 */
async function syncAllTablesToAllDivisions() {
  const fpPool = getDivisionPool('FP');
  const activeDivisions = await getActiveDivisions();
  
  if (activeDivisions.length === 0) {
    console.log('ℹ️  No other divisions to sync to');
    return { synced: 0, divisions: [] };
  }
  
  console.log(`🔄 Syncing all FP tables to ${activeDivisions.length} divisions: ${activeDivisions.join(', ')}`);
  
  // Get all FP tables
  const tablesResult = await fpPool.query(`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  
  const fpTables = tablesResult.rows.map(r => r.tablename);
  console.log(`📋 Found ${fpTables.length} tables in FP database`);
  
  let totalSynced = 0;
  const syncResults = {};
  
  for (const divisionCode of activeDivisions) {
    syncResults[divisionCode] = { synced: 0, skipped: 0, errors: 0 };
    
    for (const fpTable of fpTables) {
      try {
        const wasCreated = await syncTableToDivision(fpTable, divisionCode, fpPool);
        if (wasCreated) {
          syncResults[divisionCode].synced++;
          totalSynced++;
        } else {
          syncResults[divisionCode].skipped++;
        }
      } catch (error) {
        syncResults[divisionCode].errors++;
        console.error(`  ❌ Error syncing ${fpTable} to ${divisionCode}:`, error.message);
      }
    }
    
    console.log(`  ${divisionCode}: ${syncResults[divisionCode].synced} created, ${syncResults[divisionCode].skipped} skipped, ${syncResults[divisionCode].errors} errors`);
  }
  
  console.log(`✅ Sync complete! ${totalSynced} tables created across all divisions`);
  
  return { synced: totalSynced, divisions: activeDivisions, results: syncResults };
}

module.exports = {
  getDivisionPool,
  closeDivisionPool,
  createDivisionDatabase,
  deleteDivisionDatabase,
  divisionDatabaseExists,
  getActiveDivisions,
  syncTableToAllDivisions,
  syncTableToDivision,
  syncAllTablesToAllDivisions
};
