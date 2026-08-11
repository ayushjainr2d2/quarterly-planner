export type Source = "slack" | "jira" | "support" | "sales" | "exec" | "other" | "manual";

export type Framework = "RICE" | "value_effort";

export type Status =
  | "unscored"
  | "scored"
  | "organized"
  | "committed"
  | "deprioritized";

export interface Scores {
  // RICE
  reach?: number; // 1-5
  impact?: number; // 1-5
  confidence?: number; // 0-100
  effort?: number; // sprints

  // value_effort
  value?: number; // 1-5
}

export interface AutoFilledFields {
  reach?: boolean;
  impact?: boolean;
  value?: boolean;
  confidence?: boolean;
}

export interface Comment {
  id: string;
  text: string; // may embed @mentions, e.g. "@Priya can you weigh in?"
  createdAt: number;
}

export interface Idea {
  id: string;
  title: string;
  description: string;
  source: Source;
  rawContext: string;
  /** Set once a PM edits rawContext by hand — tells sheet sync to stop overwriting it. */
  rawContextEdited?: boolean;
  /** Set once a PM edits description by hand — tells sheet sync to stop overwriting it. */
  descriptionEdited?: boolean;
  /** ISO timestamp — set when a PM archives an idea instead of deleting it outright.
   * Purged automatically after ARCHIVE_RETENTION_DAYS; restorable until then. */
  archivedAt?: string;
  /** ISO timestamp — set when a PM marks an idea as built/shipped.
   * Purged automatically after DONE_RETENTION_DAYS; reopenable until then. */
  doneAt?: string;
  scores: Scores;
  autoFilled?: AutoFilledFields;
  computedScore: number;
  theme: string;
  owner: string;
  /** Link to the feature's PRD, set from Discuss — opens in a new tab. */
  prdUrl?: string;
  /** "YYYY-MM-DD" — when work starts, set from Discuss. Undefined defaults to
   * today ("the most recent month") for Timeline bar placement. */
  startDate?: string;
  status: Status;
  duplicateOf?: string;
  quarterPosition?: string; // e.g. "Month 1"
  /** Manual override of the Discuss capacity-cutoff selection — true/false forces the
   * idea in/out of the selected set regardless of where it falls in score-priority order.
   * Undefined means "use the automatic capacity-cutoff result". */
  selectionOverride?: boolean;
  dismissedDuplicate?: boolean;
  mergedSources?: Source[]; // populated once merged
  comments?: Comment[];
}

export interface Workspace {
  capacityPersonSprints: number;
  activeFramework: Framework;
}

export type Stage = "enrich" | "discuss" | "plan";
