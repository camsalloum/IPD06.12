const { authPool } = require('./database/config');

async function testDefaultDivision() {
  try {
    console.log('Testing default division feature...\n');

    // Get admin user
    const userResult = await authPool.query(
      `SELECT id, email, name FROM users WHERE email = 'camille@interplast-uae.com'`
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Admin user not found');
      return;
    }

    const user = userResult.rows[0];
    console.log('✓ Found user:', user.email);

    // Check if preferences exist
    let prefsResult = await authPool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [user.id]
    );

    if (prefsResult.rows.length === 0) {
      console.log('Creating user preferences entry...');
      await authPool.query(
        'INSERT INTO user_preferences (user_id) VALUES ($1)',
        [user.id]
      );
      prefsResult = await authPool.query(
        'SELECT * FROM user_preferences WHERE user_id = $1',
        [user.id]
      );
    }

    console.log('\n✓ Current preferences:');
    console.log(JSON.stringify(prefsResult.rows[0], null, 2));

    // Set default division to FP
    console.log('\n📝 Setting default division to FP...');
    const updateResult = await authPool.query(
      `UPDATE user_preferences 
       SET default_division = $1, updated_at = NOW() 
       WHERE user_id = $2 
       RETURNING *`,
      ['FP', user.id]
    );

    console.log('\n✓ Updated preferences:');
    console.log(JSON.stringify(updateResult.rows[0], null, 2));

    console.log('\n✅ Default division feature test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await authPool.end();
  }
}

testDefaultDivision();
