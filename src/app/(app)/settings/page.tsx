import { pageUser } from "@/server/page-auth";
import { getDb } from "@/lib/db";
import { StudyService } from "@/server/study";
import { SettingsForm } from "@/components/settings-form";
export default async function Settings() {
  const settings = await new StudyService(getDb()).settings(await pageUser());
  return (
    <>
      <header className="mb-8">
        <p className="eyebrow mb-3">Atur ritmemu</p>
        <h1 className="page-title">Pengaturan belajar</h1>
        <p className="mt-2 text-muted-foreground">
          Kebiasaan kecil yang sesuai dengan harimu.
        </p>
      </header>
      <SettingsForm initial={settings} />
    </>
  );
}
