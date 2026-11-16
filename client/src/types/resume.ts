// Keep in sync with server/src/models/resumeModel.
export const RESUME_HEADLINE_MAX = 120;
export const RESUME_SUMMARY_MAX = 2000;
export const RESUME_BODY_MAX = 20000;

export interface Resume {
  _id?: string;
  headline: string;
  summary: string;
  body: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ResumeInput = Pick<Resume, 'headline' | 'summary' | 'body'>;
