export async function register() {
  // 只在 Node.js 运行时执行（不在 Edge 运行时）
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { migrate } = await import('drizzle-orm/node-postgres/migrator');
    const { Pool } = await import('pg');
    const { drizzle } = await import('drizzle-orm/node-postgres');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);

    // Advisory Lock ID - 用于确保多实例部署时只有一个实例执行迁移
    const MIGRATION_LOCK_ID = 123456;

    try {
      // 尝试获取 Advisory Lock（非阻塞）
      const result = await pool.query(
        `SELECT pg_try_advisory_lock($1) as acquired`,
        [MIGRATION_LOCK_ID]
      );

      if (result.rows[0].acquired) {
        console.log('[Migration] Got lock, running migrations...');
        await migrate(db, { migrationsFolder: './drizzle' });
        console.log('[Migration] Migrations completed successfully');
        await pool.query(`SELECT pg_advisory_unlock($1)`, [MIGRATION_LOCK_ID]);
      } else {
        console.log('[Migration] Another instance is running migrations, skipping...');
      }
    } catch (error) {
      console.error('[Migration] Error:', error);
      // 不抛出错误，让应用继续启动
      // 如果迁移真的失败了，应用运行时会报错
    } finally {
      await pool.end();
    }
  }
}
