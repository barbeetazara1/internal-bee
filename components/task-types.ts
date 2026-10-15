export type TaskDTO = {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee_id: string | null;
  depends_on_id: string | null;
  start_date: string; // yyyy-mm-dd
  due_date: string;
};
export type UserDTO = { id: string; name: string };
