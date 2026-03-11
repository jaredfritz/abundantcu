export interface EditorAccessRequestRow {
  id: string;
  email: string;
  display_name: string;
  notes: string | null;
  requester_user_id: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface EditorRoleRow {
  id: string;
  user_id: string | null;
  email: string;
  granted_at: string;
  granted_by: string | null;
}
