import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schemas';

const db = drizzle(process.env.DATABASE_URL!, { schema });

export default db;
