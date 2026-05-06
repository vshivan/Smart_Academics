/**
 * Frontend auth utility tests — token management, role helpers, JWT decode.
 *
 * Run with:
 *   cd Smart_Academics/frontend
 *   npx jest tests/frontend/auth.test.ts
 *
 * Or from workspace root:
 *   cd Smart_Academics/frontend && npx jest --testPathPattern=auth.test
 */

// ── Mock browser APIs ─────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem:    (key: string) => store[key] ?? null,
    setItem:    (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear:      () => { store = {}; },
  };
})();

Object.defineProperty(global, "localStorage", { value: localStorageMock });
Object.defineProperty(global, "document", {
  value: { cookie: "" },
  writable: true,
});
Object.defineProperty(global, "window", { value: global, writable: true });

// ── Helpers ───────────────────────────────────────────────────

function makeJWT(payload: Record<string, unknown>, expOffsetSeconds = 3600): string {
  const header  = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp     = Math.floor(Date.now() / 1000) + expOffsetSeconds;
  const body    = btoa(JSON.stringify({ ...payload, exp }));
  const sig     = btoa("fake-signature");
  return `${header}.${body}.${sig}`;
}

function makeExpiredJWT(payload: Record<string, unknown>): string {
  return makeJWT(payload, -3600); // expired 1 hour ago
}

// ── Import after mocks ────────────────────────────────────────
// We test the pure functions directly since they don't depend on Next.js
import {
  decodeToken,
  isTokenExpired,
  getCurrentPayload,
  getToken,
  getStoredUser,
  saveSession,
  clearSession,
  getCurrentRole,
  hasRole,
  hasPermission,
  isAdmin,
  isHodOrAdmin,
  isStudent,
  ROLE_LABELS,
  ROLE_COLORS,
  type User,
  type JwtPayload,
  type Role,
} from "../../frontend/src/lib/auth";


// ── decodeToken ───────────────────────────────────────────────

describe("decodeToken", () => {
  it("decodes a valid JWT payload", () => {
    const token = makeJWT({ user_id: "u1", email: "a@b.com", role: "faculty", permissions: [] });
    const payload = decodeToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.user_id).toBe("u1");
    expect(payload!.email).toBe("a@b.com");
    expect(payload!.role).toBe("faculty");
  });

  it("returns null for invalid token", () => {
    expect(decodeToken("not.a.token")).toBeNull();
    expect(decodeToken("")).toBeNull();
    expect(decodeToken("only-one-part")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(decodeToken("header.!!!invalid!!!.sig")).toBeNull();
  });

  it("decodes permissions array", () => {
    const token = makeJWT({ user_id: "u1", email: "a@b.com", role: "admin", permissions: ["manage_colleges", "manage_all_users"] });
    const payload = decodeToken(token);
    expect(payload!.permissions).toContain("manage_colleges");
    expect(payload!.permissions).toContain("manage_all_users");
  });

  it("decodes college_id", () => {
    const token = makeJWT({ user_id: "u1", email: "a@b.com", role: "faculty", college_id: "col-123", permissions: [] });
    const payload = decodeToken(token);
    expect(payload!.college_id).toBe("col-123");
  });
});


// ── isTokenExpired ────────────────────────────────────────────

describe("isTokenExpired", () => {
  it("returns false for valid token", () => {
    const token = makeJWT({ user_id: "u1", email: "a@b.com", role: "faculty", permissions: [] });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("returns true for expired token", () => {
    const token = makeExpiredJWT({ user_id: "u1", email: "a@b.com", role: "faculty", permissions: [] });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("returns true for invalid token", () => {
    expect(isTokenExpired("invalid")).toBe(true);
  });

  it("returns true for empty string", () => {
    expect(isTokenExpired("")).toBe(true);
  });
});


// ── saveSession / clearSession / getToken ─────────────────────

describe("session management", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("saveSession stores token and user", () => {
    const token = makeJWT({ user_id: "u1", email: "a@b.com", role: "faculty", permissions: [] });
    const user: User = { email: "a@b.com", name: "Test User", role: "faculty" };
    saveSession(token, user);
    expect(getToken()).toBe(token);
    expect(getStoredUser()).toEqual(user);
  });

  it("clearSession removes token and user", () => {
    const token = makeJWT({ user_id: "u1", email: "a@b.com", role: "faculty", permissions: [] });
    saveSession(token, { email: "a@b.com", name: "Test", role: "faculty" });
    clearSession();
    expect(getToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it("getToken returns null when not set", () => {
    expect(getToken()).toBeNull();
  });

  it("getStoredUser returns null when not set", () => {
    expect(getStoredUser()).toBeNull();
  });

  it("getStoredUser handles corrupted JSON gracefully", () => {
    localStorageMock.setItem("user", "not-valid-json{{{");
    expect(getStoredUser()).toBeNull();
  });
});


// ── getCurrentPayload ─────────────────────────────────────────

describe("getCurrentPayload", () => {
  beforeEach(() => localStorageMock.clear());

  it("returns null when no token", () => {
    expect(getCurrentPayload()).toBeNull();
  });

  it("returns payload for valid token", () => {
    const token = makeJWT({ user_id: "u1", email: "a@b.com", role: "hod", permissions: ["view_dept_analytics"] });
    localStorageMock.setItem("access_token", token);
    const payload = getCurrentPayload();
    expect(payload).not.toBeNull();
    expect(payload!.role).toBe("hod");
  });

  it("returns null and clears session for expired token", () => {
    const token = makeExpiredJWT({ user_id: "u1", email: "a@b.com", role: "faculty", permissions: [] });
    localStorageMock.setItem("access_token", token);
    const payload = getCurrentPayload();
    expect(payload).toBeNull();
    expect(getToken()).toBeNull(); // session cleared
  });
});


// ── Role helpers ──────────────────────────────────────────────

describe("role helpers", () => {
  beforeEach(() => localStorageMock.clear());

  function setRole(role: string, permissions: string[] = []) {
    const token = makeJWT({ user_id: "u1", email: "a@b.com", role, permissions });
    localStorageMock.setItem("access_token", token);
  }

  describe("getCurrentRole", () => {
    it("returns faculty when no token", () => {
      expect(getCurrentRole()).toBe("faculty");
    });

    it("returns correct role from token", () => {
      setRole("admin");
      expect(getCurrentRole()).toBe("admin");
    });

    it("returns hod for hod role", () => {
      setRole("hod");
      expect(getCurrentRole()).toBe("hod");
    });
  });

  describe("hasRole", () => {
    it("returns true when role matches", () => {
      setRole("admin");
      expect(hasRole("admin")).toBe(true);
    });

    it("returns false when role does not match", () => {
      setRole("faculty");
      expect(hasRole("admin")).toBe(false);
    });

    it("returns true for any matching role in list", () => {
      setRole("hod");
      expect(hasRole("hod", "admin")).toBe(true);
    });

    it("returns false when none match", () => {
      setRole("faculty");
      expect(hasRole("hod", "admin")).toBe(false);
    });
  });

  describe("hasPermission", () => {
    it("returns true when permission present", () => {
      setRole("faculty", ["upload_syllabus", "generate_papers"]);
      expect(hasPermission("upload_syllabus")).toBe(true);
    });

    it("returns false when permission absent", () => {
      setRole("faculty", ["upload_syllabus"]);
      expect(hasPermission("manage_colleges")).toBe(false);
    });

    it("returns false when no token", () => {
      expect(hasPermission("upload_syllabus")).toBe(false);
    });

    it("returns false for empty permissions array", () => {
      setRole("faculty", []);
      expect(hasPermission("upload_syllabus")).toBe(false);
    });
  });

  describe("isAdmin", () => {
    it("returns true for admin", () => { setRole("admin"); expect(isAdmin()).toBe(true); });
    it("returns false for faculty", () => { setRole("faculty"); expect(isAdmin()).toBe(false); });
    it("returns false for hod", () => { setRole("hod"); expect(isAdmin()).toBe(false); });
  });

  describe("isHodOrAdmin", () => {
    it("returns true for hod", () => { setRole("hod"); expect(isHodOrAdmin()).toBe(true); });
    it("returns true for admin", () => { setRole("admin"); expect(isHodOrAdmin()).toBe(true); });
    it("returns false for faculty", () => { setRole("faculty"); expect(isHodOrAdmin()).toBe(false); });
    it("returns false for student", () => { setRole("student"); expect(isHodOrAdmin()).toBe(false); });
  });

  describe("isStudent", () => {
    it("returns true for student", () => { setRole("student"); expect(isStudent()).toBe(true); });
    it("returns false for faculty", () => { setRole("faculty"); expect(isStudent()).toBe(false); });
  });
});


// ── Role display constants ────────────────────────────────────

describe("ROLE_LABELS", () => {
  it("has label for all roles", () => {
    const roles: Role[] = ["admin", "hod", "faculty", "student"];
    roles.forEach(role => {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(typeof ROLE_LABELS[role]).toBe("string");
    });
  });

  it("admin label is Administrator", () => {
    expect(ROLE_LABELS.admin).toBe("Administrator");
  });

  it("hod label mentions Department", () => {
    expect(ROLE_LABELS.hod).toContain("Department");
  });
});

describe("ROLE_COLORS", () => {
  it("has color for all roles", () => {
    const roles: Role[] = ["admin", "hod", "faculty", "student"];
    roles.forEach(role => {
      expect(ROLE_COLORS[role]).toBeTruthy();
      expect(ROLE_COLORS[role]).toContain("bg-");
      expect(ROLE_COLORS[role]).toContain("text-");
    });
  });
});
