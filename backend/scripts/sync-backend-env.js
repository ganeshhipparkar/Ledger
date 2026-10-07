const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

async function syncBackendEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env');
        console.log(`1. Target .env path: ${envPath}`);

        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
        } else {
            console.warn('No .env file found in backend, proceeding with process.env');
        }

        const DB_HOST = process.env.DB_HOST || 'localhost';
        const DB_PORT = process.env.DB_PORT || 3306;
        const DB_USER = process.env.DB_USER || 'root';
        const DB_PASS = process.env.DB_PASS || 'root';
        const DB_NAME = process.env.DB_NAME || 'project';

        const connection = await mysql.createConnection({
            host: DB_HOST,
            port: parseInt(DB_PORT, 10),
            user: DB_USER,
            password: DB_PASS,
            database: DB_NAME
        });

        const [rows] = await connection.execute(
            "SELECT `key`, `value` FROM mod_setting WHERE layer = 'BACKEND' AND status = 'Active'"
        );


        await connection.end();

        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        let lines = envContent.split(/\r?\n/);

        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }

        const skipKeys = ['DB_CLIENT', 'DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME'];

        for (const row of rows) {
            const key = row.key;
            const value = row.value;

            if (skipKeys.includes(key)) {
                continue;
            }

            const existingLineIndex = lines.findIndex(line => line.startsWith(`${key}=`));

            if (existingLineIndex !== -1) {
                lines[existingLineIndex] = `${key}=${value}`;
            } else {
                lines.push(`${key}=${value}`);
            }
        }

        lines.push('');

        const finalContent = lines.join('\n');
        console.log(`3. Final merged content:\n${finalContent}`);

        fs.writeFileSync(envPath, finalContent, 'utf8');

    } catch (error) {
        console.warn('Failed to sync backend environment variables:', error.message);
    }
}

syncBackendEnv();
