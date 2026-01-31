import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

import vendorRoutes from './routes/vendorRoutes';
import jobRoutes from './routes/jobRoutes';
import auditRoutes from './routes/auditRoutes';
import crmRoutes from './routes/crmRoutes';
import activityRoutes from './routes/activityRoutes';
import contactRoutes from './routes/contactRoutes';

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Firebase
// (Auto-initialized on import)

app.use('/api/vendors', vendorRoutes);
app.use('/api/jobs', jobRoutes);

app.use('/api/audit', auditRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/contacts', contactRoutes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});


app.get('/', (req, res) => {
    res.send('Xiri API is running');
});

import cron from 'node-cron';
import { processDailyDrip } from './services/campaignService';

// ... (existing code)

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);

        // Initialize Cron Jobs
        console.log('Initializing Cron Jobs...');
        cron.schedule('0 9 * * *', () => {
            console.log('Running daily campaign drip...');
            processDailyDrip();
        });
    });
}

export default app;
