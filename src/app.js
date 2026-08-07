import 'express-async-errors';
import express from 'express';import cors from 'cors';import helmet from 'helmet';import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';import customerRoutes from './routes/customer.routes.js';import paymentRoutes from './routes/payment.routes.js';import partnerRoutes from './routes/partner.routes.js';import adminRoutes from './routes/admin.routes.js';import publicRoutes from './routes/public.routes.js';import {notFound,errorHandler} from './middleware/error.js';
export const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Removed morgan logger completely to silence terminal logs as requested

app.get('/health', (req, res) => res.json({ success: true, service: 'milk-men-api' }));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/customer', customerRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/partner', partnerRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);
