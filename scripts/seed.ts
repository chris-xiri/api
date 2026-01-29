import path from 'path';
import dotenv from 'dotenv';
// Load .env before anything else
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { db, auth } from '../src/config/firebase';

async function seed() {
    console.log('Starting seed process...');

    try {
        // 1. Create Demo Users
        const users = [
            {
                email: 'admin@xiri.ai',
                password: 'password123',
                displayName: 'Global Admin',
                role: 'admin'
            },
            {
                email: 'auditor@xiri.ai',
                password: 'password123',
                displayName: 'Field Auditor',
                role: 'auditor',
                territoryId: 'T-001'
            }
        ];

        for (const userData of users) {
            try {
                let userRecord;
                try {
                    userRecord = await auth.getUserByEmail(userData.email);
                    console.log(`User ${userData.email} already exists.`);
                } catch {
                    userRecord = await auth.createUser({
                        email: userData.email,
                        password: userData.password,
                        displayName: userData.displayName,
                    });
                    console.log(`Created new user: ${userData.email}`);
                }

                // Sync to Firestore
                await db.collection('users').doc(userRecord.uid).set({
                    email: userData.email,
                    displayName: userData.displayName,
                    role: userData.role,
                    territoryId: userData.territoryId || null,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            } catch (err) {
                console.error(`Error syncing user ${userData.email}:`, err);
            }
        }

        // 2. Create Mock Vendors
        const vendors = [
            { id: 'v1', name: 'Elite HVAC Solutions', trade: 'HVAC', zipCode: '20001', rating: 4.8 },
            { id: 'v2', name: 'Metro Electric', trade: 'Electrician', zipCode: '20002', rating: 4.5 },
            { id: 'v3', name: 'Pure Water Plumbing', trade: 'Plumbing', zipCode: '20001', rating: 4.9 },
        ];

        for (const v of vendors) {
            await db.collection('vendors').doc(v.id).set(v);
        }
        console.log('Vendors seeded.');

        // 3. Create Mock Jobs
        const jobs = [
            {
                id: 'j1',
                vendorId: 'v1',
                vendorName: 'Elite HVAC Solutions',
                territoryId: 'T-001',
                status: 'completed',
                date: new Date().toISOString().split('T')[0],
                trade: 'HVAC',
                location: 'Site A'
            },
            {
                id: 'j2',
                vendorId: 'v2',
                vendorName: 'Metro Electric',
                territoryId: 'T-002',
                status: 'assigned',
                date: new Date().toISOString().split('T')[0],
                trade: 'Electrical',
                location: 'Site B'
            }
        ];

        for (const j of jobs) {
            await db.collection('jobs').doc(j.id).set(j);
        }
        console.log('Jobs seeded.');

        console.log('Seed process completed successfully.');
    } catch (error) {
        console.error('Seed process failed:', error);
    }
}

seed().then(() => process.exit(0));
