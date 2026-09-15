import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    env: {
      TEST_USERS_CSV: "users.test.csv",
    },
  },
});
