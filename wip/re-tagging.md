When people say “DCB is dynamic,” that can mean several very different things. Here’s the spectrum, from conservative to radical.

* * *

1️⃣ Dynamic Query Composition (Minimal Dynamism)
================================================

**Tags are stable.**  
**Events are immutable.**  
**Only the query is dynamic.**

At append time, the command handler constructs:

```
DCBQuery(items=\[...\])
```

based on:

*   Command parameters

*   Current state

*   Derived relationships


The dynamism is:

> Which query items are included for this append.

Tags remain fixed.  
History is untouched.

This is the most conservative and stable interpretation.  

* * *

2️⃣ Dynamic Boundary Scope (State-Dependent Expansion)
======================================================

Tags are still stable.

But the boundary expands based on current derived state.

Example pattern:

*   Read state.

*   Determine related entity IDs.

*   Include those IDs as tags in query items.


The dynamic part is:

> The set of tags included in the query is computed from current state.

Again: tags on events don’t change.  
Only the boundary definition changes.

This is still clean and deterministic.

* * *

3️⃣ Dynamic Invariant Definition (Evolving Rules)
=================================================

Here, the DCB query logic itself evolves over time.

Version 1 rule:

```
Query includes student + course
```

Version 2 rule:

```
Query includes student + course + track
```

Now the boundary definition changes across time.

Tags are still stable,  
but different commands at different times construct different boundaries.

This is more dynamic — but still no retagging.

Replay determinism may require versioning the rule logic.

* * *

4️⃣ Dynamic Tag Semantics (Reclassification)
============================================

Now we cross a line.

Tags themselves are reinterpreted or rewritten.

Examples:

*   Re-tagging historical events.

*   Adding new tags retroactively.

*   Removing tags.

*   Recomputing structural membership.


Now dynamism applies to:

> Event structural classification.

This changes:

*   Which boundaries historical events belonged to.

*   Which conflicts they would have participated in.

*   Potential replay semantics.


This is where immutability arguments get serious.

* * *

5️⃣ Fully Dynamic Structural Derivation (Tags as Index Only)
============================================================

Extreme version:

Tags are treated like rebuildable indexes.

You can:

*   Drop all tags.

*   Recompute them from payload.

*   Change tagging rules.


In this model:

*   Tags are purely performance hints.

*   Conflict semantics are defined elsewhere.

*   The store doesn’t guarantee structural historical stability.


This is the most flexible — but also the least structurally deterministic.

* * *

So what is “dynamic” in DCB, really?
====================================

In the DCB specification as typically understood:

Dynamic = #1 and #2.

*   Query composition is dynamic.

*   Boundary scope is dynamic.

*   Event tagging is stable.


Not #4 and #5.

* * *

Why confusion happens
=====================

People hear “dynamic” and assume:

> Everything about the boundary can change.

But that’s not what makes DCB powerful.

DCB’s power is:

* Stable structural tagging, plus
* Runtime-composed boundary queries

If tagging itself becomes dynamic, you’re in a different model.

* * *

The clean mental separation
===========================

There are three independent axes:

1.  Are event payloads immutable? (Yes.)
2. Is the boundary query constructed at runtime? (Yes — that’s the intended dynamic part.)
3. Are event tags immutable? (Design choice.)



Only #2 is required by DCB.  
#3 is an architectural choice.
