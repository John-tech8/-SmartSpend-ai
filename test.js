require('dotenv').config();

async function testConnection() {
    console.log("Testing Supabase connection...");
    console.log("URL configured:", process.env.SUPABASE_URL ? "Yes" : "No");
    console.log("Anon Key configured:", process.env.SUPABASE_ANON_KEY ? "Yes" : "No");

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.error("\n❌ Error: Missing SUPABASE_URL or SUPABASE_ANON_KEY in your .env file!");
        console.log("Please add them to the .env file in the root of your project.");
        return;
    }

    const { supabase } = require('./src/lib/supabaseClient.js');

    // Attempting to fetch a single row from any table or just verifying the rest endpoint
    try {
        // Testing connection by calling a generic method. E.g., getting the auth session or selecting a row
        // We will try to select 1 row from a table named 'users', if it fails with relation 'users' does not exist,
        // it still means we reached the database correctly!
        const { data, error } = await supabase
            .from('users') // We don't know the exact table, just testing if the query reaches the server
            .select('*')
            .limit(1);

        if (error) {
            if (error.code === '42P01') {
                console.log("\n✅ Connection successful! (Table 'users' doesn't exist, but the database responded correctly.)");
            } else if (error.message.includes('JWT') || error.message.includes('Invalid API key')) {
                console.log("\n❌ Authentication Error: Your SUPABASE_ANON_KEY might be invalid.");
                console.log("Details:", error);
            } else {
                console.log("\n⚠️ Query returned an error (but connection works!):", error.message);
            }
        } else {
            console.log("\n✅ Connection successful! Data fetched:", data);
        }
    } catch (err) {
        console.error("\n❌ Connection Failed. Check your network or URL.");
        console.error(err);
    }
}

testConnection();