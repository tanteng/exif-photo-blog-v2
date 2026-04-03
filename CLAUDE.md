# Project: EXIF Photo Blog

A Next.js photo blog with EXIF metadata support, Tencent COS image storage, and admin management.

## Tech Stack
- **Framework**: Next.js 16.1.6
- **Package Manager**: pnpm
- **Database**: PostgreSQL
- **Image Storage**: Tencent COS (CI image optimization)
- **Auth**: NextAuth (admin authentication)
- **UI**: Tailwind CSS, Radix UI, Framer Motion

## Commands
```bash
pnpm dev      # Start development server
pnpm build    # Production build
pnpm start    # Start production server
pnpm lint     # Run ESLint
pnpm test     # Run Jest tests
```

## Key Paths
- Admin pages: `/admin/photos`, `/admin/albums`, `/admin/tags`, `/admin/uploads`
- Photo pages: `/photo/[id]`, `/grid`, `/full`
- Source: `src/app/`, `src/photo/`, `src/admin/`

## Notes
- Authentication required for admin features
- Images served via Tencent COS CI with auto-orient EXIF rotation
- Mobile swipe navigation on photo detail page

## Workflow (Superpowers)

### 技能使用规则
**在执行任何任务前，检查是否有适用的 Superpowers 技能。**

### 何时使用技能
| 场景 | 技能 |
|------|------|
| 创建功能、添加新功能、修改行为 | brainstorming |
| 遇到 bug、测试失败、异常行为 | systematic-debugging |
| 实现功能或修复 bug 前 | test-driven-development |
| 完成开发工作，准备合并/PR | finishing-a-development-branch |
| 完成代码，需要审查验证 | requesting-code-review |
| 收到代码审查反馈 | receiving-code-review |
| 有多个独立任务需要并行执行 | dispatching-parallel-agents |
| 有实现计划需要执行 | executing-plans |

### 核心原则
1. **任务 = 检查技能**：任何任务开始前，先检查是否有适用的技能
2. **用户指令优先**：CLAUDE.md 中的指令高于技能默认行为
3. **简单任务也检查**：即使认为任务简单，也要先检查技能
4. **技能是刚性规范**：标注为"rigid"的技能必须严格遵守

### 技能调用方式
```
使用 Skill 工具调用技能，例如：
- Skill("superpowers:brainstorming")
- Skill("superpowers:systematic-debugging")
- Skill("superpowers:test-driven-development")
```
