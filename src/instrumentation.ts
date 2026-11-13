export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { runMigrations } = await import("./lib/db/migrate");
  await runMigrations();
  if (process.env.SEED_QUESTIONS !== "off") {
    const { seedIfEmpty } = await import("./lib/quiz/seed");
    await seedIfEmpty().catch((error) => console.error("[seed] failed", error));
  }
}
