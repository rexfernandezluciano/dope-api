
/** @format */

const { exec } = require('child_process');
const path = require('path');

// Run database migrations first
exec('npx prisma migrate deploy', (error, stdout, stderr) => {
  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  console.log('Migrations completed successfully');
  
  // Start the application
  require('./dist/index.js');
});
