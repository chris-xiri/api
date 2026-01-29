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

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Firebase
// (Auto-initialized on import)

app.use('/api/vendors', vendorRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/audit', auditRoutes);


app.get('/', (req, res) => {
    res.send('Xiri API is running');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
