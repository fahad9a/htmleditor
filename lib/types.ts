export type Role = "owner" | "editor" | "viewer";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
}

export interface Member {
  user_id: string;
  role: Role;
  profiles: Profile;
}

export interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  project_id: string;
  title: string;
  html_content: string;
  patches: PatchOp[];
  transitions: TransitionCfg;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

// One edit operation. The original HTML is immutable; the document's state is
// html_content + patches replayed in order.
export interface PatchOp {
  op: "style" | "text" | "attr" | "hide" | "remove" | "restore" | "slide";
  id?: string;
  prop?: string;
  value?: string;
  name?: string;
  on?: boolean;
  sub?: "add" | "dup" | "del" | "up" | "down" | "rename" | "mark";
  parentId?: string;
  index?: number;
  html?: string;
}

export interface VersionRow {
  id: string;
  document_id: string;
  html_content: string;
  patches: PatchOp[];
  label: string;
  created_by: string | null;
  created_at: string;
  profiles?: Profile | null;
}

export interface SlideInfo {
  id: string;
  name: string;
}

// Snapshot of the element currently selected inside the iframe.
export interface SelectedEl {
  id: string;
  tag: string;
  text: string;
  canText: boolean;
  hidden: boolean;
  path: { id: string; tag: string }[];
  styles: Record<string, string>;
  attrs: Record<string, string>;
}

export type TransitionType = "none" | "fade" | "slide-left" | "slide-right" | "zoom";

export interface TransitionCfg {
  type: TransitionType;
  duration: number; // seconds
  delay: number; // seconds
}

export interface Collaborator {
  key: string;
  name: string;
  color: string;
  selectedId: string | null;
}

// A comment thread entry. element_id anchors it to a data-vhe-id in the
// document (null = comment on the whole document); parent_id makes it a reply.
export interface CommentRow {
  id: string;
  document_id: string;
  element_id: string | null;
  parent_id: string | null;
  author_id: string;
  body: string;
  resolved: boolean;
  created_at: string;
  profiles?: Profile | null;
}
