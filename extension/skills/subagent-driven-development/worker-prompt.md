# Worker Subagent Prompt Template

Use this template when dispatching a worker subagent.

```md
Subagent dispatch — worker:
  task: "Implement Task N: [task name]"
  system_prompt: |
    You are implementing Task N: [task name]

    ## Task Description

    [FULL TEXT of task from plan - paste it here, don't make subagent read file]

    ## Context

    [Scene-setting: where this fits, dependencies, architectural context]

    Work from: [directory]

    If anything is unclear, ask before starting. If stuck, report BLOCKED or NEEDS_CONTEXT with details.
```
