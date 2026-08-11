# **Quarterly Planning & Prioritization Tool** 

## **Problem:**

Planning and prioritization is a persistent challenge: PMs must intake feature requests from customers,internal stakeholders, support teams, sales, and other sources—then distill them into a clear plan using a framework that maximizes impact on the metrics that matter. Today, this process often looks like:

1. pulling data from multiple systems,  
2. consolidating it into spreadsheets,  
3. applying one or more prioritization frameworks,  
4. and producing a quarterly plan that then needs to be shared back with the team.

## **Objective:**

A focused workspace that takes already-ingested feature ideas, scores them fast with RICE or an alternate framework, and turns them into a quarterly plan a PM can defend in a planning meeting. It should **NOT** feel like a spreadsheet.

## **Challenges by stage:**

### **Stage 1 \- Enrich**

**Challenge:**

1. Data from slack, customer emails, support teams etc may not always have all the context to help prioritise, needing follow-up.

**Goal: Get each idea scored with minimum typing.** 

**Screen:** 

1. A lightweight table   
2. RICE fields as inline, large-touch-target inputs (sliders or segmented steppers for Reach/Impact/Confidence, plain number for Effort).   
3. Smart defaults: If the ingested idea already has metadata (e.g., a support-ticket count, a sales-tagged deal size), pre-fill Reach/Impact from it.

**Done state:** Every idea has a computed populated data from; unscored ideas are visually flagged, not hidden.

### **Stage 2 \- Organize & Normalize**

**Challenge:**

1. It is difficult to normalise between different types of data, example \-  
   1. 10 support tickets vs 2 sales request with churn possibilities of large enterprise customers  
   2. Request from a company leader based on some customer meetings, vs competitor analysis of lacking feature  
2. Requests are present across various sources, often with redundancies in asks  
3. Engineering input on effort comes as part of scope discussions often after Reach and Impact are understood

**Goal: Bring every idea, regardless of source, into one consistent shape.** 

**Screen**: A single table/board with columns: Title, Theme/Tag, Source, Score Breakdown, Owner, Status. 

**Key actions:** 

1. Bulk-tag by theme, merge likely duplicates (flagged automatically by title/description similarity, PM confirms merge — not auto-merged silently),  
2. normalize inconsistent naming.   
3. Normalise impact and reach scores  
   1. Add a prompt for calculating these scores  
4. Let the PM confirm or adjust these scores rather than enter from scratch.   
   1. (Future iteration \- this feedback from PM is used to tune scoring and normalisation prompt)  
5. There is a natural line to be drawn in the prioritized items based on engineering bandwidth. Effort score can be taken as \- .5 sprint as score of 1, 1 sprint as 2, 1.5 as 3\. 2 sprints as 4, 2.5 sprints as 5, 3 sprints as 6…so on and so forth.  
   1. User has the ability to add person-sprints number at top. The line is drawn automatically based on person-sprints added.  
6. Ability to choose scoring mechanism.Default is RICE framework.   
   1. Other scoring can include: [https://www.atlassian.com/agile/product-management/prioritization-framework](https://www.atlassian.com/agile/product-management/prioritization-framework)  
   2. Switching frameworks re-maps existing scored ideas where possible (e.g., RICE's Impact → Value axis) rather than wiping data — smart default, not a reset

**Done state:** No untagged, unowned, or duplicate-flagged ideas remain (or PM has explicitly dismissed the flag). The ideas are presented in priority order.

### **Stage 3 — Discuss & Adjust (lightweight AI assist)**

**Challenge:**

1. Dependent product teams have their own priorities and your feature needs to compete with those priorities, this makes it difficult to follow the priority list (Out of scope for this project)  
2. Often a low scoring item may need prioritisation purely cause of customer relationship or other factors

**Goal: Let the PM sanity-check the set before committing, without opening a free-form chat. Scoped AI actions (buttons, not a prompt box):**

* Summarize conflicts.  Example., two high-RICE ideas competing for the same eng team/quarter capacity  
* Suggest cuts. lowest-score-per-effort ideas, with one-line rationale  
* Flag inconsistent scoring. e.g., an idea scored high-Impact but tagged low-priority theme   
  * User has the ability to bring this item into the priortized list (above line) even though it scores low

Interaction: Suggestions appear as dismissible cards next to the affected ideas; accepting one performs the edit directly (score change, status change) with instant visual feedback. No open dialogue as this keeps the step from becoming an unbounded assistant. 

**Done state:** PM has reviewed all AI flags (accepted, dismissed, or edited manually) and has a prioritised list view of items.

### **Stage 4 — Generate the Plan**

**Goal: Produce something shareable and defensible.** 

View 1:  Prioritized list: Ranked by score, grouped by theme, with capacity/effort running total visible so the PM sees where the cutoff naturally falls. 

View 2: Timeline: The same committed set laid onto a quarter-by-quarter (or month-by-month) view, drag-adjustable. 

Switching List: Timeline is a single toggle, not a new page. 

**Done state:** A committed set of ideas with dates/quarter assignment, visually distinct from the "not this quarter" set (not deleted, just deprioritized).

## **Out of scope:**

* Ingestion pipeline (ideas arrive pre-loaded from a google spreadsheet for now)  
* Export (assumed handled)  
* Auth / multi-user permissions  
* Open-ended AI chat. AI assist is scoped, but the tool doesn’t have a conversational interface  
* Framework builder for arbitrary custom criteria.  V1 will ship RICE and 2 alternates but doesn’t have configurability for V1. V2 can scope these based on requests.  
* Learning from feedback

## **Data model (per idea)**

id, title, description, source (e.g. sales/support/customer),  
framework\_scores: { reach, impact, confidence, effort } | { value, effort } | Other..  
computed\_score,  
theme/tag,  
owner,  
status: unscored | scored | organized | committed | deprioritized,  
quarter/timeline\_position,  
ai\_flags: \[ \] (conflict, suggested\_cut, inconsistent\_score)

## **Copy principles to hold to**

* Buttons: verbs, no filler ("Merge", not "Merge these two items")  
* Empty states explain the *next single action*, not the whole feature  
* Numbers over adjectives (show the RICE score, not "high priority")

## **Future Improvements**

1. Integrate with team engineering capacity, past efforts for similar features, dependent team roadmap views

## **Build** 

1. A sample spreadsheet with randomly pulled data from slack, JIRA, tickets etc  
2. A prompt to help normalise the asks