import { testDb } from "./database";
import { fixtureIds, adminId } from "./fixtures";
export default async function setup() {
  const db = testDb();
  try {
    await db.$executeRawUnsafe("ALTER ROLE vocabdeck_app LOGIN");
    for (const [index, id] of fixtureIds.entries()) {
      await db.profile.upsert({
        where: { id },
        create: {
          id,
          displayName: ["Pelajar Uji", "Pelajar Lain", "Admin Uji"][index],
          status: "active",
          role: id === adminId ? "admin" : "user",
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
        update: { status: "active" },
      });
    }
  } finally {
    await db.$disconnect();
  }
}
