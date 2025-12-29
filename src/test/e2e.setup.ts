import { config } from 'dotenv';

config();

if (!process.env.TEST_SPREADSHEET_ID) {
  console.error('\n');
  console.error('=' .repeat(60));
  console.error('E2E TEST CONFIGURATION REQUIRED');
  console.error('=' .repeat(60));
  console.error('\nPlease set TEST_SPREADSHEET_ID environment variable.');
  console.error('\nYou can either:');
  console.error('  1. Create a .env file with:');
  console.error('     TEST_SPREADSHEET_ID=your-spreadsheet-id');
  console.error('\n  2. Or set it inline:');
  console.error('     TEST_SPREADSHEET_ID=your-id npm run test:e2e');
  console.error('\nMake sure the service account has edit access to the spreadsheet.');
  console.error('=' .repeat(60));
  console.error('\n');
  process.exit(1);
}

export const TEST_SPREADSHEET_ID = process.env.TEST_SPREADSHEET_ID;
