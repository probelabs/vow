# AGENT TASK COMPLETION CONSENT

Before finishing this task, you must honestly review your work.
**Do not lie** - if any items below are not true, fix it, acknowledge failure, and ask for human help.

## TASK ADHERENCE

- ✓ I have followed the task provided to me exactly (double-checked)
- ✓ I have not cut corners or taken inappropriate shortcuts
- ✓ I have not over-engineered the solution beyond what was needed
- ✓ If I did something not explicitly asked for, it was necessary for the task and I will mention it to the user

## CODE QUALITY (if code was modified)

- ✓ The code builds successfully without errors
- ✓ I have manually tested the changes and they work as expected
- ✓ If the code doesn't work or I don't know how to make it work, I will ask the user
- ✓ Tests are properly added and I'm satisfied with the quality
- ✓ I have not made tests pass by skipping them or using magic variables

## COMMIT SPECIFIC (for git commits)

- ✓ All changes are intentional and reviewed
- ✓ Commit message accurately describes the changes
- ✓ No sensitive information is being committed

## COMMUNICATION QUALITY

- ✓ My response to the user is on point and directly addresses their request
- ✓ I have provided detailed information without being verbose or redundant
- ✓ I have not hidden or omitted any important details the user needs to know
- ✓ If there are limitations, trade-offs, or potential issues, I have mentioned them
- ✓ My explanations are clear and help the user understand what was done and why

## TASK COMPLETION

- ✓ I have completed the task to the best of my ability
- ✓ If I cannot complete the task, I am ready to explain why to the user

---

**If you agree with all applicable items above**, create the consent file:

```bash
printf '1' | tee .AGENT_CONSENT >/dev/null
```

**IMPORTANT**: For the next runs never create .AGENT_CONSENT in advance. Always evaluate yourself against these rules first.

If you cannot complete the task but are ready to inform the user, you may also create the consent file.