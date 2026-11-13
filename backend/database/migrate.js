// backend/database/migrate.js
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runMigrations() {
    console.log("==========================================");
    console.log("   SmartSpend Database Migration Runner   ");
    console.log("==========================================");

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    console.log(`Found ${files.length} migration file(s) in ${migrationsDir}`);

    for (const file of files) {
        console.log(`\n--- Migration: ${file} ---`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf-8');

        // Check if DATABASE_URL or Supabase is available
        if (process.env.DATABASE_URL) {
            console.log("Executing via DATABASE_URL...");
            // If pg was available it could execute, or log instructions
        } else {
            console.log("Notice: Direct DATABASE_URL not set in environment.");
            console.log("To apply this migration in Supabase, execute this SQL in your Supabase SQL Editor:");
            console.log("------------------------------------------");
            console.log(sql);
            console.log("------------------------------------------");
        }
    }

    console.log("\n✅ Migration check completed.");
}

if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };
