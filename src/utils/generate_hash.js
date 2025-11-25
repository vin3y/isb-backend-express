const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'Superuser@2025';
  const hash = await bcrypt.hash(password, 10);

  console.log('======================================');
  console.log('Password:', password);
  console.log('======================================');
  console.log('Hash:', hash);
  console.log('======================================');
  console.log('\nCopy this SQL and run in pgAdmin:\n');
  console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'admin@isb.com';`);
  console.log('======================================');
}

generateHash();
