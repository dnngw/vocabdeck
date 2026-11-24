import { testDb } from "./database";
import { fixtureIds } from "./fixtures";
export default async function teardown() {
  const db = testDb();
  try {
    await db.appSetting.deleteMany({
      where: { updatedBy: { in: fixtureIds } },
    });
    await db.auditLog.deleteMany({ where: { actorId: { in: fixtureIds } } });
    await db.profile.deleteMany({ where: { id: { in: fixtureIds } } });
  } finally {
    await db.$disconnect();
  }
}
