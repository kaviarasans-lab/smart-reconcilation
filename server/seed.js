const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const User = require('./models/User');
const Record = require('./models/Record');

const connectDB = require('./config/db');

const seedUsers = [
  { name: 'Admin User', email: 'admin@smartrecon.com', password: 'admin123', role: 'admin' },
  { name: 'Analyst User', email: 'analyst@smartrecon.com', password: 'analyst123', role: 'analyst' },
  { name: 'Viewer User', email: 'viewer@smartrecon.com', password: 'viewer123', role: 'viewer' },
];

// Fixed amounts so sample CSV can produce reliable reconciliation results
const fixedAmounts = [
  1250.50, 3400.00, 780.25, 5600.00, 920.75,
  2150.00, 445.30, 8900.00, 1100.00, 3250.50,
  670.00, 4500.00, 1890.25, 7200.00, 550.00,
  1325.00, 2980.75, 4120.00, 6300.50, 815.25,
];

const generateSystemRecords = () => {
  const records = [];

  for (let i = 1; i <= 200; i++) {
    const month = ((i - 1) % 12) + 1;
    const day = ((i - 1) % 28) + 1;
    const date = new Date(`2024-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);

    records.push({
      transactionId: `TXN${String(i).padStart(5, '0')}`,
      amount: fixedAmounts[(i - 1) % fixedAmounts.length],
      referenceNumber: `REF${String(i).padStart(5, '0')}`,
      date,
      description: `System transaction #${i}`,
      source: 'system',
      uploadJobId: null,
      rawData: {},
    });
  }

  return records;
};

const seed = async () => {
  try {
    await connectDB();

    // Clear existing data
    await User.deleteMany({});
    await Record.deleteMany({ source: 'system' });

    console.log('Cleared existing seed data');

    // Seed users
    for (const userData of seedUsers) {
      await User.create(userData);
      console.log(`Created user: ${userData.email} (${userData.role})`);
    }

    // Seed system records
    const systemRecords = generateSystemRecords();
    await Record.insertMany(systemRecords);
    console.log(`Created ${systemRecords.length} system records`);

    console.log('\n--- Seed Complete ---');
    console.log('Login credentials:');
    console.log('  Admin:   admin@smartrecon.com / admin123');
    console.log('  Analyst: analyst@smartrecon.com / analyst123');
    console.log('  Viewer:  viewer@smartrecon.com / viewer123');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
