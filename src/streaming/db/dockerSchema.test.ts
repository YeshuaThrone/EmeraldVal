import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../../..");

describe("docker postgres bootstrap", () => {
  it("keeps init-schema.sql identical to the runtime schema", () => {
    const schema = readFileSync(
      path.join(repoRoot, "src/streaming/db/schema.sql"),
      "utf8",
    );
    const init = readFileSync(path.join(repoRoot, "init-schema.sql"), "utf8");
    expect(init).toContain("channel_programs");
    expect(init).toContain("Tears of Steel (4K Sci-Fi)");
    expect(init).toContain("ON CONFLICT DO NOTHING");
  });

  it("compose wires the app to worfi-db with an admin secret", () => {
    const compose = readFileSync(
      path.join(repoRoot, "docker-compose.yml"),
      "utf8",
    );
    expect(compose).toContain("worfi-db:");
    expect(compose).toContain("init-schema.sql");
    expect(compose).toContain("DATABASE_URL: postgres://worfi_admin:");
    expect(compose).toContain("WORFI_ADMIN_SECRET:");
    expect(compose).toContain('condition: service_healthy');
  });
});
