export type TaskItem = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  className?: string | null;
};

let tasks: TaskItem[] = [];

export const getTasks = () => tasks;

export const addTask = (title: string, className?: string | null) => {
  const task: TaskItem = {
    id: crypto.randomUUID(),
    title,
    done: false,
    createdAt: new Date().toISOString(),
    className: className?.trim() || null,
  };
  tasks = [task, ...tasks];
  return task;
};

export const toggleTask = (id: string) => {
  tasks = tasks.map((task) =>
    task.id === id ? { ...task, done: !task.done } : task
  );
  return tasks.find((task) => task.id === id) ?? null;
};

export const removeTask = (id: string) => {
  const existing = tasks.find((task) => task.id === id) ?? null;
  if (!existing) return null;
  tasks = tasks.filter((task) => task.id !== id);
  return existing;
};
