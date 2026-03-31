import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
// @ts-ignore
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Destructive script to wipe the database and reset all ID counters to 1.
 */
async function resetDatabase() {
    console.log('⚠️  WARNING: Resetting database...');

    try {
        // We use a transaction to ensure all or nothing
        await prisma.$transaction(async (tx) => {
            // Truncate tables and restart identity (resets ID to 1)
            // Order matters if there are foreign key constraints without CASCADE
            // In PostgreSQL, TRUNCATE ... RESTART IDENTITY is the way.
            
            console.log(' - Wiping TestCaseResult...');
            await tx.$executeRawUnsafe('TRUNCATE TABLE "TestCaseResult" RESTART IDENTITY CASCADE;');
            
            console.log(' - Wiping TestRunSummary...');
            await tx.$executeRawUnsafe('TRUNCATE TABLE "TestRunSummary" RESTART IDENTITY CASCADE;');
            
            console.log(' - Wiping FlakyTest...');
            await tx.$executeRawUnsafe('TRUNCATE TABLE "FlakyTest" RESTART IDENTITY CASCADE;');
        });

        console.log('\n✅ Database has been wiped clean.');
        console.log('🚀 All next records will start from ID #1.');
    } catch (error) {
        console.error('❌ Reset failed:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

resetDatabase();
