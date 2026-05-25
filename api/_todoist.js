const BASE = "https://api.todoist.com/api/v1";

function getToken() {
  const t = process.env.TODOIST_API_TOKEN;
  if (!t) throw new Error("TODOIST_API_TOKEN not set");
  return t;
}

async function td(method, path, body) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (res.status === 204) return null;
  if (!res.ok) {
    const e = await res.text();
    throw new Error(`Todoist ${method} ${path}: ${e}`);
  }
  return res.json();
}

// Tasks
export const listTasks = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return td("GET", `/tasks${qs ? "?" + qs : ""}`);
};

export const listCompletedTasks = (params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return td("GET", `/tasks/completed/get_all${qs ? "?" + qs : ""}`);
};

export const getTask = (id) => td("GET", `/tasks/${id}`);

export const createTask = (data) => td("POST", "/tasks", data);

export const updateTask = (id, data) => td("POST", `/tasks/${id}`, data);

export const closeTask = (id) => td("POST", `/tasks/${id}/close`);

export const reopenTask = (id) => td("POST", `/tasks/${id}/reopen`);

export const deleteTask = (id) => td("DELETE", `/tasks/${id}`);

// Labels
export const listLabels = () => td("GET", "/labels");

export const createLabel = (name) => td("POST", "/labels", { name });
