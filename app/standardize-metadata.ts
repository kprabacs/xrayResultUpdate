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
 * Migration script to standardize existing module, channel, and device names.
 * It identifies names that look like raw IDs (e.g., "bcom-desktop-creditgateway")
 * and splits them into their respective components.
 */
async function standardizeMetadata() {
    console.log('🚀 Starting metadata standardization...');

    try {
        const summaries = await prisma.testRunSummary.findMany();
        let updatedCount = 0;

        for (const summary of summaries) {
            const { module, channel, device } = summary;
            
            // Check if the module name looks like a full ID (e.g., app-device-module)
            const parts = module.split('-').filter(p => p.trim().length > 0);
            
            if (parts.length >= 3) {
                const newChannel = parts[0].toLowerCase();
                const newDevice = parts[1].toLowerCase();
                const newModule = parts.slice(2).join(' ').toLowerCase().trim();

                console.log(`Updating ID ${summary.id}:`);
                console.log(`  Old: ${channel} | ${device} | ${module}`);
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
            } else if (module.includes('-')) {
                // Just clean up hyphens in module names (e.g., "pricing-and-promotions" -> "pricing and promotions")
                const cleanedModule = module.replace(/-/g, ' ').toLowerCase().trim();
                if (cleanedModule !== module) {
                    console.log(`Cleaning module for ID ${summary.id}: ${module} -> ${cleanedModule}`);
                    await prisma.testRunSummary.update({
                        where: { id: summary.id },
                        data: { module: cleanedModule }
                    });
                    updatedCount++;
                }
            }
        }

        console.log(`\n✅ Migration complete. Updated ${updatedCount} records.`);
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

standardizeMetadata();
