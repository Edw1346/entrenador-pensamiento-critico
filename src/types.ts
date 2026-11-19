export type SkillId =
  | "deduction"
  | "induction"
  | "probability"
  | "causality"
  | "sources"
  | "assumptions"
  | "fallacies"
  | "biases"
  | "statistics"
  | "insufficient"
  | "arguments"
  | "updating";
export interface Skill {
  id: SkillId;
  label: string;
  description: string;
  icon: string;
}
export interface Option {
  id: string;
  text: string;
}
export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
}
export interface ExerciseStep {
  prompt: string;
  options: Option[];
  answer: string;
  explanation: string;
}
export interface Exercise {
  id: string;
  skill: SkillId;
  title: string;
  difficulty: 1 | 2 | 3;
  kind: "choice" | "steps" | "open";
  objective: string;
  prompt: string;
  options?: Option[];
  answer?: string;
  steps?: ExerciseStep[];
  rubric: RubricCriterion[];
  modelAnswer: string;
  explanation: string;
  commonErrors: string[];
  harderVariant: string;
  family: string;
}
