const pool = require("../config/db");

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("expo-server-sdk", () => ({
  Expo: class ExpoMock {
    static isExpoPushToken() {
      return true;
    }
    chunkPushNotifications(messages) {
      return [messages];
    }
    async sendPushNotificationsAsync(chunk) {
      return chunk.map(() => ({ status: "ok" }));
    }
  },
}));

jest.mock("../config/push.config", () => ({
  APP_SCOPE: "SINDICATO",
  EXPO_PROJECT_ID: "proj-1",
}));

const service = require("./push.service");

describe("push.service - filtro sindical em alvos", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("resolvePushTargets ALL deve incluir filtro FILIADO_SINPRF_ES", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ expo_push_token: "ExponentPushToken[abc]", expo_project_id: "proj-1" }] })
      .mockResolvedValueOnce({ rows: [{ total: 1, without_expo_project_id: 0 }] });

    await service.resolvePushTargets("ALL");

    const sqlPrincipal = pool.query.mock.calls[0][0];
    expect(sqlPrincipal).toContain("JOIN filiados f ON pt.user_id = f.id");
    expect(sqlPrincipal).toContain("f.situacao_sindical = 'FILIADO_SINPRF_ES'");
  });

  test("resolvePushTargets FILIADO deve incluir filtro FILIADO_SINPRF_ES", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ expo_push_token: "ExponentPushToken[abc]", expo_project_id: "proj-1" }] })
      .mockResolvedValueOnce({ rows: [{ total: 1, without_expo_project_id: 0 }] });

    await service.resolvePushTargets("FILIADO", 10);

    const sqlPrincipal = pool.query.mock.calls[0][0];
    expect(sqlPrincipal).toContain("JOIN filiados f ON pt.user_id = f.id");
    expect(sqlPrincipal).toContain("f.situacao_sindical = 'FILIADO_SINPRF_ES'");
  });
});
