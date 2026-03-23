# Task 4.2: Reset Password

## Context

Implementing a two-step password reset flow as defined in `specs/v1/implementation-plan.md` (lines 226-229). The feature allows unauthenticated users to reset their password via a short-lived JWT reset token. Step 1 generates the token (returned in response); Step 2 validates the token, updates the password, and revokes all refresh tokens (same kill-switch as `changePassword`).

---

## Branch

Create from `main`: `feat/task-4.2-reset-password`

---

## Files to Modify

| File | Change |
|---|---|
| `src/utils/jwt.ts` | Add `signResetToken` + `verifyResetToken` |
| `src/validators/auth.validators.ts` | Add `requestPasswordResetSchema` + type |
| `src/services/auth.service.ts` | Add `requestPasswordReset` + `resetPassword` |
| `src/routes/auth.routes.ts` | Add 2 new routes |
| `src/services/__tests__/auth.service.test.ts` | Add tests for both service functions |
| `src/routes/__tests__/auth.routes.test.ts` | Add tests for both routes |

---

## Implementation Steps

### Step 1: `src/utils/jwt.ts` — Add reset token functions

```ts
export function signResetToken(payload: { sub: string }): string {
  return jwt.sign({ ...payload, purpose: "reset" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
}

export function verifyResetToken(token: string): { sub: string } {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; purpose: string };
    if (decoded.purpose !== "reset") throw new Error();
    return { sub: decoded.sub };
  } catch {
    throw new UnauthorizedError("Invalid or expired reset token");
  }
}
```

- Uses `JWT_ACCESS_SECRET` (no new env var needed)
- Validates `purpose === "reset"` to prevent access token reuse

### Step 2: `src/validators/auth.validators.ts` — Add request schema

```ts
export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;
```

`resetPasswordSchema` (token + newPassword) already exists.

### Step 3: `src/services/auth.service.ts` — Add two functions

**`requestPasswordReset(email: string)`:**
1. Fetch user by email — throw `NotFoundError` if not found
2. Sign reset token with `signResetToken({ sub: user.id })`
3. Return `{ resetToken }`

**`resetPassword(data: ResetPasswordInput)`:**
1. `verifyResetToken(data.token)` — throws `UnauthorizedError` if invalid
2. Fetch user by `sub` — throw `NotFoundError` if not found
3. Hash `data.newPassword` with `hashPassword`
4. Transaction: update `users.passwordHash` + delete all `refreshTokens` for user (same pattern as `changePassword`)

### Step 4: `src/routes/auth.routes.ts` — Add two routes

```ts
router.post(
  "/reset-password",
  validate(requestPasswordResetSchema),
  asyncHandler(async (req, res) => {
    const result = await requestPasswordReset(req.body.email);
    sendSuccess(res, result);
  }),
);

router.post(
  "/reset-password/confirm",
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await resetPassword(req.body);
    sendSuccess(res);
  }),
);
```

Both are public (no `authenticate` middleware).

---

## Commit Strategy (per git-workflow)

1. Write failing tests → commit
2. Implement code → commit
3. Fix any test issues → commit
4. Mark task done in implementation-plan.md → commit
5. Push + PR

---

## Verification

```bash
npm test -- --reporter=verbose src/services/__tests__/auth.service.test.ts
npm test -- --reporter=verbose src/routes/__tests__/auth.routes.test.ts
```

Test cases to cover:
- `requestPasswordReset`: success (returns resetToken), NotFoundError on unknown email
- `resetPassword`: success (password updated, refresh tokens deleted), UnauthorizedError on bad/expired token, NotFoundError on unknown userId in token
