/**
 * Setup Admin User
 * Creates or updates the admin user with the correct password
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ipdashboard',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '654883'
});

async function setupAdmin() {
  try {
    console.log('🔧 Setting up admin user...');
    
    const email = 'camille@interplast-uae.com';
    const password = '654883';
    const name = 'Camille Salloum';
    
    // Generate password hash
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('✅ Password hash generated');
    
    // Insert or update admin user
    const result = await pool.query(`
      INSERT INTO users (email, password_hash, name, role, created_at, updated_at) 
      VALUES ($1, $2, $3, 'admin', NOW(), NOW())
      ON CONFLICT (email) 
      DO UPDATE SET 
        password_hash = $2,
        name = $3,
        updated_at = NOW()
      RETURNING id, email, name, role
    `, [email, passwordHash, name]);
    
    console.log('✅ Admin user setup complete!');
    console.log('📧 Email:', result.rows[0].email);
    console.log('👤 Name:', result.rows[0].name);
    console.log('🔑 Password: 654883');
    console.log('🎭 Role:', result.rows[0].role);
    
  } catch (error) {
    console.error('❌ Error setting up admin user:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

setupAdmin()
  .then(() => {
    console.log('\n✨ Setup complete! You can now login with:');
    console.log('   Email: camille@interplast-uae.com');
    console.log('   Password: 654883');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to setup admin:', error);
    process.exit(1);
  });
