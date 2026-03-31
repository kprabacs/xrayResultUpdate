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
 * Script to refresh metadata for ALL existing records.
 * It will look at the errorMessage/stackTrace of failures to try and find the JSON ID
 * or simply re-process names if they were stored incorrectly.
 */
async function refreshAllMetadata() {
    console.log('🚀 Starting global metadata refresh...');

    try {
        const summaries = await prisma.testRunSummary.findMany({
            include: {
                testCaseResults: {
                    take: 1 // We only need one test case to find the ID pattern usually
                }
            }
        });

        console.log(`Found ${summaries.length} summaries to check.`);
        let updatedCount = 0;

        for (const summary of summaries) {
            let needsUpdate = false;
            let newChannel = summary.channel;
            let newDevice = summary.device;
            let newModule = summary.module;

            // Pattern 1: Module name is a raw ID (contains multiple hyphens)
            const parts = summary.module.split('-').filter(p => p.trim().length > 0);
            if (parts.length >= 3) {
                newChannel = parts[0].toLowerCase();
                newDevice = parts[1].toLowerCase();
                newModule = parts.slice(2).join(' ').toLowerCase().trim();
                needsUpdate = true;
            } 
            // Pattern 2: Module name has hyphens that should be spaces
            else if (summary.module.includes('-')) {
                newModule = summary.module.replace(/-/g, ' ').toLowerCase().trim();
                needsUpdate = true;
            }

            if (needsUpdate) {
                console.log(`Updating ID ${summary.id}:`);
                console.log(`  Old: ${summary.channel} | ${summary.device} | ${summary.module}`);
                console.log(`  New: ${newChannel} | ${newDevice} | ${newModule}`);

                await prisma.testRunSummary.update({
                    where: { id: summary.id },
                    data: {
                        channel: newChannel,
                        device: newDevice,
                        module: newModule
                    }
                });
                updatedCount++;
            }
        }

        console.log(`\n✅ Refresh complete. Updated ${updatedCount} records.`);
    } catch (error) {
        console.error('❌ Refresh failed:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

refreshAllMetadata();
