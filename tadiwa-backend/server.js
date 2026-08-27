import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './apps/auth/routes/auth.js';
import userRoutes from './apps/users/routes/user.js';
import escalationRoutes from './apps/escalations/routes/escalations.js';
import knowledgeBaseRoutes from './apps/knowledgeBase/routes/knowledgeBase.js';
import chatRoutes from './apps/chats/routes/chats.js';
import auditRoutes from './apps/audit/routes/audit.js';
import productivityRoutes from './apps/productivity/routes/productivity.js';
import scheduleRoutes from './apps/schedule/routes/schedule.js';
import dashboardRoutes from './apps/dashboard/routes/dashboard.js';
import notificationRoutes from './apps/notifications/routes/notifications.js';
import errorHandler from './middleware/errorHandler.js';
import helmetConfig from './config/helmetConfig.js';
import corsOptions from './config/corsOptions.js';

const app = express();
const port = process.env.PORT;

app.use(helmet(helmetConfig));
app.use(cors(corsOptions));
app.use(express.json());


// application  routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/productivity', productivityRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
