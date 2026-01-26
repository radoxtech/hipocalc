# AI Agent Git Workflow Rules

## Branch Strategy

### NEVER push directly to main
- All changes MUST go through feature/bugfix branches
- Each bug, fix, or feature MUST have its own dedicated branch
- Branches are merged to main via pull request or local merge

### Branch Naming
- Features: `feat/<short-description>`
- Bugfixes: `fix/<short-description>`
- Docs: `docs/<short-description>`

### One Branch = One Concern
- Do NOT mix multiple features in one branch
- Do NOT mix bugfixes with new features
- Each branch should be independently mergeable

## Versioning (Semantic Versioning)

Format: `MAJOR.MINOR.PATCH` (e.g., 1.2.3)

### PATCH increment (1.0.0 → 1.0.1)
- Bugfixes
- Small features / minor improvements
- Typo fixes, small UI tweaks

### MINOR increment (1.0.0 → 1.1.0)
- New significant feature
- Major UI changes
- New functionality visible to users

### MAJOR increment (1.0.0 → 2.0.0)
- Breaking changes
- Complete redesign
- Incompatible API changes

## Release Strategy

### Single branch merge
- Merge branch to main
- Create tag and release immediately

### Multiple branches to merge
- Merge all branches to main first
- Create ONE release at the end with combined changelog
- Version bump based on highest change type:
  - If any MINOR change → bump MINOR
  - If only PATCH changes → bump PATCH

## Workflow Example

```bash
# Start new feature
git checkout -b feat/add-chart-tooltip
# ... make changes ...
git add -A && git commit -m "feat: add chart tooltip"
git checkout main && git merge feat/add-chart-tooltip
git branch -d feat/add-chart-tooltip

# If more branches to merge, continue...
# After all merges, create release:
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin main --tags
gh release create v1.2.0 --title "v1.2.0" --notes "..."
```

## Commit Message Format

```
<type>: <short description>

<optional body>
```

Types:
- `feat:` - new feature
- `fix:` - bug fix
- `docs:` - documentation
- `refactor:` - code refactoring
- `test:` - tests
- `chore:` - maintenance

---

## CRITICAL: Main Branch Protection

Since GitHub branch protection requires paid plans, this rule is ENFORCED BY AI AGENTS:

### ABSOLUTE PROHIBITION
```
git push origin main        # ❌ FORBIDDEN
git push origin main --tags # ❌ FORBIDDEN  
git push --force            # ❌ FORBIDDEN
```

### ONLY ALLOWED
```
git push origin <feature-branch>  # ✅ OK
git push -u origin feat/xyz       # ✅ OK
```

### Merge Workflow
1. Push feature branch to origin
2. Create PR via `gh pr create`
3. Wait for owner approval
4. Owner merges via GitHub UI or `gh pr merge`

### After Merge (owner only)
```
git checkout main
git pull origin main
git tag -a vX.Y.Z -m "Release"
git push origin main --tags  # Only after PR merge!
```

**AI agents must NEVER push directly to main. Always use PR workflow.**

## Deployment

Deployment to GitHub Pages happens automatically when a **release is published**.

### Trigger
- `on: release` with `types: [published]`
- NOT on push to main

### Workflow
1. Merge PR to main
2. Create and push tag: `git tag -a vX.Y.Z -m "Release" && git push origin --tags`
3. Create release: `gh release create vX.Y.Z --title "vX.Y.Z" --notes "..."`
4. GitHub Actions automatically deploys to Pages