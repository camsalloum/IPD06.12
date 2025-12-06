const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const authPool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_auth_database',
  user: 'postgres',
  password: '654883'
});

async function updateAdminPassword() {
  try {
    // Generate hash for Admin@123
    const hash = await bcrypt.hash('Admin@123', 10);
    console.log('Generated hash:', hash);
    console.log('Hash length:', hash.length);
    
    // Verify the hash works
    const verified = await bcrypt.compare('Admin@123', hash);
    console.log('Hash verified:', verified);
    
    // Update in database
    const result = await authPool.query(
      'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, LENGTH(password_hash) as hash_length',
      [hash, 'camille@interplast-uae.com']
    );
    
    console.log('Updated user:', result.rows[0]);
    
    // Verify database update
    const checkResult = await authPool.query(
      'SELECT email, password_hash FROM users WHERE email = $1',
      ['camille@interplast-uae.com']
    );
    
    const dbHash = checkResult.rows[0].password_hash;
    console.log('Hash from DB length:', dbHash.length);
    
    const dbVerified = await bcrypt.compare('Admin@123', dbHash);
    console.log('DB hash verified:', dbVerified);
    
    await authPool.end();
    console.log('\n✅ Password updated successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateAdminPassword();
