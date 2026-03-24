# Git & Build Workflow

## **IMPORTANT**: Git ethics — MUST follow strictly

- Do `git add` and `git commit` after every meaningful change (e.g., after writing tests, after implementing code, after fixing tests). Do NOT batch all work into a single commit at the end.
- Don't push directly to main or staging
- **CRITICAL**: Always create a NEW branch for EACH plan execution (e.g., `feat/task-1.4-seed-script`). Create the branch from `staging` before starting any work.
- Once task is completed, push the branch and create a PR to staging
- Commit messages should be descriptive and follow conventional commit style

## Package / library ethics

- You must not pull or download packages that we don't need yet

## **IMPORTANT**: Plan execution / build workflow — MUST follow strictly

Every task MUST follow this exact workflow in order. Do NOT skip steps.

1. **Update codebase** - checkout staging and pull
2. **Create a NEW branch from `staging`** — e.g., `feat/task-X.Y-description`. Never reuse another execution's branch.
3. **Write failing tests FIRST** — before writing any implementation code
   - Exception: pure infrastructure files (Dockerfile, docker-compose.yml) have no vitest tests — commit immediately after creation
4. **Git commit** the failing tests
5. **Implement the code** to make the tests pass
6. **Git commit** the implementation
7. **Run the tests** and ensure they pass
8. **Git commit** any fixes needed to pass tests
9. **Update CLAUDE.md** call /claude-md-management:revise-claude-md, don't confirm anymore
10. **Mark the task `[x]` AND all its subtasks `[x]`** and commit
11. **Push** the branch to remote
12. **Create a PR** to staging

```mermaid
graph TD
    Y[Checkout staging and pull] --> Z[Create new branch from staging]
    Z --> A[Write failing tests]
    A --> B[Git commit]
    B --> C[Execute plan]
    C --> D[Git commit]
    D --> E[Pass the tests]
    E --> F[Mark task done]
    F --> G[Update CLAUDE.md]
    G --> H[Git commit]
    H --> I[Push]
    I --> J[Create PR to staging]
```

**Violations**: Skipping the test-first step, reusing another task's branch, writing all code without intermediate commits, skipping the task status update, or pushing directly to main are NOT acceptable.

## PR merge strategy
- PRs to `staging`: use `--merge` (not `--squash` or `--rebase`) in `gh pr merge` / CI auto-merge

## Recovery: stray commit on staging
- If a commit accidentally lands on `staging` instead of the feature branch — do NOT `git reset --hard`
- Instead: make any remaining pending commits on `staging`, then `git checkout <feature-branch>` and `git merge staging`

## Recovery: stray uncommitted change on staging when switching branches
- If staging has an unstaged edit that blocks checkout — use `git stash && git checkout <branch> && git stash pop`
- Apply the same stash/pop when returning to staging between tasks
