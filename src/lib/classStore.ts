export type ClassItem = {
  id: string;
  name: string;
  createdAt: string;
};

let classes: ClassItem[] = [];

export const getClasses = () => classes;

export const addClass = (name: string) => {
  const normalized = name.trim();
  if (!normalized) return null;

  const existing = classes.find(
    (item) => item.name.toLowerCase() === normalized.toLowerCase()
  );
  if (existing) return existing;

  const newClass: ClassItem = {
    id: crypto.randomUUID(),
    name: normalized,
    createdAt: new Date().toISOString(),
  };
  classes = [newClass, ...classes];
  return newClass;
};

export const removeClass = (id: string) => {
  const existing = classes.find((item) => item.id === id) ?? null;
  if (!existing) return null;
  classes = classes.filter((item) => item.id !== id);
  return existing;
};
