# Task 4.1: Change Password (`POST /auth/change-password`)

## Context
Task 4.1 implements the change-password endpoint. It's an authenticated route that verifies the user's old password, hashes the new one, updates the DB, and deletes **all** refresh tokens for that user (security kill-switch). The `changePasswordSchema` and `ChangePasswordInput` type already exist in `src/validators/auth.validators.ts`.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/services/auth.service.ts` | Add `changePassword(userId, data)` function |
| `src/routes/auth.routes.ts` | Add `POST /auth/change-password` route |
| `src/services/__tests__/auth.service.test.ts` | Add tests for `changePassword` |
| `src/routes/__tests__/auth.routes.test.ts` | Add tests for the new route |
| `specs/v1/implementation-plan.md` | Mark task `[x]` |

---

## Implementation Steps

### Step 1 — Write failing tests (commit before implementation)

#### Service test (`src/services/__tests__/auth.service.test.ts`)
Add a `describe("changePassword")` block:
- **Success**: mock user found, `verifyPassword` returns `true`, `hashPassword` returns new hash → expect `db.update` called with new hash and `db.delete(refreshTokens).where(userId)` called
- **User not found**: `mockWhere` returns `[]` → expect `NotFoundError` thrown
- **Wrong old password**: `verifyPassword` returns `false` → expect `UnauthorizedError("Invalid credentials")` thrown

#### Route test (`src/routes/__tests__/auth.routes.test.ts`)
Add tests for `POST /auth/change-password`:
- Use `getHandler("post", "/change-password")` — last handler (skips `authenticate` + `validate`)
- Mock `req.user = { sub: "user-id", email: "test@example.com", permissions: [] }`
- **Success**: mock `changePassword` resolves → expect `res.json` called with `{ success: true }`
- **Service throws**: mock rejects → `next` called with the error

### Step 2 — Implement `changePassword` in auth service

```ts
export async function changePassword(
  userId: string,
  data: ChangePasswordInput,
): Promise<void> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundError("User not found");

  const valid = await verifyPassword(data.oldPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid credentials");

  const newHash = await hashPassword(data.newPassword);

  await db.transaction(async (tx) => {
    await tx.update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  });
}
```

### Step 3 — Add route in `src/routes/auth.routes.ts`

```ts
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await changePassword(req.user!.sub, req.body);
    sendSuccess(res);
  }),
);
```

---

## Reused Utilities
- `verifyPassword` / `hashPassword` — `src/utils/password.ts`
- `authenticate` — `src/middleware/authenticate.ts`
- `validate` — `src/middleware/validate.ts`
- `asyncHandler` — `src/utils/async-handler.ts`
- `sendSuccess` — `src/utils/response.ts`
- `UnauthorizedError`, `NotFoundError` — `src/utils/errors.ts`
- `changePasswordSchema` — already in `src/validators/auth.validators.ts`

---

## Git Commits (in order)
1. `test(task-4.1): add failing tests for changePassword service and route`
2. `feat(task-4.1): implement change-password endpoint`
3. `docs(task-4.1): mark task complete in implementation plan`

---

## Verification
```bash
npm run test -- auth.service auth.routes
```
All tests should pass. Manual check: `POST /auth/change-password` with valid Bearer token + correct old password → 200; old refresh tokens for that user deleted from DB.
