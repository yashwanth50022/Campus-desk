import 'dotenv/config';
import { app } from './app.js';
import { prisma } from './db.js';

for (const key of ['JWT_ACCESS_SECRET','JWT_REFRESH_SECRET']) {
  const value=process.env[key];
  if (!value || value.length < 32 || value.startsWith('replace-')) throw new Error(`${key} must be configured with at least 32 characters.`);
}
if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) throw new Error('Access and refresh secrets must be different.');
const port=Number(process.env.PORT||4000);
const server=app.listen(port,()=>console.info(`College ERP API listening on port ${port}`));
async function shutdown(){server.close(async()=>{await prisma.$disconnect();process.exit(0);});}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
