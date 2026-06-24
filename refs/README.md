# Refs Initialization Guide

This folder is a reusable project-memory harness for coding agents and human collaborators. It is intentionally generic until copied into a real project.

## Setup Workflow

1. Copy this `refs/` folder into the target project root.
2. Read `refs/templatePolicy.yaml` to identify required bootstrap files and allowed template placeholders.
3. Replace `TEMPLATE_TODO` and `TEMPLATE_TODO_DATE` in required bootstrap files with project facts.
4. Run validation from the project root:

   ```powershell
   python refs/tools/validate_refs.py --mode initialized
   ```

5. Keep durable project knowledge in `refs/` instead of only in chat.
6. Do not store secrets, API keys, tokens, passwords, or machine-only credentials in `refs/`.

## Required Bootstrap Files

Fill these first after copying the harness:

- `refs/project.yaml`: project identity, purpose, stack summary, source-of-truth links.
- `refs/agents.yaml`: instructions agents must follow before editing the project.
- `refs/planning/roadmap.yaml`: current direction and sequence.
- `refs/planning/todos.yaml`: durable task list.
- `refs/architecture/overview.md`: how the system is shaped.
- `refs/implementation/fileMap.yaml`: where important code lives.
- `refs/handoffs/currentHandoff.md`: current state and next-agent context.
- `refs/testing/validationCommands.yaml`: commands agents should run before finishing work.

## Template Placeholders

Use only these sentinel placeholders in the blank harness:

- `TEMPLATE_TODO`: value intentionally left blank for the destination project.
- `TEMPLATE_TODO_DATE`: date intentionally left blank for the destination project.

Use `refs/fileGuide.yaml` for file-by-file guidance and `refs/MAINTENANCE.md` for framework maintenance.
